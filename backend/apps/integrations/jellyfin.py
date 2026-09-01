from typing import Dict, List, Optional
from urllib.parse import quote, urlencode

import httpx


class JellyfinClient:
    """
    Cliente para a API do Jellyfin.

    Autentica pelo cabeçalho `Authorization: MediaBrowser Token="..."`, que é o
    formato aceito pelo Jellyfin para chaves de API criadas no painel
    (Dashboard > API Keys).
    """

    def __init__(self, server_url: str, api_key: str, user_id: str = ''):
        self.server_url = server_url.rstrip('/')
        self.api_key = api_key
        self.user_id = user_id
        self.client = httpx.AsyncClient(
            timeout=30.0,
            headers={'Authorization': f'MediaBrowser Token="{api_key}"'},
        )

    async def search_movie(self, title: str, year: Optional[int] = None) -> Optional[Dict]:
        """
        Procura um filme na biblioteca.

        Returns:
            Dict com id, name, year e container, ou None se não achar.
        """
        params: Dict[str, object] = {
            'searchTerm': title,
            'IncludeItemTypes': 'Movie',
            'Recursive': 'true',
            'Limit': 10,
            'Fields': 'MediaSources,ProductionYear',
        }
        if year:
            params['Years'] = year
        if self.user_id:
            params['userId'] = self.user_id

        try:
            response = await self.client.get(f"{self.server_url}/Items", params=params)
            response.raise_for_status()
            items = response.json().get('Items', [])
        except (httpx.HTTPError, ValueError) as e:
            print(f"Error searching Jellyfin: {e}")
            return None

        if not items:
            return None

        # Com ano informado, exige correspondência exata: dois filmes de mesmo
        # nome e anos diferentes são obras distintas, não variações.
        for item in items:
            if year and item.get('ProductionYear') != year:
                continue
            sources = item.get('MediaSources') or []
            return {
                'id': item.get('Id'),
                'name': item.get('Name'),
                'year': item.get('ProductionYear'),
                'container': (sources[0].get('Container') if sources else None),
                'size_bytes': (sources[0].get('Size') if sources else None),
            }
        return None

    def build_stream_url(self, item_id: str) -> str:
        """
        URL de direct play do item.

        `static=true` entrega o arquivo original sem transcodificação — é o que
        o Lumière quer, já que o acervo prioriza fidelidade (REMUX, HDR, Atmos)
        e transcodificar destruiria justamente isso.

        A chave vai na query porque a tag <video> do navegador não permite
        cabeçalhos personalizados.
        """
        query = urlencode({'static': 'true', 'api_key': self.api_key})
        return f"{self.server_url}/Videos/{quote(str(item_id))}/stream?{query}"

    async def get_libraries(self) -> List[Dict]:
        """Lista as bibliotecas do servidor (usado para diagnóstico)."""
        try:
            response = await self.client.get(f"{self.server_url}/Library/VirtualFolders")
            response.raise_for_status()
            return [
                {
                    'id': lib.get('ItemId'),
                    'name': lib.get('Name'),
                    'type': lib.get('CollectionType'),
                }
                for lib in response.json()
            ]
        except (httpx.HTTPError, ValueError) as e:
            print(f"Error fetching Jellyfin libraries: {e}")
            return []

    async def close(self):
        await self.client.aclose()
