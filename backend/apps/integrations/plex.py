from typing import Dict, List, Optional
from xml.etree import ElementTree as ET

import httpx


class PlexClient:
    """Cliente para API do Plex Media Server"""
    
    def __init__(self, server_url: str, token: str):
        self.server_url = server_url.rstrip('/')
        self.token = token
        self.client = httpx.AsyncClient(
            timeout=30.0,
            headers={'X-Plex-Token': token}
        )
    
    async def get_libraries(self) -> List[Dict]:
        """
        Lista bibliotecas do servidor
        
        Returns:
            Lista de dicts com key, title, type
        """
        try:
            response = await self.client.get(f"{self.server_url}/library/sections")
            response.raise_for_status()
            
            root = ET.fromstring(response.text)
            libraries = []
            
            for directory in root.findall('.//Directory'):
                libraries.append({
                    'key': directory.get('key'),
                    'title': directory.get('title'),
                    'type': directory.get('type'),
                    'location': directory.get('location'),
                })
            
            return libraries
        
        except httpx.HTTPError as e:
            print(f"Error fetching Plex libraries: {e}")
            return []
    
    async def get_movies_library_key(self) -> Optional[str]:
        """Retorna key da primeira biblioteca de filmes"""
        libraries = await self.get_libraries()
        
        for lib in libraries:
            if lib['type'] == 'movie':
                return lib['key']
        
        return None
    
    async def search_movie(
        self,
        title: str,
        year: Optional[int] = None,
        library_key: Optional[str] = None
    ) -> List[Dict]:
        """
        Busca filme na biblioteca
        
        Args:
            title: Título do filme
            year: Ano (opcional, melhora precisão)
            library_key: Key da biblioteca (auto-detecta se None)
        
        Returns:
            Lista de filmes encontrados
        """
        if library_key is None:
            library_key = await self.get_movies_library_key()
            if not library_key:
                return []
        
        params = {
            'type': 1,  # 1 = movie
            'title': title
        }
        
        try:
            response = await self.client.get(
                f"{self.server_url}/library/sections/{library_key}/all",
                params=params
            )
            response.raise_for_status()
            
            root = ET.fromstring(response.text)
            movies = []
            
            for video in root.findall('.//Video'):
                movie_year = video.get('year')
                
                # Filtrar por ano se fornecido
                if year and movie_year and int(movie_year) != year:
                    continue
                
                movies.append({
                    'rating_key': video.get('ratingKey'),
                    'title': video.get('title'),
                    'year': int(movie_year) if movie_year else None,
                    'duration': int(video.get('duration', 0)),
                    'added_at': video.get('addedAt'),
                    'guid': video.get('guid'),
                })
            
            return movies
        
        except httpx.HTTPError as e:
            print(f"Error searching Plex: {e}")
            return []
    
    async def get_movie_metadata(self, rating_key: str) -> Optional[Dict]:
        """
        Metadados completos do filme
        
        Returns:
            Dict com todos os metadados do Plex
        """
        try:
            response = await self.client.get(
                f"{self.server_url}/library/metadata/{rating_key}"
            )
            response.raise_for_status()
            
            root = ET.fromstring(response.text)
            video = root.find('.//Video')
            
            if video is None:
                return None
            
            # Parse genres
            genres = [g.get('tag') for g in video.findall('.//Genre')]
            
            # Parse directors
            directors = [d.get('tag') for d in video.findall('.//Director')]
            
            # Parse actors
            actors = []
            for role in video.findall('.//Role'):
                actors.append({
                    'name': role.get('tag'),
                    'role': role.get('role'),
                })
            
            # Parse media info (quality)
            media_parts = []
            for media in video.findall('.//Media'):
                for part in media.findall('.//Part'):
                    media_parts.append({
                        'file': part.get('file'),
                        'size': int(part.get('size', 0)),
                        'container': part.get('container'),
                        'video_codec': media.get('videoCodec'),
                        'audio_codec': media.get('audioCodec'),
                        'width': int(media.get('width', 0)),
                        'height': int(media.get('height', 0)),
                        'bitrate': int(media.get('bitrate', 0)),
                    })
            
            return {
                'rating_key': video.get('ratingKey'),
                'title': video.get('title'),
                'year': int(video.get('year')) if video.get('year') else None,
                'rating': float(video.get('rating', 0)),
                'duration': int(video.get('duration', 0)),
                'summary': video.get('summary'),
                'tagline': video.get('tagline'),
                'thumb': video.get('thumb'),
                'art': video.get('art'),
                'content_rating': video.get('contentRating'),
                'studio': video.get('studio'),
                'genres': genres,
                'directors': directors,
                'actors': actors,
                'media': media_parts,
                'added_at': video.get('addedAt'),
                'updated_at': video.get('updatedAt'),
            }
        
        except httpx.HTTPError as e:
            print(f"Error getting Plex metadata: {e}")
            return None
    
    async def create_playlist(
        self,
        name: str,
        rating_keys: List[str],
        library_key: Optional[str] = None
    ) -> Optional[str]:
        """
        Cria playlist no Plex
        
        Args:
            name: Nome da playlist
            rating_keys: Lista de rating keys dos filmes
            library_key: Key da biblioteca
        
        Returns:
            Playlist ID
        """
        if library_key is None:
            library_key = await self.get_movies_library_key()
        
        uri_list = ','.join([
            f"server:///{self.server_url}/library/metadata/{key}"
            for key in rating_keys
        ])
        
        try:
            response = await self.client.post(
                f"{self.server_url}/playlists",
                params={
                    'type': 'video',
                    'title': name,
                    'smart': 0,
                    'uri': uri_list,
                }
            )
            response.raise_for_status()
            
            root = ET.fromstring(response.text)
            playlist = root.find('.//Playlist')
            
            return playlist.get('ratingKey') if playlist is not None else None
        
        except httpx.HTTPError as e:
            print(f"Error creating playlist: {e}")
            return None
    
    async def update_playlist(
        self,
        playlist_id: str,
        rating_keys: List[str]
    ) -> bool:
        """Atualiza playlist existente"""
        uri_list = ','.join([
            f"server:///{self.server_url}/library/metadata/{key}"
            for key in rating_keys
        ])
        
        try:
            response = await self.client.put(
                f"{self.server_url}/playlists/{playlist_id}/items",
                params={'uri': uri_list}
            )
            return response.status_code == 200
        except httpx.HTTPError:
            return False
    
    async def delete_playlist(self, playlist_id: str) -> bool:
        """Deleta playlist"""
        try:
            response = await self.client.delete(
                f"{self.server_url}/playlists/{playlist_id}"
            )
            return response.status_code == 200
        except httpx.HTTPError:
            return False
    
    async def refresh_library(self, library_key: Optional[str] = None) -> bool:
        """
        Força refresh da biblioteca (scan for new files)
        """
        if library_key is None:
            library_key = await self.get_movies_library_key()
        
        try:
            response = await self.client.get(
                f"{self.server_url}/library/sections/{library_key}/refresh"
            )
            return response.status_code == 200
        except httpx.HTTPError:
            return False
    
    async def close(self):
        """Fecha conexão"""
        await self.client.aclose()