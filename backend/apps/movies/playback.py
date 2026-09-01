"""
Resolução da fonte de reprodução de um filme.

A ordem é deliberada e não deve ser reordenada sem decisão de produto:

  1. Real-Debrid — o release do acervo já em cache. É a fonte de maior
     fidelidade (REMUX/HDR/Atmos vieram da curadoria de qualidade) e não
     depende de o servidor de casa estar ligado.
  2. Jellyfin    — a biblioteca local.
  3. Plex        — a biblioteca legada.

Cada degrau é isolado: um Jellyfin fora do ar não pode impedir a queda para o
Plex. Por isso cada resolvedor é chamado dentro de try/except e uma falha vira
apenas "esta fonte não serve".
"""

import logging
from dataclasses import dataclass
from typing import Callable, List, Optional

from asgiref.sync import sync_to_async
from django.conf import settings

from apps.integrations.jellyfin import JellyfinClient
from apps.integrations.plex import PlexClient
from apps.integrations.realdebrid import RealDebridClient

logger = logging.getLogger(__name__)


@dataclass
class PlaybackSource:
    """Fonte resolvida, pronta para o player consumir."""

    source: str  # 'realdebrid' | 'jellyfin' | 'plex'
    stream_url: str
    label: str  # rótulo técnico para a UI, ex.: 'DIRECT PLAY'
    container: Optional[str] = None
    quality: str = ''


async def _from_realdebrid(movie, user) -> Optional[PlaybackSource]:
    """Melhor release do acervo já presente no Real-Debrid."""
    api_key = getattr(user, 'realdebrid_api_key', '') or settings.REAL_DEBRID_API_KEY
    if not api_key:
        return None

    release = await sync_to_async(
        lambda: movie.torrent_releases.filter(in_realdebrid=True)
        .exclude(realdebrid_links=[])
        .order_by('-quality_score')
        .first()
    )()
    if not release or not release.realdebrid_links:
        return None

    client = RealDebridClient(api_key)
    try:
        # Os links guardados são restritos; só o unrestrict devolve uma URL
        # que a tag <video> consegue tocar.
        unrestricted = await client.unrestrict_link(release.realdebrid_links[0])
    finally:
        await client.close()

    if not unrestricted or not unrestricted.get('download'):
        return None

    return PlaybackSource(
        source='realdebrid',
        stream_url=unrestricted['download'],
        label='DIRECT PLAY',
        container=(unrestricted.get('filename') or '').rsplit('.', 1)[-1] or None,
        quality=release.title or '',
    )


async def _from_jellyfin(movie, user) -> Optional[PlaybackSource]:
    """Biblioteca Jellyfin do usuário."""
    server = getattr(user, 'jellyfin_server_url', '')
    token = getattr(user, 'jellyfin_token', '')
    if not (server and token):
        return None

    client = JellyfinClient(server, token, getattr(user, 'jellyfin_user_id', ''))
    try:
        # Bibliotecas locais costumam usar o título original; o nosso `title`
        # é o traduzido, então vale tentar os dois.
        item = await client.search_movie(movie.title, movie.year)
        if not item and movie.original_title and movie.original_title != movie.title:
            item = await client.search_movie(movie.original_title, movie.year)
        if not item:
            return None

        return PlaybackSource(
            source='jellyfin',
            stream_url=client.build_stream_url(item['id']),
            label='JELLYFIN DIRECT',
            container=item.get('container'),
        )
    finally:
        await client.close()


async def _from_plex(movie, user) -> Optional[PlaybackSource]:
    """Biblioteca Plex do usuário."""
    server = getattr(user, 'plex_server_url', '')
    token = getattr(user, 'plex_token', '')
    if not (server and token):
        return None

    client = PlexClient(server, token)
    try:
        resultados = await client.search_movie(movie.title, movie.year)
        if not resultados and movie.original_title and movie.original_title != movie.title:
            resultados = await client.search_movie(movie.original_title, movie.year)
        if not resultados:
            return None

        metadata = await client.get_movie_metadata(resultados[0]['rating_key'])
        parts = (metadata or {}).get('parts') or []
        chave = next((p.get('key') for p in parts if p.get('key')), None)
        if not chave:
            return None

        # O token vai na query porque a tag <video> não manda cabeçalhos.
        separador = '&' if '?' in chave else '?'
        return PlaybackSource(
            source='plex',
            stream_url=f"{server.rstrip('/')}{chave}{separador}X-Plex-Token={token}",
            label='PLEX DIRECT',
            container=parts[0].get('container'),
        )
    finally:
        await client.close()


# A ordem desta tupla É a regra de negócio.
RESOLVEDORES: List[Callable] = [_from_realdebrid, _from_jellyfin, _from_plex]


async def resolve_playback(movie, user) -> Optional[PlaybackSource]:
    """
    Primeira fonte que responder, na ordem Real-Debrid > Jellyfin > Plex.
    Devolve None quando nenhuma tem o filme.
    """
    for resolvedor in RESOLVEDORES:
        try:
            fonte = await resolvedor(movie, user)
        except Exception:
            # Uma fonte quebrada não pode derrubar a cadeia inteira.
            logger.exception('Falha ao resolver playback em %s', resolvedor.__name__)
            continue
        if fonte:
            return fonte
    return None
