from typing import Dict, List, Optional

import asyncio
import logging
import re
from urllib.parse import quote_plus

import httpx
from django.conf import settings


logger = logging.getLogger(__name__)


class ProwlarrIndisponivel(Exception):
    """
    A busca não pôde ser feita.

    Distinta de "não achei nada": a tela precisa poder dizer ao usuário que a
    integração está quebrada em vez de afirmar que o filme não tem cópia.
    """


SEGUNDOS_DE_ESPERA = 150.0


def _imdb_numerico(valor) -> Optional[int]:
    """
    O número do IMDb, ou None quando não foi informado.

    O Prowlarr usa `0` como sentinela de "não sei" e o devolve em quase todo
    resultado. Tratar esse zero como um id declarado faz o filtro de conflito
    descartar tudo — inclusive, na medição, o melhor REMUX 2160p do acervo.
    O nosso lado guarda 'tt0407887'; o deles devolve 407887.
    """
    if valor in (None, '', 0, '0'):
        return None
    digitos = re.search(r'([1-9]\d*)', str(valor))
    return int(digitos.group(1)) if digitos else None


def consultas_para(titulos, year: Optional[int] = None) -> List[str]:
    """
    As buscas a fazer por um filme, a partir dos nomes que ele tem.

    O acervo guarda o título localizado — 38% dos 25.908 filmes têm `title`
    diferente de `original_title` — e os indexadores catalogam pelo original.
    Mas nem o original basta: "東京物語" não aparece em tracker nenhum, e o
    nome que aparece é "Tokyo Story", que mora nos títulos alternativos do
    TMDB. Buscar só pelos dois primeiros trouxe 44 cópias de filmes de 1953
    que não eram o filme.

    Cada consulta custa de 40 a 100 segundos, então quem escolhe a lista é
    `release_naming.titulos_para_buscar` — e ela para em três.
    """
    if isinstance(titulos, str):
        titulos = [titulos]

    vistos = []
    for nome in titulos:
        nome = (nome or '').strip()
        if not nome or nome.casefold() in {v.casefold() for v in vistos}:
            continue
        vistos.append(nome)

    # `year` é anulável no acervo, e interpolá-lo direto punha a palavra
    # "None" na busca: o indexador procurava pelo literal e não achava nada, e
    # a tela dizia "sem releases" em vez de "sem ano".
    sufixo = f' {year}' if year else ''
    return [f'{nome}{sufixo}' for nome in vistos]


