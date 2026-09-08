"""
O que a conta do Real-Debrid tem, agora.

Substitui a checagem de cache que o provedor desativou. Até aqui o projeto
perguntava a `/torrents/instantAvailability` se um hash estava no acervo do
Real-Debrid; essa rota responde 403 com `{'error': 'disabled_endpoint',
'error_code': 37}` para qualquer chave válida — verificado nesta conta, cujo
`/user` e `/torrents` respondem 200. Não há substituto: o Real-Debrid removeu a
capacidade de saber de antemão o que tocaria na hora.

A pergunta que ele AINDA responde é outra, e é a que interessa na tela: isto
está na MINHA conta, e em que pé está? `/torrents` devolve hash, status,
progresso e links. Com isso a cópia é `pronta`, `baixando` ou `ausente` — e
`ausente` é um convite a importar, não uma sentença.

A conta desta instalação tem 2.071 torrents, e a varredura completa leva ~3
segundos em três páginas de mil. Caro demais por abertura de página, então o
mapa fica guardado por alguns minutos: quem abre o segundo filme não paga nada.
"""

import logging

from asgiref.sync import async_to_sync
from django.core.cache import cache
from django.utils import timezone

from apps.integrations.realdebrid import (RealDebridClient, RealDebridIndisponivel,
                                          chave_do_usuario)
from apps.movies.models import TorrentRelease
from apps.movies.realdebrid_sync import atualiza_resumo

logger = logging.getLogger(__name__)

CHAVE_DO_MAPA = 'realdebrid:conta:{}'

# Cinco minutos. A conta muda quando alguém importa algo, e a importação
# atualiza a linha diretamente — o mapa só precisa cobrir o que foi feito por
# fora do Lumière.
SEGUNDOS_DE_MAPA = 300

# O `/torrents` aceita até mil por página. Com 2.071 na conta são três voltas.
POR_PAGINA = 1000
PAGINAS_NO_MAXIMO = 10

ESTADOS_VIVOS = ('downloaded', 'downloading', 'queued', 'magnet_conversion',
                 'waiting_files_selection', 'compressing', 'uploading')


async def _todas_as_paginas(chave: str) -> list:
    cliente = RealDebridClient(chave)
    try:
        tudo, pagina = [], 1
        while pagina <= PAGINAS_NO_MAXIMO:
            lote = await cliente.list_torrents_pagina(limit=POR_PAGINA, page=pagina)
            tudo.extend(lote)
            if len(lote) < POR_PAGINA:
                break
            pagina += 1
        return tudo
    finally:
        await cliente.close()


def mapa_da_conta(user, refazer: bool = False) -> dict | None:
    """
    hash em minúsculas -> {status, progress, links}, para a conta deste usuário.

    Devolve None quando a consulta não pôde ser feita. É diferente de `{}`, que
    quer dizer "a conta está vazia": tratar os dois igual faria toda cópia
    parecer ausente por causa de um blip de rede, e o botão de importar
    apareceria em cima do que já está lá.
    """
    chave_api = chave_do_usuario(user)
    if not chave_api:
        return None

    chave_cache = CHAVE_DO_MAPA.format(getattr(user, 'id', 'anon'))
    if not refazer:
        guardado = cache.get(chave_cache)
        if guardado is not None:
            return guardado

    try:
        torrents = async_to_sync(_todas_as_paginas)(chave_api)
    except RealDebridIndisponivel as e:
        logger.warning('Não deu para ler a conta do Real-Debrid: %s', e)
        return None
    except Exception as e:
        logger.warning('Falha inesperada ao ler a conta do Real-Debrid: %s', e)
        return None

    # 103 dos 2.071 torrents desta conta repetem hash — o mesmo arquivo
    # adicionado mais de uma vez. Vence o melhor: concluído com links ganha de
    # concluído sem links, que ganha de qualquer outro estado. Deixar a última
    # ocorrência vencer faria uma reimportação em andamento esconder a cópia
    # que já estava pronta.
    def peso(entrada) -> tuple:
        concluido = entrada['status'] == 'downloaded'
        return (concluido, bool(entrada['links']), entrada['progress'])

    mapa = {}
    for t in torrents:
        h = (t.get('hash') or '').strip().lower()
        if not h:
            continue
        entrada = {
            'id': t.get('id') or '',
            'status': t.get('status') or '',
            'progress': int(float(t.get('progress') or 0)),
            'links': t.get('links') or [],
        }
        anterior = mapa.get(h)
        if anterior is None or peso(entrada) > peso(anterior):
            mapa[h] = entrada

    cache.set(chave_cache, mapa, SEGUNDOS_DE_MAPA)
    logger.info('Conta do Real-Debrid: %d torrents mapeados', len(mapa))
    return mapa


def sincroniza_filme(movie, user, refazer: bool = False) -> bool:
    """
    Alinha as cópias deste filme com o que a conta do Real-Debrid tem.

    Devolve True quando a consulta NÃO pôde ser feita — a tela precisa poder
    dizer "não consegui perguntar" em vez de afirmar que nada está lá.
    """
    mapa = mapa_da_conta(user, refazer=refazer)
    if mapa is None:
        return True

    releases = list(TorrentRelease.objects.filter(movie=movie))
    if not releases:
        return False

    agora = timezone.now()
    mudou = []
    for r in releases:
        na_conta = mapa.get((r.info_hash or '').lower())

        # Escrito nos DOIS sentidos: some da conta, some da tela. Era este o
        # padrão que fez `in_realdebrid` virar flag que só sobe.
        r.in_realdebrid = bool(na_conta)
        r.realdebrid_id = (na_conta or {}).get('id', '') if na_conta else ''
        r.realdebrid_status = (na_conta or {}).get('status', '') if na_conta else ''
        r.realdebrid_progress = (na_conta or {}).get('progress', 0) if na_conta else 0
        r.realdebrid_links = (na_conta or {}).get('links', []) if na_conta else []
        r.instant_check_at = agora
        mudou.append(r)

    TorrentRelease.objects.bulk_update(mudou, [
        'in_realdebrid', 'realdebrid_id', 'realdebrid_status',
        'realdebrid_progress', 'realdebrid_links', 'instant_check_at'])

    atualiza_resumo(movie)
    return False
