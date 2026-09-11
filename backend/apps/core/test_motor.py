"""
O estado do motor, do jeito que a tela precisa saber.

O que motivou: uma busca ficou dez minutos "na fila" porque não havia worker,
e nada em lugar nenhum dizia isso. Depois, uma sessão inteira abriu com
Postgres travado num lock órfão, Docker desligado, worker e beat mortos — e a
tela seguia oferecendo [ ATUALIZAR CÓPIAS ] com a mesma confiança de sempre.
"""

from unittest.mock import patch

import pytest
from django.core.cache import cache
from django.urls import reverse
from rest_framework.test import APIClient

from apps.core.motor import CHAVE, estado_do_motor
from apps.tasks.pulso import CHAVE_DO_PULSO, beat_esta_vivo, pulso


@pytest.fixture(autouse=True)
def limpa(db):
    cache.delete(CHAVE)
    cache.delete(CHAVE_DO_PULSO)
    yield
    cache.delete(CHAVE)
    cache.delete(CHAVE_DO_PULSO)


def com_workers(quantos):
    """Substitui o broadcast do Celery, que numa suíte não tem a quem perguntar."""
    return patch('apps.core.motor._workers_respondendo', return_value=quantos)


# ── o pulso do beat ───────────────────────────────────────────────────────

def test_sem_pulso_o_beat_esta_morto():
    """
    A pergunta que nada respondia. Um worker fora do ar responde quando
    perguntado; um beat fora do ar não responde nada, e silêncio parece
    funcionamento.
    """
    assert beat_esta_vivo() is False


def test_o_pulso_marca_o_beat_como_vivo():
    pulso()
    assert beat_esta_vivo() is True


def test_o_pulso_expira_sozinho():
    """
    É o que faz um beat morto ser percebido sem ninguém precisar limpar nada:
    a chave some, e a ausência é a resposta.
    """
    from apps.tasks.pulso import SEGUNDOS_DE_PULSO
    from django_redis import get_redis_connection

    pulso()
    ttl = get_redis_connection('default').ttl(f'lumiere-teste:1:{CHAVE_DO_PULSO}')

    assert 0 < ttl <= SEGUNDOS_DE_PULSO
    assert SEGUNDOS_DE_PULSO <= 300, (
        'tolerância grande demais esconde um beat morto por minutos')


# ── a conclusão que a tela usa ────────────────────────────────────────────

def test_sem_worker_a_busca_nao_funciona():
    """
    O defeito exato: a view aceita a busca e devolve 202, o botão gira, e
    ninguém nunca pega o trabalho.
    """
    with com_workers(0):
        estado = estado_do_motor(forcar=True)

    assert estado['busca_funciona'] is False
    assert estado['workers'] == 0


def test_com_worker_a_busca_funciona():
    with com_workers(1):
        estado = estado_do_motor(forcar=True)

    assert estado['busca_funciona'] is True


def test_o_rastreio_precisa_dos_dois():
    """
    A busca por clique precisa só do worker; as rodadas periódicas precisam
    também do beat. São promessas diferentes e a tela faz as duas.
    """
    with com_workers(1):
        sem_beat = estado_do_motor(forcar=True)
        pulso()
        com_beat = estado_do_motor(forcar=True)

    assert sem_beat['rastreio_funciona'] is False
    assert sem_beat['busca_funciona'] is True, 'um beat morto não impede buscar'
    assert com_beat['rastreio_funciona'] is True


def test_broker_fora_conta_como_sem_worker():
    """
    Não saber quantos workers existem é, para quem espera uma busca, o mesmo
    que não ter nenhum. Propagar a exceção deixaria a tela sem resposta.
    """
    with patch('apps.core.motor.current_app.control.ping',
               side_effect=OSError('broker fora')):
        estado = estado_do_motor(forcar=True)

    assert estado['workers'] == 0
    assert estado['busca_funciona'] is False


# ── o custo ───────────────────────────────────────────────────────────────

def test_a_resposta_fica_guardada():
    """
    `control.ping` custa o timeout inteiro quando não há worker — que é
    exatamente quando a tela mais pergunta. Sem o cache, cada aba aberta
    pagaria esse segundo.
    """
    with com_workers(0) as espiao:
        estado_do_motor(forcar=True)
        estado_do_motor()
        estado_do_motor()

    assert espiao.call_count == 1


def test_forcar_ignora_o_guardado():
    with com_workers(0):
        estado_do_motor(forcar=True)
    with com_workers(2):
        assert estado_do_motor(forcar=True)['workers'] == 2


def test_o_ping_nao_espera_para_sempre():
    """Um timeout longo trava a resposta no caso em que ela mais importa."""
    from apps.core.motor import SEGUNDOS_DE_ESPERA_DO_PING
    assert SEGUNDOS_DE_ESPERA_DO_PING <= 2


# ── o endpoint ────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_o_endpoint_responde_o_estado(django_user_model):
    api = APIClient()
    api.force_authenticate(user=django_user_model.objects.create_user(
        username='dono', password='x'))

    with com_workers(1):
        resposta = api.get(reverse('estado-do-motor'))

    assert resposta.status_code == 200
    assert set(resposta.data) >= {'workers', 'beat', 'busca_funciona', 'rastreio_funciona'}


@pytest.mark.django_db
def test_o_endpoint_pede_autenticacao():
    assert APIClient().get(reverse('estado-do-motor')).status_code in (401, 403)
