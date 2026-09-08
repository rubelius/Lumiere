"""
A busca de cópias de um filme, e o estado dela.

Existe um caminho só até o Prowlarr, e ele passa por aqui. Antes havia dois — a
view e a task de Celery —, escritos separadamente e já divergidos: a task não
checava o cache do Real-Debrid, não recalculava o resumo do filme, não
invalidava a ficha, e gravava o filme inteiro com um `save()` pelado. Quem
usasse um caminho ou outro obtinha resultados diferentes para o mesmo clique.

A busca leva de 40 a 100 segundos — medido nesta instalação, contra o Prowlarr
real. O gargalo é um indexador só, o "Generic Torznab", que aponta para o
endpoint agregado do Jackett e portanto espera todos os indexadores DELE; os
outros oito somados respondem em menos de 2 segundos. Não é um tempo que caiba
numa requisição HTTP, então a view enfileira e o cliente pergunta o estado.
"""

import logging
from datetime import timedelta

from asgiref.sync import async_to_sync, sync_to_async
from django.core.cache import cache
from django.utils import timezone

from apps.core.core_cache import CacheManager
from apps.integrations.prowlarr import ProwlarrClient
from apps.movies.models import TorrentRelease
from apps.movies.realdebrid_sync import atualiza_resumo
from apps.movies.utils import (calculate_quality_score, parse_quality_from_title,
                               passa_no_filtro)

logger = logging.getLogger(__name__)


# ── filtros ───────────────────────────────────────────────────────────────

# Estavam escritos duas vezes, em views.py e em tasks/torrents.py, iguais por
# coincidência e não por derivação.
FILTROS_PADRAO = {
    'min_resolution': '1080p',
    'prefer_remux': False,
    'require_advanced_audio': False,
    'min_seeders': 5,
}


def normaliza_filtros(bruto: dict | None) -> dict:
    """Os filtros do pedido sobre os padrões, com min_seeders sempre inteiro."""
    filtros = dict(FILTROS_PADRAO)
    for chave in FILTROS_PADRAO:
        if bruto and chave in bruto:
            filtros[chave] = bruto[chave]
    try:
        filtros['min_seeders'] = int(filtros['min_seeders'])
    except (TypeError, ValueError):
        filtros['min_seeders'] = FILTROS_PADRAO['min_seeders']
    return filtros


# ── o estado da busca ─────────────────────────────────────────────────────

CHAVE_ANDAMENTO = 'busca_releases:andamento:{}'
CHAVE_RESULTADO = 'busca_releases:resultado:{}'

# O andamento expira em 5 minutos. O número é escolhido contra
# SEGUNDOS_DE_ESPERA = 150.0 do ProwlarrClient, que vale POR CONSULTA e são
# duas em paralelo: 300s é folga sobre o pior caso. Mexer num sem o outro
# quebra em silêncio — a chave expiraria com a busca ainda viva, o botão
# destravaria e um segundo clique duplicaria o trabalho.
SEGUNDOS_DE_ANDAMENTO = 300

# O resultado fica uma hora: tempo de a pessoa fechar a aba, voltar, e ainda
# encontrar a resposta da busca que ela mesma disparou.
SEGUNDOS_DE_RESULTADO = 3600

# A partir daqui, "enfileirada" sem ninguém ter pegado é notícia.
SEGUNDOS_ATE_DESCONFIAR = 15

OCIOSA, ENFILEIRADA, BUSCANDO, CONCLUIDA, ERRO = (
    'ociosa', 'enfileirada', 'buscando', 'concluida', 'erro')


