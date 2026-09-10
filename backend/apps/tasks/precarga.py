"""
O rastreador que enche o banco de cópias antes de alguém precisar delas.

O PROBLEMA QUE ELE RESOLVE: abrir a ficha de um filme e esperar. Medido nesta
instalação, uma busca leva 144 segundos — 40 a 100 no Prowlarr, por causa de um
indexador que agrega outros, mais ~24 sondando o Real-Debrid. Ninguém deveria
ver isso acontecer.

POR QUE NÃO É UM JOB DE UMA VEZ: são 25.908 filmes na base. A 144 segundos
cada, uma varredura em série leva 1.036 horas — 43 dias — martelando o Prowlarr
sem parar. Nenhum indexador tolera isso, e no fim do mês o resultado do começo
já estaria velho. Então isto não é um job que termina: é um rastreador que roda
sempre, em rodadas pequenas, e nunca compete com alguém que está esperando.

A ORDEM É A DECISÃO DE PRODUTO. Varrer 25.908 filmes em ordem alfabética
gastaria semanas em filmes que ninguém vai abrir. A fila é:

  1. quem tem ficha aberta agora (pedido explícito, entra na frente)
  2. nunca varrido E bem colocado no ranking — é o que o acervo mostra primeiro
  3. nunca varrido, o resto
  4. varrido faz tempo, o mais velho primeiro

Quem já foi varrido recentemente não volta à fila: sem essa trava a rodada
seguinte recomeçaria pelos mesmos filmes para sempre.
"""

import logging

from celery import shared_task
from django.core.cache import cache
from django.db.models import Q
from django.utils import timezone

from apps.integrations.prowlarr import ProwlarrIndisponivel
from apps.movies.models import Movie
from apps.movies.release_search import (executa_busca, grava_conclusao,
                                        grava_erro, marca_buscando,
                                        marca_enfileirada)

logger = logging.getLogger(__name__)

# Quantos filmes por rodada. Cada um custa ~120 segundos sem a sondagem do
# Real-Debrid, então quatro enchem os dez minutos entre uma rodada e a
# seguinte sem deixar trabalho acumulado na fila.
POR_RODADA = 4

# Depois disto, o que se sabe sobre um filme está velho o bastante para
# perguntar de novo. Sete dias é o intervalo em que aparecem cópias novas de um
# filme antigo — que é o acervo inteiro aqui.
DIAS_ATE_VENCER = 7

# Uma rodada por vez. O beat dispara de dez em dez minutos e uma rodada leva
# ~8; sem o cadeado, uma rodada lenta faria a seguinte varrer os mesmos filmes,
# porque `copias_buscadas_em` só é gravado no fim de cada busca.
CHAVE_DA_RODADA = 'rastreio_de_copias:rodando'
SEGUNDOS_DE_CADEADO = 60 * 25

# A fila de quem tem ficha aberta. Vive no Redis e não no banco porque é
# efêmera: o que importa é "alguém está olhando este filme agora".
CHAVE_DA_FILA = 'rastreio_de_copias:pedidos'
SEGUNDOS_DE_PEDIDO = 60 * 30


def pede_prioridade(movie_id) -> None:
    """
    Põe este filme na frente da fila do rastreador.

    Chamado quando alguém abre uma ficha que ainda não tem cópias: em vez de a
    pessoa esperar 144 segundos olhando um botão, o filme é varrido na próxima
    rodada — e a tela avisa que está vindo.
    """
    fila = cache.get(CHAVE_DA_FILA) or []
    if str(movie_id) in fila:
        return
    # No fim: quem pediu primeiro é atendido primeiro.
    cache.set(CHAVE_DA_FILA, [*fila, str(movie_id)], SEGUNDOS_DE_PEDIDO)

    # E uma rodada é disparada AGORA. Esperar o beat seria trocar a espera de
    # 144 segundos por outra de até dez minutos. Se já houver rodada em curso,
    # o cadeado faz esta voltar na hora, e o pedido fica na fila para a
    # próxima — que começa em no máximo dez minutos.
    try:
        rastreia_copias.delay()
    except Exception:
        # Sem broker não há rastreio, mas o pedido fica registrado e a próxima
        # rodada o encontra. Derrubar a abertura da ficha por causa disto
        # seria trocar um defeito pequeno por um grande.
        logger.warning('Não foi possível disparar o rastreio para %s', movie_id)


def _tira_da_fila(quantos: int) -> list:
    fila = cache.get(CHAVE_DA_FILA) or []
    if not fila:
        return []
    atendidos, resto = fila[:quantos], fila[quantos:]
    cache.set(CHAVE_DA_FILA, resto, SEGUNDOS_DE_PEDIDO)
    return atendidos


