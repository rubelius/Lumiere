from typing import Dict, List, Optional

import logging

import httpx
from django.conf import settings


logger = logging.getLogger(__name__)


class ProwlarrIndisponivel(Exception):
    """
    A busca não pôde ser feita.

    Distinta de "não achei nada": a tela precisa poder dizer ao usuário que a
    integração está quebrada em vez de afirmar que o filme não tem cópia.
    """


def _inteiro(valor) -> int:
    """Inteiro tolerante: None, '' e lixo viram 0."""
    try:
        return max(0, int(valor or 0))
    except (TypeError, ValueError):
        return 0


class ProwlarrClient:
    """Cliente para API do Prowlarr"""
    
    def __init__(self, url: str, api_key: str):
        self.url = url.rstrip('/')
        self.api_key = api_key
        self.client = httpx.AsyncClient(
            timeout=30.0,
            headers={'X-Api-Key': api_key}
        )
    
    async def search_movie(
        self,
        title: str,
        year: Optional[int] = None,
        imdb_id: Optional[str] = None,
        categories: list[int] | None = None,
    ) -> List[Dict]:
        """
        Busca releases de um filme nos indexadores.

        Levanta ProwlarrIndisponivel quando a busca não pôde ser feita. Antes
        devolvia lista vazia para qualquer erro — chave inválida, servidor
        fora do ar, indexador travado —, e a tela dizia "nenhum release
        encontrado". O usuário não tinha como distinguir um filme sem cópia de
        uma integração quebrada, e o único sinal ia para o stdout num `print`.
        """
        if categories is None:
            categories = [2000]  # Filmes

        # O IMDb entra DENTRO da consulta, na sintaxe do Prowlarr. Ele não
        # aceita um parâmetro `imdbId`, e chave desconhecida na query string é
        # ignorada em silêncio — passá-la não desambiguava remake nenhum.
        termos = [title]
        if year:
            # `year` é anulável no acervo, e interpolá-lo direto punha a
            # palavra "None" na busca: o indexador procurava por ela e não
            # achava nada, e a tela dizia "sem releases" em vez de "sem ano".
            termos.append(str(year))
        if imdb_id:
            termos.append(f'{{ImdbId:{imdb_id}}}')

        params = {
            'type': 'movie',
            'query': ' '.join(termos),
            'limit': 100,
        }
        # Lista repetida, não string com vírgula: o binder do Prowlarr espera
        # a chave repetida, e com duas ou mais categorias a string falhava.
        params['categories'] = categories  # type: ignore[assignment]

        try:
            response = await self.client.get(f'{self.url}/api/v1/search', params=params)
            response.raise_for_status()
            resultados = response.json()
        except httpx.HTTPStatusError as e:
            raise ProwlarrIndisponivel(
                f'Prowlarr respondeu {e.response.status_code}. '
                f'Verifique a URL e a chave de API.') from e
        except httpx.HTTPError as e:
            raise ProwlarrIndisponivel(f'Não foi possível falar com o Prowlarr: {e}') from e
        except ValueError as e:
            # Resposta 200 que não é JSON — página de erro de proxy, por
            # exemplo. Sem este ramo, vazava como 500 sem explicação.
            raise ProwlarrIndisponivel('O Prowlarr devolveu algo que não é JSON.') from e

        if not isinstance(resultados, list):
            raise ProwlarrIndisponivel('Resposta do Prowlarr em formato inesperado.')

        return self._parse_results(resultados)

    def _parse_results(self, results: List[Dict]) -> List[Dict]:
        """
        Traduz o resultado do Prowlarr para os campos de TorrentRelease.

        Só devolve campos que existem no modelo. `download_url` era extraído e
        entrava no `defaults` de update_or_create, onde derrubava a gravação
        inteira com FieldError — a busca estourava 500 na primeira release
        encontrada, o que significa que ela nunca funcionou.

        Release sem info_hash é descartada: é a chave de deduplicação, é única
        no banco, e string vazia é um valor legítimo para uma coluna unique —
        a primeira release sem hash criava a linha, e todas as seguintes,
        inclusive de OUTROS filmes, caíam em cima dela num UPDATE.
        """
        parsed = []

        for item in results:
            info_hash = (item.get('infoHash') or '').strip().lower()
            if not info_hash:
                logger.debug('Release sem infoHash descartada: %s',
                             (item.get('title') or '')[:60])
                continue

            parsed.append({
                'title': (item.get('title') or '')[:500],
                'info_hash': info_hash[:40],
                'magnet_link': item.get('magnetUrl') or '',
                'size_bytes': _inteiro(item.get('size')),
                # `.get(chave, 0)` só protege contra chave AUSENTE. O Prowlarr
                # manda `"seeders": null` para indexador que não reporta
                # swarm, e o None chegava ao cálculo de score, onde
                # `None >= 100` derrubava a busca inteira.
                'seeders': _inteiro(item.get('seeders')),
                'leechers': _inteiro(item.get('leechers')),
                'indexer_id': item.get('indexerId'),
                'indexer_name': (item.get('indexer') or '')[:100],
                'upload_date': item.get('publishDate'),
            })

        return parsed

    async def get_indexers(self) -> List[Dict]:
        """Lista indexers configurados"""
        try:
            response = await self.client.get(f"{self.url}/api/v1/indexer")
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            print(f"Error fetching indexers: {e}")
            return []
    
    async def get_indexer_stats(self) -> Dict:
        """Estatísticas dos indexers"""
        try:
            response = await self.client.get(f"{self.url}/api/v1/indexerstats")
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            print(f"Error fetching stats: {e}")
            return {}
    
    async def close(self):
        """Fecha conexão"""
        await self.client.aclose()