"""
Testes do canal ao vivo da sessão.

O consumer nunca funcionou: importava CinemaSessionDetailSerializer, que não
existe, fora do try — toda conexão estourava ImportError antes de tocar o
banco. Como nenhuma tela consumia o canal, o defeito passou despercebido.
Estes testes existem para isso não se repetir em silêncio.
"""

from datetime import timedelta

import pytest
from channels.testing import WebsocketCommunicator
from django.utils import timezone

from channels.routing import URLRouter

from apps.user_sessions.models import (CinemaSession, SessionMessage,
                                       SessionParticipant)
from apps.user_sessions.routing import websocket_urlpatterns

# Sem o JWTAuthMiddleware de propósito: ele autentica por `?ticket=` e
# sobrescreveria o usuário injetado no scope. O que se testa aqui é a
# autorização do PRÓPRIO consumer — dono ou participante — e o protocolo; a
# autenticação por ticket é outra camada, com seus próprios testes.
application = URLRouter(websocket_urlpatterns)

pytestmark = [pytest.mark.django_db(transaction=True), pytest.mark.asyncio]


def sessao_de(dono):
    return CinemaSession.objects.create(
        user=dono, name='Noite Tarkovsky', theme_type='director',
        scheduled_date=timezone.now() + timedelta(days=1))


async def conecta(sessao, user):
    com = WebsocketCommunicator(application, f'/ws/sessions/{sessao.id}/')
    com.scope['user'] = user
    conectou, _ = await com.connect()
    return com, conectou


# ── quem entra ────────────────────────────────────────────────────────────

async def test_dono_conecta_e_recebe_o_estado(camada_em_memoria, django_user_model):
    dono = await django_user_model.objects.acreate(username='dono')
    sessao = await CinemaSession.objects.acreate(
        user=dono, name='Noite', theme_type='director',
        scheduled_date=timezone.now() + timedelta(days=1))

    com, conectou = await conecta(sessao, dono)
    assert conectou, 'o dono não conseguiu conectar'

    msg = await com.receive_json_from(timeout=5)
    assert msg['type'] == 'session_state'
    assert msg['payload']['name'] == 'Noite'
    await com.disconnect()


async def test_estranho_nao_conecta(camada_em_memoria, django_user_model):
    """
    A sessão dá acesso ao acervo de mídia de alguém. Quem não é dono nem
    participante não entra no canal.
    """
    dono = await django_user_model.objects.acreate(username='dono2')
    estranho = await django_user_model.objects.acreate(username='estranho')
    sessao = await CinemaSession.objects.acreate(
        user=dono, name='Noite', theme_type='director',
        scheduled_date=timezone.now() + timedelta(days=1))

    com, conectou = await conecta(sessao, estranho)
    assert not conectou
    await com.disconnect()


async def test_convidado_conecta(camada_em_memoria, django_user_model):
    """Antes o canal aceitava só o dono — a projeção coletiva não existia."""
    dono = await django_user_model.objects.acreate(username='dono3')
    convidado = await django_user_model.objects.acreate(username='convidado')
    sessao = await CinemaSession.objects.acreate(
        user=dono, name='Noite', theme_type='director',
        scheduled_date=timezone.now() + timedelta(days=1))
    await SessionParticipant.objects.acreate(session=sessao, user=convidado)

    com, conectou = await conecta(sessao, convidado)
    assert conectou
    await com.disconnect()


async def monta_dupla(django_user_model):
    """Uma sessão com dono e convidado, ambos conectados."""
    dono = await django_user_model.objects.acreate(username=f'd{timezone.now().timestamp()}')
    convidado = await django_user_model.objects.acreate(username=f'c{timezone.now().timestamp()}')
    sessao = await CinemaSession.objects.acreate(
        user=dono, name='Noite', theme_type='director',
        scheduled_date=timezone.now() + timedelta(days=1))
    await SessionParticipant.objects.acreate(session=sessao, user=convidado)

    ca, _ = await conecta(sessao, dono)
    cb, _ = await conecta(sessao, convidado)
    # Drena o estado inicial e os anúncios de presença de cada um.
    #
    # `receive_nothing` devolve booleano; a primeira versão disto chamava
    # receive_json_from dentro de try/except Exception, e o timeout do
    # asgiref levanta CancelledError, que herda de BaseException e escapava
    # do except — todo teste do protocolo morria na montagem.
    for com in (ca, cb):
        for _ in range(20):
            if await com.receive_nothing(timeout=0.3):
                break
            await com.receive_output(timeout=0.3)
    return sessao, ca, cb


# ── protocolo ─────────────────────────────────────────────────────────────