def proximos_da_fila(quantos: int = POR_RODADA) -> list:
    """
    Quais filmes varrer nesta rodada, na ordem que importa.

    Devolve objetos Movie. Um filme pedido explicitamente entra mesmo que tenha
    sido varrido há pouco: quem abriu a ficha quer o que existe agora.
    """
    escolhidos, vistos = [], set()

    for movie_id in _tira_da_fila(quantos):
        filme = Movie.objects.filter(pk=movie_id).first()
        if filme:
            escolhidos.append(filme)
            vistos.add(filme.pk)

    faltam = quantos - len(escolhidos)
    if faltam <= 0:
        return escolhidos

    vencidos = timezone.now() - timezone.timedelta(days=DIAS_ATE_VENCER)

    # Nulos primeiro, e depois os mais velhos. `F('...').asc(nulls_first=True)`
    # é o que garante isso no Postgres: por padrão ele ordena NULL por ÚLTIMO
    # no ascendente, e o rastreador começaria pelos já varridos.
    #
    # `ranking_current` nulo também vai para o fim: um filme sem ranking é um
    # filme que a home não mostra.
    from django.db.models import F

    candidatos = (
        Movie.objects
        .filter(Q(copias_buscadas_em__isnull=True) | Q(copias_buscadas_em__lt=vencidos))
        .exclude(pk__in=vistos)
        .order_by(F('copias_buscadas_em').asc(nulls_first=True),
                  F('ranking_current').asc(nulls_last=True),
                  'pk')[:faltam]
    )
    return [*escolhidos, *candidatos]


@shared_task
def rastreia_copias(quantos: int = POR_RODADA, user_id=None):
    """
    Uma rodada do rastreamento.

    Não sonda o Real-Debrid: ver `executa_busca(sondar=...)`. O que a pré-carga
    quer é ter as cópias e as notas no banco; se uma cópia toca AGORA é
    pergunta perecível, respondida quando alguém abre a ficha.

    Uma falha em um filme não derruba a rodada. Um Prowlarr fora do ar, sim:
    sem ele os 25.908 filmes seriam marcados como varridos sem nada terem
    encontrado, e o rastreador só voltaria a eles daqui a uma semana.
    """
    if not cache.add(CHAVE_DA_RODADA, '1', SEGUNDOS_DE_CADEADO):
        return {'pulou': 'rodada anterior ainda rodando'}

    try:
        user = _quem_busca(user_id)
        if not user:
            return {'pulou': 'ninguém com Prowlarr configurado'}

        filmes = proximos_da_fila(quantos)
        if not filmes:
            return {'varridos': 0, 'nada': 'a fila está vazia'}

        varridos, falhas, novas, ocupados = 0, 0, 0, 0
        for filme in filmes:
            # O MESMO cadeado do botão, e não um paralelo.
            #
            # `marca_enfileirada` é um SETNX no Redis: ou o rastreador
            # reivindica este filme, ou alguém já está buscando por ele. Com
            # dois cadeados diferentes, um clique e uma rodada disparariam duas
            # buscas simultâneas no mesmo filme — duas idas ao Prowlarr, e as
            # duas gravando as mesmas cópias.
            if not marca_enfileirada(filme.pk):
                ocupados += 1
                continue

            # E o mesmo documento de estado: assim a tela de quem abriu a ficha
            # mostra "vasculhando" enquanto o rastreador trabalha, em vez de um
            # botão parado sobre um filme sem cópia nenhuma.
            marca_buscando(str(filme.pk))

            try:
                resultado = executa_busca(filme, user, sondar=False)
            except ProwlarrIndisponivel as erro:
                # Interrompe a rodada inteira: continuar marcaria os filmes
                # seguintes como varridos sem terem sido.
                grava_erro(str(filme.pk), str(erro))
                logger.warning('Rastreio interrompido, Prowlarr fora: %s', erro)
                return {'varridos': varridos, 'novas': novas,
                        'interrompido': 'prowlarr indisponível'}
            except Exception as erro:
                logger.exception('Rastreio falhou em %s', filme.pk)
                grava_erro(str(filme.pk), str(erro))
                falhas += 1
                continue

            grava_conclusao(str(filme.pk), resultado)
            varridos += 1
            novas += resultado.get('new_releases_found') or 0

        logger.info('Rastreio: %d filmes, %d cópias novas, %d falhas',
                    varridos, novas, falhas)
        return {'varridos': varridos, 'novas': novas, 'falhas': falhas,
                'ocupados': ocupados}
    finally:
        cache.delete(CHAVE_DA_RODADA)


def _quem_busca(user_id=None):
    """
    Em nome de quem o rastreador fala com o Prowlarr.

    O Prowlarr é por usuário no modelo de dados, mas é uma instalação só na
    prática. Sem um usuário configurado não há URL nem chave, e a rodada não
    tem o que fazer.
    """
    from django.contrib.auth import get_user_model

    User = get_user_model()
    if user_id:
        return User.objects.filter(pk=user_id).first()

    return (User.objects
            .exclude(prowlarr_url='')
            .exclude(prowlarr_api_key='')
            .order_by('date_joined')
            .first())
