from typing import Dict, List, Optional

import httpx
from django.conf import settings


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
        year: int,
        imdb_id: Optional[str] = None,
        categories: list[int] | None = None
    ) -> List[Dict]:
        """
        Busca releases de filme
        
        Args:
            title: Título do filme
            year: Ano do filme
            imdb_id: IMDb ID (opcional, melhora resultados)
            categories: Categorias Prowlarr (default: 2000 = Movies)
        
        Returns:
            Lista de dicts com informações do release
        """
        if categories is None:
            categories = [2000]  # Movies
        
        params = {
            'type': 'movie',
            'query': f"{title} {year}",
            'categories': ','.join(map(str, categories)),
            'limit': 100
        }
        
        if imdb_id:
            params['imdbId'] = imdb_id
        
        try:
            response = await self.client.get(
                f"{self.url}/api/v1/search",
                params=params
            )
            response.raise_for_status()
            
            results = response.json()
            return self._parse_results(results)
        
        except httpx.HTTPError as e:
            print(f"Prowlarr search error: {e}")
            return []
    
    def _parse_results(self, results: List[Dict]) -> List[Dict]:
        """Parse Prowlarr results para formato Lumière"""
        parsed = []
        
        for item in results:
            parsed.append({
                'title': item.get('title', ''),
                'info_hash': item.get('infoHash', ''),
                'magnet_link': item.get('magnetUrl', ''),
                'size_bytes': item.get('size', 0),
                'seeders': item.get('seeders', 0),
                'leechers': item.get('leechers', 0),
                'indexer_id': item.get('indexerId'),
                'indexer_name': item.get('indexer', ''),
                'upload_date': item.get('publishDate'),
                'download_url': item.get('downloadUrl', ''),
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