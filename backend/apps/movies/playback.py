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
from apps.integrations.realdebrid import (RealDebridClient,
                                             chave_do_usuario)

logger = logging.getLogger(__name__)


@dataclass
class PlaybackSource:
    """Fonte resolvida, pronta para o player consumir."""

    source: str  # 'realdebrid' | 'jellyfin' | 'plex'
    stream_url: str
    label: str  # rótulo técnico para a UI, ex.: 'DIRECT PLAY'
    container: Optional[str] = None
    quality: str = ''
    # Qual cópia está tocando. A tela precisa saber para dizer, sem rodeios, o
    # que exatamente foi posto no ar.
    release_id: Optional[str] = None


async def _melhor_ja_na_conta(movie):
    return await sync_to_async(
        lambda: movie.torrent_releases.filter(in_realdebrid=True)
        .exclude(realdebrid_links=[])
        .order_by('-quality_score')
        .first()
    )()


async def _melhor_com_disponibilidade_imediata(movie):
    """
    A melhor cópia que o acervo do Real-Debrid já tem, mas que ainda não foi
    importada para a conta.

    É o caso que fazia o player dizer "nenhuma fonte disponível" com cinco
    cópias tocáveis na tela: sem estar na conta não há link, e o resolvedor
    parava aí. Importar uma que o Real-Debrid já tem leva ~2 segundos — menos
    do que o player levaria para carregar de qualquer jeito.
    """
    return await sync_to_async(
        lambda: movie.torrent_releases.filter(instantly_available=True)
        .exclude(magnet_link='')
        .order_by('-quality_score')
        .first()
    )()


async def _importa_para_a_conta(release, api_key) -> bool:
    """
    Traz a cópia para a conta e guarda os links. Devolve se conseguiu.

    Só faz sentido para quem já está no acervo do Real-Debrid: aí o
    `downloaded` volta na hora. Para o que não está, isto viraria uma espera
    indefinida dentro de um clique de play — por isso o torrent é REMOVIDO
    quando não vem pronto.
    """
    client = RealDebridClient(api_key)
    try:
        torrent_id = await client.add_magnet(release.magnet_link)
        info = await client.get_torrent_info(torrent_id)
        arquivos = info.get('files') or []
        if not arquivos:
            await client.delete_torrent(torrent_id)
            return False
        maior = max(arquivos, key=lambda f: f.get('bytes', 0))
        if not await client.select_files(torrent_id, [maior['id']]):
            await client.delete_torrent(torrent_id)
            return False

        depois = await client.get_torrent_info(torrent_id)
        if depois.get('status') != 'downloaded':
            await client.delete_torrent(torrent_id)
            return False

        release.in_realdebrid = True
        release.realdebrid_id = torrent_id
        release.realdebrid_status = 'downloaded'
        release.realdebrid_links = depois.get('links') or []
        release.realdebrid_progress = 100
        await sync_to_async(release.save)(update_fields=[
            'in_realdebrid', 'realdebrid_id', 'realdebrid_status',
            'realdebrid_links', 'realdebrid_progress'])
        return bool(release.realdebrid_links)
    finally:
        await client.close()


async def _from_realdebrid(movie, user, release_id=None) -> Optional[PlaybackSource]:
    """
    A melhor cópia que toca agora, importando-a se preciso.

    Duas camadas, nesta ordem:

      1. já na conta, com link — não custa nada;
      2. no acervo do Real-Debrid mas fora da conta — importa e toca, ~2s.

    A segunda é o conserto de um defeito visível: o player dizia "nenhuma fonte
    disponível" enquanto a tela mostrava cinco cópias com disponibilidade
    imediata. Ter o arquivo no acervo e ter link na conta são coisas
    diferentes, e só a segunda impedia tocar.

    `release_id` deixa a tela pedir uma cópia específica — é o que faz o selo
    de disponibilidade imediata virar um botão que toca AQUELA cópia.
    """
    api_key = chave_do_usuario(user)
    if not api_key:
        return None

    if release_id:
        release = await sync_to_async(
            lambda: movie.torrent_releases.filter(pk=release_id).first())()
        if not release:
            return None
        if not release.realdebrid_links and not await _importa_para_a_conta(
                release, api_key):
            return None
    else:
        release = await _melhor_ja_na_conta(movie)
        if not release:
            candidata = await _melhor_com_disponibilidade_imediata(movie)
            if candidata and await _importa_para_a_conta(candidata, api_key):
                release = candidata

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
        release_id=str(release.id),
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


async def resolve_playback(movie, user, release_id=None) -> Optional[PlaybackSource]:
    """
    Primeira fonte que responder, na ordem Real-Debrid > Jellyfin > Plex.
    Devolve None quando nenhuma tem o filme.

    Com `release_id`, a escolha é do usuário: ele apontou uma cópia na lista, e
    Jellyfin ou Plex não substituem aquela. Sem ele, vale a cadeia inteira.
    """
    if release_id:
        return await _from_realdebrid(movie, user, release_id=release_id)

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
