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


# ── enquete ───────────────────────────────────────────────────────────────

async def test_enquete_chega_como_fala_da_conversa(camada_em_memoria, django_user_model):
    """
    A enquete é pendurada numa mensagem: a conversa é uma só, e duas linhas
    do tempo obrigariam o cliente a intercalá-las por horário.
    """
    sessao, ca, cb = await monta_dupla(django_user_model)

    await ca.send_json_to({'type': 'poll', 'question': 'Ritmo até aqui?',
                           'options': ['Hipnótico', 'Parado'], 'position': 4460})
    recebida = await cb.receive_json_from(timeout=5)

    assert recebida['type'] == 'chat'
    assert recebida['payload']['poll']['question'] == 'Ritmo até aqui?'
    assert [o['label'] for o in recebida['payload']['poll']['options']] == ['Hipnótico', 'Parado']
    assert recebida['payload']['poll']['total_votes'] == 0

    await ca.disconnect(); await cb.disconnect()


async def test_enquete_com_uma_alternativa_nao_e_enquete(camada_em_memoria,
                                                         django_user_model):
    """Uma afirmação com um botão embaixo não é uma enquete."""
    sessao, ca, cb = await monta_dupla(django_user_model)

    await ca.send_json_to({'type': 'poll', 'question': 'Gostou?', 'options': ['Sim']})
    assert await cb.receive_nothing(timeout=1)

    await ca.disconnect(); await cb.disconnect()


async def test_voto_atualiza_o_placar_de_todos(camada_em_memoria, django_user_model):
    """
    O placar depende de TODOS os votos. Retransmitir a enquete inteira é o que
    garante o mesmo número para quem entrou depois — reconstruí-lo a partir de
    eventos soltos daria contagens diferentes por cliente.
    """
    sessao, ca, cb = await monta_dupla(django_user_model)

    await ca.send_json_to({'type': 'poll', 'question': 'Ritmo?',
                           'options': ['A', 'B']})
    criada = await cb.receive_json_from(timeout=5)
    enquete = criada['payload']['poll']
    # Quem criou também recebe a transmissão da própria enquete; drenar essa
    # cópia é o que deixa a próxima leitura ser o placar.
    await ca.receive_json_from(timeout=5)

    await cb.send_json_to({'type': 'vote', 'poll_id': enquete['id'],
                           'option_id': enquete['options'][0]['id']})
    atualizada = await ca.receive_json_from(timeout=5)

    assert atualizada['type'] == 'poll'
    assert atualizada['payload']['total_votes'] == 1
    assert atualizada['payload']['options'][0]['votes'] == 1

    await ca.disconnect(); await cb.disconnect()


async def test_trocar_de_ideia_muda_o_voto_em_vez_de_somar(camada_em_memoria,
                                                           django_user_model):
    """
    Sem isso o segundo voto bateria na restrição do banco e o erro chegaria ao
    usuário como falha, quando o que ele quis foi mudar de ideia.
    """
    sessao, ca, cb = await monta_dupla(django_user_model)

    await ca.send_json_to({'type': 'poll', 'question': 'Ritmo?', 'options': ['A', 'B']})
    enquete = (await cb.receive_json_from(timeout=5))['payload']['poll']
    await ca.receive_json_from(timeout=5)   # a própria enquete

    for i in (0, 1):
        await cb.send_json_to({'type': 'vote', 'poll_id': enquete['id'],
                               'option_id': enquete['options'][i]['id']})
        atualizada = await ca.receive_json_from(timeout=5)

    assert atualizada['payload']['total_votes'] == 1
    assert atualizada['payload']['options'][0]['votes'] == 0
    assert atualizada['payload']['options'][1]['votes'] == 1

    await ca.disconnect(); await cb.disconnect()


async def test_voto_em_enquete_de_outra_sessao_e_recusado(camada_em_memoria,
                                                          django_user_model):
    """Aceitar um par (enquete, alternativa) solto deixaria votar de fora."""
    from apps.user_sessions.models import (SessionMessage, SessionPoll,
                                           SessionPollOption)

    sessao, ca, cb = await monta_dupla(django_user_model)

    outro_dono = await django_user_model.objects.acreate(username='outro_dono_poll')
    outra = await CinemaSession.objects.acreate(
        user=outro_dono, name='Outra', theme_type='custom',
        scheduled_date=timezone.now() + timedelta(days=1))
    p_outro = await SessionParticipant.objects.acreate(session=outra, user=outro_dono)
    msg = await SessionMessage.objects.acreate(session=outra, participant=p_outro, text='?')
    enquete_alheia = await SessionPoll.objects.acreate(message=msg, question='?')
    opcao_alheia = await SessionPollOption.objects.acreate(poll=enquete_alheia, label='X')

    await cb.send_json_to({'type': 'vote', 'poll_id': str(enquete_alheia.id),
                           'option_id': str(opcao_alheia.id)})
    assert await ca.receive_nothing(timeout=1)

    await ca.disconnect(); await cb.disconnect()
