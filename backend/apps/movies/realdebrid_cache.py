"""
Este magnet toca agora, ou o Real-Debrid vai ter que baixá-lo?

É a pergunta que importa na hora de escolher uma cópia, e é diferente de "está
na minha conta". Um torrent pode estar na conta e ainda assim ter levado horas
para chegar lá; e um que nunca foi pedido pode tocar em dois segundos porque
outra pessoa já o baixou pelo Real-Debrid algum dia.

A rota que respondia isso — `/torrents/instantAvailability` — foi desativada
pelo provedor: 403 com `{'error': 'disabled_endpoint', 'error_code': 37}` para
qualquer chave válida. Não há substituto declarado.

Mas há uma resposta observável, e ela é rápida. Medido contra a API real:

  cacheado      addMagnet devolve os arquivos NA HORA (o Real-Debrid já tem os
                metadados), e selectFiles leva o torrent a `downloaded` com
                link. Total: 1,7 segundo.

  não cacheado  o torrent fica em `magnet_conversion` sem arquivo nenhum,
                enquanto o Real-Debrid tenta achar os metadados na rede. Não
                resolve em segundos, e pode nunca resolver.

Então a sondagem é: adiciona, espera pouco pelos arquivos, escolhe, olha o
estado. E remove o que não estava cacheado — a conta é do usuário, e sondar não
pode virar lixo lá dentro.
"""

import asyncio
import logging

from asgiref.sync import async_to_sync
from django.core.cache import cache

from apps.integrations.realdebrid import (RealDebridClient, RealDebridIndisponivel,
                                          chave_do_usuario)

logger = logging.getLogger(__name__)

CACHEADO = 'cacheado'
NAO_CACHEADO = 'nao_cacheado'
INDETERMINADO = 'indeterminado'

CHAVE = 'rd_cache:{}'

# Seis horas. O que está no acervo do Real-Debrid raramente sai de lá, e a
# resposta custa uma ida à API mais uma linha temporária na conta do usuário —
# não é coisa de refazer a cada abertura de página.
SEGUNDOS_DE_RESPOSTA = 6 * 3600

# Quanto esperar pelos metadados antes de desistir. O caso cacheado responde em
# menos de dois segundos; esperar mais é esperar por um download que não vai
# acontecer enquanto alguém olha a tela.
SEGUNDOS_ESPERANDO_ARQUIVOS = 6.0
INTERVALO_DE_ESPERA = 0.7

# Quantas cópias sondar de uma vez ao abrir a ficha. Cada sondagem cria e
# desfaz uma linha na conta do usuário, então o número é pequeno de propósito:
# são as melhores pela nota, que é onde a escolha realmente acontece.
QUANTAS_SONDAR = 5

# Pausa entre uma sondagem e a seguinte. Cinco de uma vez tomaram
# `429 Too Many Requests` do Real-Debrid em addMagnet — o provedor limita a
# taxa, e este é o preço de respeitar o limite sem precisar adivinhá-lo.
SEGUNDOS_ENTRE_SONDAGENS = 1.5

ESTADOS_PRONTOS = ('downloaded',)


def resposta_guardada(info_hash: str) -> str | None:
    return cache.get(CHAVE.format((info_hash or '').lower()))


def guarda(info_hash: str, resposta: str) -> None:
    cache.set(CHAVE.format((info_hash or '').lower()), resposta, SEGUNDOS_DE_RESPOSTA)


async def _sonda(cliente: RealDebridClient, magnet: str) -> tuple:
    """
    Devolve (resposta, torrent_id). O id volta para quem precisar limpar.

    Só o chamador sabe se pode remover: um torrent que JÁ estava na conta antes
    da sondagem não é nosso para apagar.
    """
    torrent_id = await cliente.add_magnet(magnet)

    espera = 0.0
    arquivos = []
    while espera < SEGUNDOS_ESPERANDO_ARQUIVOS:
        info = await cliente.get_torrent_info(torrent_id)
        estado = info.get('status')
        arquivos = info.get('files') or []
        if arquivos:
            break
        if estado in ('error', 'magnet_error', 'virus', 'dead'):
            return NAO_CACHEADO, torrent_id
        await asyncio.sleep(INTERVALO_DE_ESPERA)
        espera += INTERVALO_DE_ESPERA

    if not arquivos:
        # Preso em magnet_conversion: o Real-Debrid não tem os metadados e está
        # procurando na rede. Não é "não cacheado" com certeza — é não saber.
        return INDETERMINADO, torrent_id

    maior = max(arquivos, key=lambda f: f.get('bytes', 0))
    await cliente.select_files(torrent_id, [maior['id']])

    depois = await cliente.get_torrent_info(torrent_id)
    if depois.get('status') in ESTADOS_PRONTOS:
        return CACHEADO, torrent_id
    return NAO_CACHEADO, torrent_id


