from datetime import datetime
from typing import Dict, List, Optional

import httpx


class RealDebridClient:
    """Cliente para API do Real-Debrid"""
    
    BASE_URL = "https://api.real-debrid.com/rest/1.0"
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.client = httpx.AsyncClient(
            timeout=30.0,
            headers={'Authorization': f'Bearer {api_key}'}
        )
    
    async def check_instant_availability(
        self,
        hashes: List[str]
    ) -> Dict[str, bool]:
        """
        Verifica disponibilidade instantânea de torrents (cached)
        
        Args:
            hashes: Lista de info hashes (max 100)
        
        Returns:
            Dict mapeando hash -> bool (disponível ou não)
        """
        hash_string = '/'.join(hashes[:100])
        
        try:
            response = await self.client.get(
                f"{self.BASE_URL}/torrents/instantAvailability/{hash_string}"
            )
            response.raise_for_status()
            data = response.json()
            
            # Parse availability
            availability = {}
            for hash_val, info in data.items():
                # Se dict não está vazio, torrent está cached
                availability[hash_val.upper()] = bool(info)
            
            return availability
        
        except httpx.HTTPError as e:
            print(f"Real-Debrid instant check error: {e}")
            return {h.upper(): False for h in hashes}
    
    async def add_magnet(self, magnet_url: str) -> str:
        """
        Adiciona magnet link ao Real-Debrid
        
        Returns:
            Torrent ID
        """
        try:
            response = await self.client.post(
                f"{self.BASE_URL}/torrents/addMagnet",
                data={'magnet': magnet_url}
            )
            response.raise_for_status()
            data = response.json()
            
            if 'id' not in data:
                raise Exception(f"Failed to add magnet: {data}")
            
            return data['id']
        
        except httpx.HTTPError as e:
            print(f"Error adding magnet: {e}")
            raise
    
    async def select_files(
        self,
        torrent_id: str,
        file_ids: Optional[List[int]] = None
    ) -> bool:
        """
        Seleciona arquivos para download
        
        IMPORTANTE: Deve ser chamado após add_magnet
        
        Args:
            torrent_id: ID do torrent
            file_ids: IDs dos arquivos (None = todos)
        """
        if file_ids is None:
            # Get torrent info to select all files
            info = await self.get_torrent_info(torrent_id)
            file_ids = [f['id'] for f in info.get('files', [])]
        
        try:
            response = await self.client.post(
                f"{self.BASE_URL}/torrents/selectFiles/{torrent_id}",
                data={'files': ','.join(map(str, file_ids))}
            )
            return response.status_code == 204
        
        except httpx.HTTPError as e:
            print(f"Error selecting files: {e}")
            return False
    
    async def get_torrent_info(self, torrent_id: str) -> Dict:
        """
        Informações detalhadas do torrent
        
        Returns:
            Dict com id, filename, hash, bytes, status, progress, files, links
        """
        try:
            response = await self.client.get(
                f"{self.BASE_URL}/torrents/info/{torrent_id}"
            )
            response.raise_for_status()
            return response.json()
        
        except httpx.HTTPError as e:
            print(f"Error getting torrent info: {e}")
            return {}
    
    async def list_torrents(
        self,
        limit: int = 100,
        filter_status: Optional[str] = None
    ) -> List[Dict]:
        """
        Lista torrents do usuário
        
        Args:
            filter_status: 'active', 'downloaded', 'error', 'dead'
        """
        params = {'limit': limit}
        if filter_status:
            params['filter'] = filter_status
        
        try:
            response = await self.client.get(
                f"{self.BASE_URL}/torrents",
                params=params
            )
            response.raise_for_status()
            return response.json()
        
        except httpx.HTTPError as e:
            print(f"Error listing torrents: {e}")
            return []
    
    async def delete_torrent(self, torrent_id: str) -> bool:
        """Deleta torrent"""
        try:
            response = await self.client.delete(
                f"{self.BASE_URL}/torrents/delete/{torrent_id}"
            )
            return response.status_code == 204
        except httpx.HTTPError:
            return False
    
    async def get_download_links(self, torrent_id: str) -> List[str]:
        """
        Obtém links diretos de download
        
        Returns:
            Lista de URLs diretas
        """
        info = await self.get_torrent_info(torrent_id)
        
        if info.get('status') != 'downloaded':
            return []
        
        direct_links = []
        for link in info.get('links', []):
            unrestricted = await self.unrestrict_link(link)
            if unrestricted:
                direct_links.append(unrestricted['download'])
        
        return direct_links
    
    async def unrestrict_link(self, link: str) -> Optional[Dict]:
        """
        Converte link RD para link direto
        
        Returns:
            Dict com download URL, filename, filesize
        """
        try:
            response = await self.client.post(
                f"{self.BASE_URL}/unrestrict/link",
                data={'link': link}
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            print(f"Error unrestricting link: {e}")
            return None
    
    async def get_user_info(self) -> Dict:
        """Informações da conta"""
        try:
            response = await self.client.get(f"{self.BASE_URL}/user")
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            print(f"Error getting user info: {e}")
            return {}
    
    async def close(self):
        """Fecha conexão"""
        await self.client.aclose()