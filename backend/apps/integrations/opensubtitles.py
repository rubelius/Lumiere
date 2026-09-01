"""
Cliente do OpenSubtitles (api.opensubtitles.com/api/v1).

Duas credenciais diferentes, e a distinção importa:

- `Api-Key` identifica a aplicação e basta para BUSCAR.
- Para BAIXAR é preciso também um token de usuário, obtido em /login com a
  conta de quem vai consumir a cota diária de downloads.

Por isso a busca funciona só com a chave da aplicação, e o download exige que
o usuário tenha conectado a conta dele.
"""

from typing import Dict, List, Optional

import httpx
from django.conf import settings

# Configurável para poder apontar a um servidor de teste sem tocar no código.
BASE_URL = getattr(
    settings, 'OPENSUBTITLES_BASE_URL', 'https://api.opensubtitles.com/api/v1'
)
# A API exige User-Agent identificando a aplicação; sem ele responde 403.
USER_AGENT = 'Lumiere v1.0'


class OpenSubtitlesClient:
    def __init__(self, api_key: str, token: str = ''):
        self.api_key = api_key
        self.token = token
        cabecalhos = {
            'Api-Key': api_key,
            'User-Agent': USER_AGENT,
            'Accept': 'application/json',
        }
        if token:
            cabecalhos['Authorization'] = f'Bearer {token}'
        self.client = httpx.AsyncClient(timeout=30.0, headers=cabecalhos)

    async def buscar(
        self,
        imdb_id: Optional[str] = None,
        titulo: Optional[str] = None,
        ano: Optional[int] = None,
        idiomas: str = 'pt-BR,pt-PT,en',
    ) -> List[Dict]:
        """
        Legendas disponíveis, da mais baixada para a menos.

        Prefere imdb_id: casar por título traria a obra errada, o mesmo risco
        que já enfrentamos ao ligar releases do Real-Debrid.
        """
        params: Dict[str, object] = {'languages': idiomas}
        if imdb_id:
            # A API espera só a parte numérica: tt0133093 -> 133093.
            params['imdb_id'] = imdb_id.lower().removeprefix('tt').lstrip('0') or '0'
        elif titulo:
            params['query'] = titulo
            if ano:
                params['year'] = ano
        else:
            return []

        try:
            resposta = await self.client.get(f'{BASE_URL}/subtitles', params=params)
            resposta.raise_for_status()
            dados = resposta.json().get('data', [])
        except (httpx.HTTPError, ValueError) as e:
            print(f'Error searching OpenSubtitles: {e}')
            return []

        return [self._resume(item) for item in dados if self._resume(item)]

    @staticmethod
    def _resume(item: Dict) -> Optional[Dict]:
        attrs = item.get('attributes') or {}
        arquivos = attrs.get('files') or []
        if not arquivos:
            return None
        return {
            'file_id': arquivos[0].get('file_id'),
            'nome': arquivos[0].get('file_name') or attrs.get('release') or '',
            'idioma': attrs.get('language') or '',
            'downloads': attrs.get('download_count') or 0,
            'hearing_impaired': bool(attrs.get('hearing_impaired')),
            'do_upload_do_autor': bool(attrs.get('from_trusted')),
            'release': attrs.get('release') or '',
        }

    async def link_de_download(self, file_id: int) -> Optional[str]:
        """
        URL temporária do arquivo. Consome a cota diária da conta, por isso
        exige token de usuário — a chave da aplicação sozinha não basta.
        """
        if not self.token:
            return None
        try:
            resposta = await self.client.post(
                f'{BASE_URL}/download',
                json={'file_id': file_id},
                headers={'Content-Type': 'application/json'},
            )
            resposta.raise_for_status()
            return resposta.json().get('link')
        except (httpx.HTTPError, ValueError) as e:
            print(f'Error requesting OpenSubtitles download: {e}')
            return None

    async def baixar_conteudo(self, url: str) -> Optional[str]:
        """Baixa o arquivo de legenda. Vem em SRT na esmagadora maioria."""
        try:
            # Sem os cabeçalhos da API: a URL temporária é de um CDN.
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as cdn:
                resposta = await cdn.get(url)
                resposta.raise_for_status()
                # Legenda raramente é UTF-8; latin-1 é o segundo palpite usual.
                bruto = resposta.content
                for codificacao in ('utf-8-sig', 'utf-8', 'latin-1'):
                    try:
                        return bruto.decode(codificacao)
                    except UnicodeDecodeError:
                        continue
                return bruto.decode('utf-8', errors='replace')
        except httpx.HTTPError as e:
            print(f'Error downloading subtitle file: {e}')
            return None

    async def close(self):
        await self.client.aclose()


async def obter_token(api_key: str, usuario: str, senha: str) -> Optional[str]:
    """
    Troca usuário e senha por um token. Chamado uma vez, quando a conta é
    conectada: a senha não é guardada, só o token que ela produz.
    """
    try:
        async with httpx.AsyncClient(timeout=30.0) as c:
            resposta = await c.post(
                f'{BASE_URL}/login',
                json={'username': usuario, 'password': senha},
                headers={'Api-Key': api_key, 'User-Agent': USER_AGENT,
                         'Content-Type': 'application/json'},
            )
            resposta.raise_for_status()
            return resposta.json().get('token')
    except (httpx.HTTPError, ValueError) as e:
        print(f'Error logging into OpenSubtitles: {e}')
        return None