def documento(movie_id, **campos) -> dict:
    """
    O molde do estado. TODO documento tem TODAS as chaves, sempre.

    Os quatro contadores nascem None de propósito: "ainda não sei" não é zero
    nem é falso. `cache_check_failed`, em particular, tem três respostas —
    None é "ainda não perguntei", False é "perguntei e está tudo certo", True
    é "não deu para perguntar" — e as duas últimas já eram distintas no
    código que responde por elas.
    """
    base = {
        'movie_id': str(movie_id),
        'estado': OCIOSA,
        'iniciada_em': None,
        'concluida_em': None,
        'erro': None,
        'new_releases_found': None,
        'total_releases': None,
        'cache_check_failed': None,
        'consultas_falhas': [],
    }
    base.update(campos)
    return base


def estado_da_busca(movie_id) -> dict:
    """
    O que está acontecendo com a busca deste filme.

    O andamento sempre ganha do resultado: um resultado antigo nunca aparece
    por cima de uma busca em curso.
    """
    andamento = cache.get(CHAVE_ANDAMENTO.format(movie_id))
    if andamento:
        return andamento

    resultado = cache.get(CHAVE_RESULTADO.format(movie_id))
    if resultado:
        return resultado

    return documento(movie_id)


def marca_enfileirada(movie_id) -> dict | None:
    """
    Reivindica a busca deste filme. Devolve o documento, ou None se perdeu.

    `cache.add` é SETNX no Redis: atômico, e portanto o cadeado e o estado ao
    mesmo tempo. Dois cliques simultâneos, ou duas pessoas da casa no mesmo
    filme, resultam numa única ida ao Prowlarr.
    """
    doc = documento(movie_id, estado=ENFILEIRADA, iniciada_em=timezone.now().isoformat())
    # django_redis devolve bool aqui, não None.
    if cache.add(CHAVE_ANDAMENTO.format(movie_id), doc, SEGUNDOS_DE_ANDAMENTO):
        return doc
    return None


def marca_buscando(movie_id) -> dict:
    """
    O worker pegou o trabalho.

    É um estado separado de `enfileirada` porque a diferença entre os dois é
    justamente o que denuncia um worker fora do ar: aceito e ninguém pegou.
    Com um estado só, a tela passaria cinco minutos dizendo "vasculhando" sem
    ninguém vasculhando.
    """
    doc = documento(movie_id, estado=BUSCANDO, iniciada_em=timezone.now().isoformat())
    cache.set(CHAVE_ANDAMENTO.format(movie_id), doc, SEGUNDOS_DE_ANDAMENTO)
    return doc


def _encerra(movie_id, doc: dict) -> dict:
    """
    Grava o resultado e SÓ ENTÃO solta o andamento.

    Nesta ordem não existe instante em que a leitura responda "ociosa" no meio
    da transição.
    """
    cache.set(CHAVE_RESULTADO.format(movie_id), doc, SEGUNDOS_DE_RESULTADO)
    cache.delete(CHAVE_ANDAMENTO.format(movie_id))
    return doc


def grava_conclusao(movie_id, resultado: dict) -> dict:
    return _encerra(movie_id, documento(
        movie_id,
        estado=CONCLUIDA,
        concluida_em=timezone.now().isoformat(),
        new_releases_found=resultado.get('new_releases_found', 0),
        total_releases=resultado.get('total_releases', 0),
        cache_check_failed=resultado.get('cache_check_failed'),
        consultas_falhas=resultado.get('consultas_falhas') or [],
    ))


def grava_erro(movie_id, mensagem: str) -> dict:
    return _encerra(movie_id, documento(
        movie_id, estado=ERRO, concluida_em=timezone.now().isoformat(),
        erro=str(mensagem)))


def libera(movie_id) -> None:
    """Solta a reivindicação sem gravar resultado — o trabalho não começou."""
    cache.delete(CHAVE_ANDAMENTO.format(movie_id))


# ── a busca em si ─────────────────────────────────────────────────────────

QUANTAS_CHECAR_NO_REALDEBRID = 20