async def _sonda_e_limpa(chave_api: str, magnet: str, ja_estava_na_conta: bool) -> str:
    cliente = RealDebridClient(chave_api)
    torrent_id = None
    try:
        resposta, torrent_id = await _sonda(cliente, magnet)
        return resposta
    except RealDebridIndisponivel as e:
        logger.warning('Sondagem de cache falhou: %s', e)
        return INDETERMINADO
    except Exception as e:
        logger.warning('Sondagem de cache falhou de forma inesperada: %s', e)
        return INDETERMINADO
    finally:
        # A conta é do usuário. O que a sondagem criou, a sondagem desfaz —
        # exceto quando o torrent já estava lá antes de nós.
        if torrent_id and not ja_estava_na_conta:
            try:
                await cliente.delete_torrent(torrent_id)
            except Exception as e:
                logger.warning('Não deu para remover o torrent de sondagem %s: %s',
                               torrent_id, e)
        await cliente.close()


def estado_de_cache(release, user, refazer: bool = False) -> str:
    """
    Se este magnet toca agora, precisa ser baixado, ou não deu para saber.

    Uma cópia que já está na conta E concluída responde sozinha: existe link,
    logo toca. Para as demais, sonda — e a resposta fica guardada seis horas,
    porque cada sondagem custa uma ida à API e uma linha temporária na conta.
    """
    if release.in_realdebrid and release.realdebrid_status in ESTADOS_PRONTOS \
            and release.realdebrid_links:
        return CACHEADO

    if not release.magnet_link:
        return INDETERMINADO

    if not refazer:
        guardada = resposta_guardada(release.info_hash)
        if guardada:
            return guardada

    chave_api = chave_do_usuario(user)
    if not chave_api:
        return INDETERMINADO

    resposta = async_to_sync(_sonda_e_limpa)(
        chave_api, release.magnet_link, bool(release.in_realdebrid))

    # Indeterminado não é guardado: não saber hoje não é motivo para não
    # perguntar de novo amanhã.
    if resposta != INDETERMINADO:
        guarda(release.info_hash, resposta)
    return resposta


def sonda_as_melhores(movie, user, quantas: int = QUANTAS_SONDAR) -> dict:
    """
    Descobre quais das melhores cópias deste filme tocam agora.

    Só as melhores pela nota, e não todas: cada sondagem cria e desfaz uma
    linha na conta do usuário, e é no topo da lista que a escolha acontece de
    verdade. Quem já tem resposta guardada não é sondado de novo.

    Devolve o que mudou, para a tela saber se vale reler a ficha.
    """
    from django.utils import timezone

    from apps.movies.models import TorrentRelease
    from apps.movies.realdebrid_sync import atualiza_resumo

    candidatas = list(
        TorrentRelease.objects.filter(movie=movie)
        .exclude(magnet_link='')
        .order_by('-quality_score', '-seeders')[:quantas]
    )

    agora = timezone.now()
    respostas = _sonda_uma_a_uma(candidatas, user)

    mudou = []
    for release in candidatas:
        resposta = respostas[str(release.id)]
        cacheada = resposta == CACHEADO
        # Escrito nos dois sentidos: um `indeterminado` não derruba uma marca
        # anterior, mas um `nao_cacheado` derruba. Sem isso seria mais uma
        # flag que só sobe.
        if resposta == INDETERMINADO:
            continue
        if release.instantly_available != cacheada or release.instant_check_at is None:
            release.instantly_available = cacheada
            release.instant_check_at = agora
            mudou.append(release)

    if mudou:
        TorrentRelease.objects.bulk_update(
            mudou, ['instantly_available', 'instant_check_at'])
        atualiza_resumo(movie)

    return {'sondadas': len(candidatas), 'mudaram': len(mudou), 'respostas': respostas}


def _sonda_uma_a_uma(candidatas, user) -> dict:
    """
    Sonda as cópias em fila, com pausa entre elas.

    Paralelizar seria o óbvio — são independentes e passam o tempo esperando a
    rede —, e foi o que tentei primeiro: cinco de uma vez tomaram
    `429 Too Many Requests` do Real-Debrid em `addMagnet`. O provedor limita a
    taxa, e a pausa aqui é o que respeita esse limite sem precisar adivinhá-lo.

    Quem já tem resposta guardada, ou responde sozinha por estar na conta, nem
    chega a ir à rede.
    """
    respostas, a_sondar = {}, []
    for release in candidatas:
        if release.in_realdebrid and release.realdebrid_status in ESTADOS_PRONTOS \
                and release.realdebrid_links:
            respostas[str(release.id)] = CACHEADO
            continue
        if not release.magnet_link:
            respostas[str(release.id)] = INDETERMINADO
            continue
        guardada = resposta_guardada(release.info_hash)
        if guardada:
            respostas[str(release.id)] = guardada
            continue
        a_sondar.append(release)

    chave_api = chave_do_usuario(user)
    if not chave_api:
        for release in a_sondar:
            respostas[str(release.id)] = INDETERMINADO
        return respostas

    async def em_fila():
        saida = []
        for i, release in enumerate(a_sondar):
            if i:
                await asyncio.sleep(SEGUNDOS_ENTRE_SONDAGENS)
            try:
                saida.append(await _sonda_e_limpa(
                    chave_api, release.magnet_link, bool(release.in_realdebrid)))
            except Exception as e:
                logger.warning('Sondagem de %s falhou: %s', release.info_hash[:12], e)
                saida.append(INDETERMINADO)
        return saida

    for release, resposta in zip(a_sondar, async_to_sync(em_fila)()):
        respostas[str(release.id)] = resposta
        if resposta != INDETERMINADO:
            guarda(release.info_hash, resposta)

    return respostas
