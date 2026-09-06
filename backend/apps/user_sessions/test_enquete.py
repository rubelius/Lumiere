"""
Testes da enquete da sessão.

A tela trazia uma enquete com os votos escritos no código — 3 contra 2, cinco
no total — e um botão de votar que só mexia no estado local do navegador.
"""

from datetime import timedelta

import pytest
from django.db import IntegrityError
from django.utils import timezone

from apps.user_sessions.models import (CinemaSession, SessionMessage,
                                       SessionParticipant, SessionPoll,
                                       SessionPollOption, SessionPollVote)


@pytest.fixture
def dono(db, django_user_model):
    return django_user_model.objects.create_user(username='dono', password='x')


@pytest.fixture
def convidado(db, django_user_model):
    return django_user_model.objects.create_user(username='convidado', password='x')


@pytest.fixture
def sessao(dono):
    return CinemaSession.objects.create(
        user=dono, name='Noite', theme_type='custom',
        scheduled_date=timezone.now() + timedelta(days=1))


def participa(sessao, user, papel='guest'):
    return SessionParticipant.objects.create(session=sessao, user=user, role=papel)


def enquete(sessao, autor, pergunta='Ritmo até aqui?', alternativas=('Hipnótico', 'Parado')):
    msg = SessionMessage.objects.create(session=sessao, participant=autor, text=pergunta)
    p = SessionPoll.objects.create(message=msg, question=pergunta)
    for i, label in enumerate(alternativas):
        SessionPollOption.objects.create(poll=p, label=label, order=i)
    return p


@pytest.mark.django_db
def test_enquete_nasce_sem_voto(sessao, dono):
    """Os votos vinham escritos no código: 3 contra 2, sem ninguém ter votado."""
    p = enquete(sessao, participa(sessao, dono, 'host'))
    assert p.total_de_votos == 0
    assert p.options.count() == 2


@pytest.mark.django_db
def test_voto_conta(sessao, dono, convidado):
    anfitriao = participa(sessao, dono, 'host')
    p = enquete(sessao, anfitriao)
    SessionPollVote.objects.create(poll=p, option=p.options.first(),
                                   participant=participa(sessao, convidado))
    assert p.total_de_votos == 1


@pytest.mark.django_db
def test_uma_pessoa_vota_uma_vez_por_enquete(sessao, dono, convidado):
    """
    A restrição é por (enquete, participante). Se fosse por (alternativa,
    participante), a mesma pessoa votaria em TODAS as alternativas, uma vez
    em cada — e a enquete viraria uma contagem sem sentido.
    """
    p = enquete(sessao, participa(sessao, dono, 'host'))
    quem = participa(sessao, convidado)
    a, b = list(p.options.all())

    SessionPollVote.objects.create(poll=p, option=a, participant=quem)
    with pytest.raises(IntegrityError):
        SessionPollVote.objects.create(poll=p, option=b, participant=quem)


@pytest.mark.django_db
def test_pessoas_diferentes_votam_na_mesma_alternativa(sessao, dono, convidado,
                                                       django_user_model):
    p = enquete(sessao, participa(sessao, dono, 'host'))
    escolha = p.options.first()
    for nome in ('a', 'b', 'c'):
        u = django_user_model.objects.create_user(username=nome, password='x')
        SessionPollVote.objects.create(poll=p, option=escolha, participant=participa(sessao, u))
    assert p.total_de_votos == 3


@pytest.mark.django_db
def test_alternativas_saem_na_ordem_declarada(sessao, dono):
    p = enquete(sessao, participa(sessao, dono, 'host'),
                alternativas=('Primeira', 'Segunda', 'Terceira'))
    assert [o.label for o in p.options.all()] == ['Primeira', 'Segunda', 'Terceira']


@pytest.mark.django_db
def test_apagar_a_mensagem_leva_a_enquete(sessao, dono, convidado):
    """
    A enquete é a mensagem: some junto. Deixá-la órfã produziria uma enquete
    sem lugar na conversa, que nenhuma tela saberia desenhar.
    """
    p = enquete(sessao, participa(sessao, dono, 'host'))
    SessionPollVote.objects.create(poll=p, option=p.options.first(),
                                   participant=participa(sessao, convidado))
    p.message.delete()

    assert SessionPoll.objects.count() == 0
    assert SessionPollOption.objects.count() == 0
    assert SessionPollVote.objects.count() == 0
