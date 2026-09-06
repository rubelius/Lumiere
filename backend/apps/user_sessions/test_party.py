"""
Testes da projeção coletiva.

A tela mostrava três pessoas escritas no código e um chat já digitado, sem
nada disso existir no servidor. O que estes testes fixam é o que passou a
existir — e, principalmente, quem NÃO entra.
"""

from datetime import timedelta

import pytest
from django.db import IntegrityError
from django.utils import timezone

from apps.user_sessions.models import (CinemaSession, SessionInvite,
                                       SessionMessage, SessionParticipant)


@pytest.fixture
def dono(db, django_user_model):
    return django_user_model.objects.create_user(username='dono', password='x')


@pytest.fixture
def convidado(db, django_user_model):
    return django_user_model.objects.create_user(username='convidado', password='x')


@pytest.fixture
def sessao(dono):
    return CinemaSession.objects.create(
        user=dono, name='Noite Tarkovsky', theme_type='director',
        scheduled_date=timezone.now() + timedelta(days=1))


def convite(sessao, dono, **kwargs):
    dados = dict(session=sessao, created_by=dono,
                 code=SessionInvite.gera_codigo(),
                 expires_at=timezone.now() + timedelta(hours=SessionInvite.HORAS_DE_VALIDADE))
    dados.update(kwargs)
    return SessionInvite.objects.create(**dados)


# ── convite ───────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_convite_novo_e_valido(sessao, dono):
    assert convite(sessao, dono).valido is True


@pytest.mark.django_db
def test_convite_expirado_nao_vale(sessao, dono):
    """
    Convite eterno vira porta que ninguém lembra que deixou aberta. O código
    é a credencial: quem o tem, entra na sessão.
    """
    c = convite(sessao, dono, expires_at=timezone.now() - timedelta(minutes=1))
    assert c.valido is False


@pytest.mark.django_db
def test_convite_revogado_nao_vale(sessao, dono):
    assert convite(sessao, dono, revoked=True).valido is False


@pytest.mark.django_db
def test_codigos_nao_se_repetem_nem_sao_curtos():
    codigos = {SessionInvite.gera_codigo() for _ in range(500)}
    assert len(codigos) == 500
    assert all(len(c) >= 20 for c in codigos)


def test_codigo_nao_e_reproduzivel_por_semente():
    """
    `random` é semeável: quem descobrisse a semente geraria os convites
    seguintes, e o convite é a credencial de acesso à sessão.

    Testa a propriedade, não o código-fonte. Semear o `random` e ver se a
    sequência se repete distingue os dois geradores sem depender de como a
    função está escrita — a primeira versão deste teste lia a fonte e
    reprovava o próprio comentário que explica por que não usar `random`.
    """
    import random

    random.seed(1234)
    primeira = [SessionInvite.gera_codigo() for _ in range(5)]
    random.seed(1234)
    segunda = [SessionInvite.gera_codigo() for _ in range(5)]

    assert primeira != segunda, 'a semente reproduziu os códigos: gerador previsível'


# ── participante ──────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_uma_participacao_por_pessoa(sessao, convidado):
    SessionParticipant.objects.create(session=sessao, user=convidado)
    with pytest.raises(IntegrityError):
        SessionParticipant.objects.create(session=sessao, user=convidado)


@pytest.mark.django_db
def test_quem_acabou_de_dar_sinal_esta_presente(sessao, convidado):
    p = SessionParticipant.objects.create(session=sessao, user=convidado)
    assert p.presente is True


@pytest.mark.django_db
def test_quem_sumiu_ha_muito_conta_como_ausente(sessao, convidado):
    """
    A lista de quem está assistindo precisa esvaziar sozinha: sem isso,
    quem fechou o navegador continua na tela para sempre.
    """
    p = SessionParticipant.objects.create(session=sessao, user=convidado)
    antigo = timezone.now() - timedelta(seconds=SessionParticipant.SEGUNDOS_PARA_AUSENTE + 5)
    SessionParticipant.objects.filter(pk=p.pk).update(last_seen_at=antigo)
    p.refresh_from_db()
    assert p.presente is False


@pytest.mark.django_db
def test_posicao_e_por_participante(sessao, dono, convidado):
    """
    Sincronizar é comparar. Guardar uma posição só na sessão não permitiria
    dizer quem está adiantado ou atrasado em relação a quem.
    """
    a = SessionParticipant.objects.create(session=sessao, user=dono,
                                          playback_position_seconds=4400)
    b = SessionParticipant.objects.create(session=sessao, user=convidado,
                                          playback_position_seconds=4380)
    assert a.playback_position_seconds - b.playback_position_seconds == 20


# ── chat ──────────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_mensagem_guarda_o_ponto_do_filme(sessao, convidado):
    """
    Numa projeção coletiva o comentário só faz sentido junto da cena, e quem
    chega atrasado precisa ver a conversa no ponto certo em vez de levar
    spoiler do terceiro ato.
    """
    p = SessionParticipant.objects.create(session=sessao, user=convidado)
    m = SessionMessage.objects.create(session=sessao, participant=p,
                                      text='Essa cena do quarto.',
                                      playback_position_seconds=4460)
    assert m.playback_position_seconds == 4460


@pytest.mark.django_db
def test_mensagens_saem_em_ordem_cronologica(sessao, convidado):
    p = SessionParticipant.objects.create(session=sessao, user=convidado)
    for t in ('primeira', 'segunda', 'terceira'):
        SessionMessage.objects.create(session=sessao, participant=p, text=t)
    assert [m.text for m in sessao.messages.all()] == ['primeira', 'segunda', 'terceira']


@pytest.mark.django_db
def test_apagar_a_sessao_leva_junto_o_que_era_dela(sessao, convidado):
    p = SessionParticipant.objects.create(session=sessao, user=convidado)
    SessionMessage.objects.create(session=sessao, participant=p, text='oi')
    convite(sessao, sessao.user)

    sessao.delete()
    assert SessionParticipant.objects.count() == 0
    assert SessionMessage.objects.count() == 0
    assert SessionInvite.objects.count() == 0
