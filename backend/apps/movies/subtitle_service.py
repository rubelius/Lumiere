"""
Busca e entrega de legendas externas.

O navegador não consegue falar direto com o OpenSubtitles: a busca exige
cabeçalhos de API que a tag <track> não manda, o download exige token de
usuário, e o arquivo vem em SRT, que o <track> não lê. Por isso o backend
intermedia e devolve WebVTT pronto.
"""

import logging
from typing import Dict, List, Optional

from apps.integrations.opensubtitles import OpenSubtitlesClient
from apps.movies.subtitles import srt_para_vtt

logger = logging.getLogger(__name__)


def _credenciais(user):
    return (
        getattr(user, 'opensubtitles_api_key', '') or '',
        getattr(user, 'opensubtitles_token', '') or '',
    )


async def busca_legendas(movie, user, idiomas: str) -> List[Dict]:
    api_key, token = _credenciais(user)
    if not api_key:
        return []

    cliente = OpenSubtitlesClient(api_key, token)
    try:
        return await cliente.buscar(
            imdb_id=movie.imdb_id or None,
            titulo=movie.original_title or movie.title,
            ano=movie.year,
            idiomas=idiomas,
        )
    finally:
        await cliente.close()


async def obtem_vtt(user, file_id: int) -> Optional[str]:
    """
    Baixa a legenda e devolve em WebVTT.

    Devolve None quando a conta não está conectada: baixar consome a cota
    diária e exige token de usuário, que a chave da aplicação não substitui.
    """
    api_key, token = _credenciais(user)
    if not (api_key and token):
        return None

    cliente = OpenSubtitlesClient(api_key, token)
    try:
        link = await cliente.link_de_download(file_id)
        if not link:
            return None
        conteudo = await cliente.baixar_conteudo(link)
        return srt_para_vtt(conteudo) if conteudo else None
    finally:
        await cliente.close()