async def test_fala_de_um_chega_no_outro(camada_em_memoria, django_user_model):
    sessao, ca, cb = await monta_dupla(django_user_model)

    await ca.send_json_to({'type': 'chat', 'text': 'Essa cena do quarto.', 'position': 4460})
    recebida = await cb.receive_json_from(timeout=5)

    assert recebida['type'] == 'chat'
    assert recebida['payload']['text'] == 'Essa cena do quarto.'
    assert recebida['payload']['playback_position_seconds'] == 4460

    await ca.disconnect()
    await cb.disconnect()


async def test_fala_fica_gravada(camada_em_memoria, django_user_model):
    """
    O chat precisa sobreviver ao recarregamento: quem chega atrasado tem de
    poder ler a conversa desde o começo.
    """
    sessao, ca, cb = await monta_dupla(django_user_model)

    await ca.send_json_to({'type': 'chat', 'text': 'gravada', 'position': 10})
    await cb.receive_json_from(timeout=5)

    assert await SessionMessage.objects.filter(session=sessao, text='gravada').aexists()
    await ca.disconnect()
    await cb.disconnect()


async def test_fala_vazia_nao_vira_mensagem(camada_em_memoria, django_user_model):
    sessao, ca, cb = await monta_dupla(django_user_model)

    await ca.send_json_to({'type': 'chat', 'text': '   '})
    assert await cb.receive_nothing(timeout=1)
    assert not await SessionMessage.objects.filter(session=sessao).aexists()

    await ca.disconnect()
    await cb.disconnect()


async def test_posicao_de_um_chega_no_outro(camada_em_memoria, django_user_model):
    """Sincronizar é comparar: sem receber a posição do outro não há o que comparar."""
    sessao, ca, cb = await monta_dupla(django_user_model)

    await ca.send_json_to({'type': 'sync', 'position': 4460, 'state': 'playing'})
    recebida = await cb.receive_json_from(timeout=5)

    assert recebida['type'] == 'sync'
    assert recebida['payload']['position'] == 4460
    assert recebida['payload']['state'] == 'playing'

    await ca.disconnect()
    await cb.disconnect()


async def test_posicao_negativa_vira_zero(camada_em_memoria, django_user_model):
    """O <video> reporta tempo negativo em seek, e o campo é PositiveInteger."""
    sessao, ca, cb = await monta_dupla(django_user_model)

    await ca.send_json_to({'type': 'sync', 'position': -50, 'state': 'paused'})
    recebida = await cb.receive_json_from(timeout=5)
    assert recebida['payload']['position'] == 0

    await ca.disconnect()
    await cb.disconnect()


async def test_json_invalido_nao_derruba_a_conexao(camada_em_memoria, django_user_model):
    """Uma mensagem malformada de um espectador não pode calar os outros."""
    sessao, ca, cb = await monta_dupla(django_user_model)

    await ca.send_to(text_data='isto não é json')
    await ca.send_json_to({'type': 'chat', 'text': 'ainda funciono'})

    recebida = await cb.receive_json_from(timeout=5)
    assert recebida['payload']['text'] == 'ainda funciono'

    await ca.disconnect()
    await cb.disconnect()


async def test_ping_responde_pong(camada_em_memoria, django_user_model):
    sessao, ca, cb = await monta_dupla(django_user_model)

    await ca.send_json_to({'type': 'ping'})
    assert (await ca.receive_json_from(timeout=5))['type'] == 'pong'

    await ca.disconnect()
    await cb.disconnect()


async def test_conexao_sem_usuario_e_recusada(camada_em_memoria, django_user_model):
    """
    Sem esta guarda, qualquer conexão anônima entraria no canal de uma
    sessão e leria o chat e o acervo de quem a criou. Nenhum outro teste
    cobre isto: todos injetam um usuário no scope.
    """
    from django.contrib.auth.models import AnonymousUser

    dono = await django_user_model.objects.acreate(username='dono_anon')
    sessao = await CinemaSession.objects.acreate(
        user=dono, name='Noite', theme_type='director',
        scheduled_date=timezone.now() + timedelta(days=1))

    com = WebsocketCommunicator(application, f'/ws/sessions/{sessao.id}/')
    com.scope['user'] = AnonymousUser()
    conectou, _ = await com.connect()

    assert not conectou
    await com.disconnect()


async def test_conexao_sem_chave_de_usuario_no_scope_e_recusada(camada_em_memoria,
                                                                django_user_model):
    """O scope pode nem trazer a chave, se nenhum middleware a puser."""
    dono = await django_user_model.objects.acreate(username='dono_sem_scope')
    sessao = await CinemaSession.objects.acreate(
        user=dono, name='Noite', theme_type='director',
        scheduled_date=timezone.now() + timedelta(days=1))

    com = WebsocketCommunicator(application, f'/ws/sessions/{sessao.id}/')
    com.scope.pop('user', None)
    conectou, _ = await com.connect()

    assert not conectou
    await com.disconnect()