def magnet_de(info_hash: str, titulo: str = '') -> str:
    """
    Monta o magnet a partir do hash.

    O `magnetUrl` do Prowlarr não é magnet: para a maioria dos indexadores ele
    é uma URL de proxy para o arquivo .torrent
    (`http://prowlarr:9696/2/download?apikey=...`). Verificado no acervo: das
    61 cópias gravadas, ZERO tinham magnet de verdade e 56 guardavam uma URL
    dessas. O Real-Debrid respondia 404 em `addMagnet` — para ele aquilo não
    era magnet nenhum, e o botão de importar nunca funcionou.

    O hash basta. Um magnet só com `xt` é válido, e o Real-Debrid o aceita
    (verificado: 201). O `dn` entra só como cortesia para quem for ler o link.
    """
    if not info_hash:
        return ''
    link = f'magnet:?xt=urn:btih:{info_hash}'
    if titulo:
        link += f'&dn={quote_plus(titulo[:120])}'
    return link


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
        # 30s era menos que a busca leva. Medido nesta instalação, com 9
        # indexadores ativos: 40s para "The Departed 2006", 100s para
        # "Stalker 1979" — quase toda busca real estourava o timeout e virava
        # ProwlarrIndisponivel. O tempo é do indexador mais lento, não nosso:
        # "Generic Torznab" sozinho responde em 40s; os outros oito somados
        # levam menos de 2.
        # As consultas que falharam na última busca. `search_movie` só levanta
        # quando TODAS caem; a falha PARCIAL vira um logger.warning e o
        # resultado volta menor, sem ninguém notar. Guardar aqui é o que
        # permite a tela dizer "o que está abaixo pode não ser tudo".
        self.consultas_falhas: list[str] = []
        self.client = httpx.AsyncClient(
            timeout=httpx.Timeout(SEGUNDOS_DE_ESPERA, connect=10.0),
            headers={'X-Api-Key': api_key}
        )
    
    async def search_movie(
        self,
        title: str,
        year: Optional[int] = None,
        imdb_id: Optional[str] = None,
        categories: list[int] | None = None,
        original_title: Optional[str] = None,
        titulos: Optional[List[str]] = None,
    ) -> List[Dict]:
        """
        Busca releases de um filme nos indexadores.

        Faz uma busca por título — original e localizado, quando diferem — e
        funde os resultados pelo info_hash. Buscar só pelo `movie.title` do
        acervo encontrava 7 cópias de "Os Infiltrados" onde "The Departed"
        encontra 179, e 38% do acervo está nessa situação.

        Levanta ProwlarrIndisponivel quando a busca não pôde ser feita. Antes
        devolvia lista vazia para qualquer erro — chave inválida, servidor
        fora do ar, indexador travado —, e a tela dizia "nenhum release
        encontrado". O usuário não tinha como distinguir um filme sem cópia de
        uma integração quebrada, e o único sinal ia para o stdout num `print`.
        """
        if categories is None:
            categories = [2000]  # Filmes

        self.consultas_falhas = []
        consultas = consultas_para(titulos or [original_title, title], year)
        if not consultas:
            return []

        respostas = await asyncio.gather(
            *(self._busca_crua(q, categories) for q in consultas),
            return_exceptions=True,
        )

        crus: List[Dict] = []
        falhas = []
        for consulta, resposta in zip(consultas, respostas):
            if isinstance(resposta, BaseException):
                falhas.append((consulta, resposta))
                continue
            crus.extend(resposta)

        # Só desiste quando NENHUMA busca funcionou. Se o título original
        # respondeu e o localizado caiu, devolver o que veio é melhor que
        # transformar tudo em erro — mas a falha parcial precisa aparecer,
        # senão o acervo encolhe em silêncio.
        if falhas and len(falhas) == len(consultas):
            raise falhas[0][1]
        for consulta, erro in falhas:
            self.consultas_falhas.append(f'{consulta}: {erro}')
            logger.warning('Busca por %r falhou: %s', consulta, erro)

        return self._parse_results(self._sem_repetidos(crus), imdb_id)

    @staticmethod
    def _sem_repetidos(itens: List[Dict]) -> List[Dict]:
        """
        Funde as buscas pelo infoHash.

        Título original e localizado trazem o mesmo torrent quando o release
        cita os dois nomes; sem isto ele viraria duas linhas idênticas na
        tela. Quem não tem hash passa direto — o descarte é do parser, e
        misturar as duas decisões aqui esconderia a contagem que ele registra.
        """
        vistos = set()
        saida = []
        for item in itens:
            chave = (item.get('infoHash') or '').strip().lower()
            if chave and chave in vistos:
                continue
            if chave:
                vistos.add(chave)
            saida.append(item)
        return saida

    async def _busca_crua(self, consulta: str, categories: list[int]) -> List[Dict]:
        """Uma consulta ao Prowlarr, sem tradução de campos."""
        # O IMDb NÃO entra na consulta. A sintaxe `{ImdbId:tt...}` só é
        # entendida por indexadores que fazem busca por IMDb; os demais
        # procuram as chaves literalmente e não casam com nada. Medido nesta
        # instalação, para "The Departed": com o token embutido, 2 indexadores
        # respondem e sobram 15 cópias aproveitáveis; só com título e ano,
        # respondem 9 e sobram 178. Passar `imdbId` como parâmetro próprio
        # também não serve — os indexadores que não o entendem devolvem o
        # catálogo recente inteiro, e a relevância medida foi de 0%.
        params = {
            'type': 'movie',
            'query': consulta,
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

        return resultados

    def _parse_results(self, results: List[Dict],
                       imdb_id: Optional[str] = None) -> List[Dict]:
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
        esperado = _imdb_numerico(imdb_id)
        descartadas_sem_hash = 0
        descartadas_por_imdb = 0

        for item in results:
            info_hash = (item.get('infoHash') or '').strip().lower()
            if not info_hash:
                descartadas_sem_hash += 1
                continue

            # Descarte só por contradição: a release DECLARA um IMDb e é outro
            # filme. Quem não declara passa — 78% dos resultados não declaram,
            # e exigir declaração jogaria fora quase tudo. Na medição isto
            # tirou 1 release mal etiquetada em 179 e preservou as outras 178.
            declarado = _imdb_numerico(item.get('imdbId'))
            if esperado is not None and declarado is not None and declarado != esperado:
                descartadas_por_imdb += 1
                continue

            parsed.append({
                'title': (item.get('title') or '')[:500],
                'info_hash': info_hash[:40],
                # Do hash, e não do `magnetUrl`: aquele campo costuma trazer
                # uma URL de download do Prowlarr, que o Real-Debrid recusa.
                'magnet_link': magnet_de(info_hash, item.get('title') or ''),
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

        # Em nível de INFO e não DEBUG: descartar 45% do que o indexador
        # achou é um número que precisa estar à vista quando alguém perguntar
        # por que só apareceram poucas cópias.
        if descartadas_sem_hash or descartadas_por_imdb:
            logger.info(
                'Prowlarr: %d de %d releases aproveitadas '
                '(%d sem infoHash, %d de outro filme)',
                len(parsed), len(results), descartadas_sem_hash, descartadas_por_imdb)

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