async def _marca_cacheadas(releases, user) -> bool:
    """
    Pergunta ao Real-Debrid quais destas cópias já estão cacheadas e grava.

    Devolve True quando a consulta NÃO pôde ser feita. Quem chama precisa
    dessa distinção: "conferi e nenhuma está pronta" e "não consegui
    conferir" desenham telas diferentes, e tratá-las igual faria o acervo
    parecer offline por causa de um blip de rede.
    """
    from apps.integrations.realdebrid import (RealDebridClient,
                                              RealDebridIndisponivel,
                                              chave_do_usuario)

    chave = chave_do_usuario(user)
    hashes = [r.info_hash for r in releases if r.info_hash]
    if not (chave and hashes):
        return False

    cliente = RealDebridClient(chave)
    try:
        cacheadas = await cliente.check_instant_availability(hashes)
    except RealDebridIndisponivel as e:
        logger.warning('Não deu para checar o cache do Real-Debrid: %s', e)
        return True
    finally:
        await cliente.close()

    agora = timezone.now()
    for release in releases:
        release.instantly_available = cacheadas.get((release.info_hash or '').lower(), False)
        release.instant_check_at = agora

    await sync_to_async(TorrentRelease.objects.bulk_update)(
        releases, ['instantly_available', 'instant_check_at'])
    return False


async def _pergunta_ao_prowlarr(movie, user):
    """
    Uma consulta ao Prowlarr, do início ao fim, dentro de UM loop só.

    Cada `async_to_sync` abre e FECHA o próprio event loop. Com a busca numa
    chamada e o `close()` em outra, o cliente httpx nascia no primeiro loop e
    era fechado a partir do segundo — "Event loop is closed", verificado ao
    vivo contra o Prowlarr real. O cliente precisa viver e morrer no mesmo
    loop, e é isso que esta função garante.
    """
    cliente = ProwlarrClient(user.prowlarr_url, user.prowlarr_api_key)
    try:
        resultados = await cliente.search_movie(
            title=movie.title, year=movie.year, imdb_id=movie.imdb_id,
            original_title=movie.original_title)
        return resultados, list(cliente.consultas_falhas)
    finally:
        await cliente.close()


def executa_busca(movie, user, filtros: dict | None = None) -> dict:
    """
    Procura cópias, grava o que achou e deixa o filme coerente.

    Levanta ProwlarrIndisponivel quando a busca não pôde ser feita — quem
    trata é a task, que transforma isso num documento de erro legível.
    """
    filtros = normaliza_filtros(filtros)

    resultados, consultas_falhas = async_to_sync(_pergunta_ao_prowlarr)(movie, user)

    novas = 0
    for resultado in resultados:
        resultado.update(parse_quality_from_title(resultado['title']))
        resultado.update(calculate_quality_score(resultado))

        if not passa_no_filtro(resultado, filtros):
            continue

        _, criada = TorrentRelease.objects.update_or_create(
            info_hash=resultado['info_hash'],
            defaults={'movie': movie, **resultado},
        )
        if criada:
            novas += 1

    melhores = list(TorrentRelease.objects.filter(movie=movie)
                    .order_by('-quality_score')[:QUANTAS_CHECAR_NO_REALDEBRID])
    cache_falhou = async_to_sync(_marca_cacheadas)(melhores, user)

    atualiza_resumo(movie)

    # A invalidação vai por ÚLTIMO, e isso é conserto, não detalhe. A view
    # invalidava a ficha ANTES da busca e só recalculava o resumo 40 a 100
    # segundos depois; `retrieve` repopula a chave com TTL de uma hora, e
    # best_releases, available_instantly e best_quality_available estão na
    # parte estável. Qualquer GET nessa janela congelava dados velhos por uma
    # hora inteira.
    CacheManager.invalidate_movie(str(movie.id))

    total = TorrentRelease.objects.filter(movie=movie).count()
    logger.info('Busca em %r: %d cópias no acervo, %d novas', movie.title, total, novas)

    return {
        'new_releases_found': novas,
        'total_releases': total,
        'cache_check_failed': cache_falhou,
        'consultas_falhas': consultas_falhas,
    }
