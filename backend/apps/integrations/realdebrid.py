from datetime import datetime
from typing import Dict, List, Optional

import httpx
from django.conf import settings


class RealDebridIndisponivel(Exception):
    """
    A consulta ao Real-Debrid não pôde ser feita.

    Distinta de "não está cacheado": anunciar que nada está pronto quando o
    problema é a integração faria o acervo inteiro parecer offline.
    """


class ConsultaDeCacheDesativada(RealDebridIndisponivel):
    """
    O Real-Debrid desativou a consulta de cache.

    `/torrents/instantAvailability` responde 403 com
    `{'error': 'disabled_endpoint', 'error_code': 37}` para qualquer chave
    válida — verificado nesta conta, cujo /user e /torrents respondem 200.
    Não é falha de rede nem chave errada, e tentar de novo não adianta: é uma
    capacidade que o provedor removeu.

    Subclasse de RealDebridIndisponivel, e não irmã: todo `except` que já
    existe continua pegando esta também. Como irmã, ela escapava do
    `_marca_cacheadas` e derrubava a busca inteira com 500.

    Existe como tipo próprio porque a resposta é outra.
    Um erro transitório pede nova tentativa; este pede que a tela pare de
    prometer uma informação que ninguém mais tem como dar.
    """


CODIGO_ENDPOINT_DESATIVADO = 37


def _endpoint_desativado(resposta) -> bool:
    """
    Se o 403 é "esta rota não existe mais" e não "sua chave não vale".

    O Real-Debrid distingue os dois casos pelo corpo, não pelo status.
    """
    try:
        corpo = resposta.json()
    except Exception:
        return False
    return (isinstance(corpo, dict)
            and (corpo.get('error_code') == CODIGO_ENDPOINT_DESATIVADO
                 or corpo.get('error') == 'disabled_endpoint'))


class RealDebridClient:
    """Cliente para API do Real-Debrid"""
    
    BASE_URL = "https://api.real-debrid.com/rest/1.0"
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.client = httpx.AsyncClient(
            timeout=30.0,
            headers={'Authorization': f'Bearer {api_key}'}
        )
    
    # O endpoint aceita um punhado de hashes por chamada. O código antigo
    # fatiava em `hashes[:100]` e seguia: do 101 em diante o hash nem voltava
    # no dicionário, e o chamador lia ausência como "não cacheado".
    HASHES_POR_CHAMADA = 100

    async def check_instant_availability(self, hashes: List[str]) -> Dict[str, bool]:
        """
        Quais destes torrents já estão cacheados no Real-Debrid.

        Devolve as chaves em MINÚSCULAS, que é como o acervo guarda info_hash.
        Hash ausente do retorno significa "não cacheado"; se a consulta não
        pôde ser feita, levanta RealDebridIndisponivel em vez de responder
        que nada está cacheado — as duas coisas são diferentes, e confundi-las
        faria a tela anunciar que nenhum filme está pronto quando o problema é
        a integração.
        """
        normalizados = [h.strip().lower() for h in hashes if h and h.strip()]
        if not normalizados:
            return {}

        disponibilidade: Dict[str, bool] = {h: False for h in normalizados}

        for i in range(0, len(normalizados), self.HASHES_POR_CHAMADA):
            lote = normalizados[i:i + self.HASHES_POR_CHAMADA]
            try:
                response = await self.client.get(
                    f"{self.BASE_URL}/torrents/instantAvailability/{'/'.join(lote)}")
                response.raise_for_status()
                dados = response.json()
            except httpx.HTTPStatusError as e:
                if _endpoint_desativado(e.response):
                    raise ConsultaDeCacheDesativada(
                        'O Real-Debrid desativou a consulta de cache '
                        '(instantAvailability). Não há como saber de antemão '
                        'o que toca na hora.') from e
                raise RealDebridIndisponivel(
                    f'Não foi possível consultar o Real-Debrid: {e}') from e
            except httpx.HTTPError as e:
                raise RealDebridIndisponivel(
                    f'Não foi possível consultar o Real-Debrid: {e}') from e
            except ValueError as e:
                raise RealDebridIndisponivel(
                    'O Real-Debrid devolveu algo que não é JSON.') from e

            if not isinstance(dados, dict):
                continue
            for hash_val, info in dados.items():
                # Dicionário vazio quer dizer "conhecido, mas sem arquivo
                # cacheado" — só o preenchido conta como pronto.
                disponibilidade[hash_val.strip().lower()] = bool(info)

        return disponibilidade

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
    
    async def list_torrents_pagina(self, limit: int = 1000, page: int = 1) -> List[Dict]:
        """
        Uma página dos torrents da conta, com paginação e SEM engolir erro.

        `list_torrents` devolve `[]` quando a chamada falha, o que chega ao
        chamador idêntico a "a conta está vazia" — e tratar os dois igual faria
        toda cópia parecer ausente por causa de um blip de rede. Aqui a falha
        levanta.

        Um 404 na última página é o Real-Debrid dizendo "não há mais nada", não
        um erro: vira lista vazia e encerra a varredura.
        """
        try:
            response = await self.client.get(
                f"{self.BASE_URL}/torrents",
                params={'limit': limit, 'page': page})
            if response.status_code == 404:
                return []
            response.raise_for_status()
            dados = response.json()
        except httpx.HTTPError as e:
            raise RealDebridIndisponivel(
                f'Não foi possível listar os torrents da conta: {e}') from e
        except ValueError as e:
            raise RealDebridIndisponivel(
                'O Real-Debrid devolveu algo que não é JSON.') from e

        return dados if isinstance(dados, list) else []

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

def chave_do_usuario(user) -> str:
    """
    Chave do Real-Debrid válida para este usuário.

    A conta do usuário primeiro, a da instância depois. Numa cinemateca
    pessoal a chave normalmente mora só no .env, e cada caminho que olhasse
    apenas o campo do usuário desistiria em silêncio com a integração
    perfeitamente configurada — foi o que aconteceu com o download, a busca de
    torrents e a checagem de disponibilidade instantânea, enquanto a
    reprodução funcionava, porque só ela conhecia as duas fontes.
    """
    return getattr(user, 'realdebrid_api_key', '') or settings.REAL_DEBRID_API_KEY or ''
