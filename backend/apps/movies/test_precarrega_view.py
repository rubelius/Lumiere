"""
O que acontece quando alguém abre a ficha de um filme.

Este endpoint existe para que abrir uma ficha nunca mais signifique esperar
144 segundos. Ele é chamado em TODA abertura, então só pode custar uma escrita
no Redis — e precisa saber quando não custar nem isso.
"""

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.movies.models import Movie, TorrentRelease
from apps.tasks.precarga import DIAS_ATE_VENCER


@pytest.fixture
def cliente(db, django_user_model):
    user = django_user_model.objects.create_user(username='dono', password='x')
    api = APIClient()
    api.force_authenticate(user=user)
    return api


def filme(*, com_copias=False, varrido_ha_dias=None):
    m = Movie.objects.create(title='Filme', year=1950)
    if com_copias:
        TorrentRelease.objects.create(
            movie=m, title='Filme.1950.1080p', info_hash='a' * 40, size_bytes=1)
    if varrido_ha_dias is not None:
        Movie.objects.filter(pk=m.pk).update(
            copias_buscadas_em=timezone.now() - timezone.timedelta(days=varrido_ha_dias))
    return m


def precarrega(cliente, m):
    return cliente.post(reverse('movie-precarrega', args=[m.pk]))


@pytest.mark.django_db
def test_filme_sem_copia_entra_na_fila(cliente):
    resposta = precarrega(cliente, filme())
    assert resposta.status_code == 200
    assert resposta.data['na_fila'] is True
    assert resposta.data['ja_tem_copias'] is False


@pytest.mark.django_db
def test_filme_com_copias_recentes_nao_custa_nada(cliente):
    """
    Sem esta guarda, abrir a mesma ficha dez vezes poria o filme na fila dez
    vezes — e a fila de prioridade deixaria de significar prioridade.
    """
    m = filme(com_copias=True, varrido_ha_dias=1)
    resposta = precarrega(cliente, m)
    assert resposta.data['na_fila'] is False
    assert resposta.data['ja_tem_copias'] is True


@pytest.mark.django_db
def test_copias_velhas_entram_na_fila_mesmo_existindo(cliente):
    """
    A lacuna que este teste fecha: guardar só contra "já tem cópias" fazia uma
    ficha aberta hoje com dados de um mês atrás nunca ser atualizada — ela
    esperaria a vez dela na rotação, atrás de 25.908 outros filmes.
    """
    m = filme(com_copias=True, varrido_ha_dias=DIAS_ATE_VENCER + 1)
    resposta = precarrega(cliente, m)
    assert resposta.data['na_fila'] is True
    assert resposta.data['ja_tem_copias'] is True


@pytest.mark.django_db
def test_copias_de_antes_do_carimbo_sao_tratadas_como_velhas(cliente):
    """
    As cópias que já estavam no banco antes de `copias_buscadas_em` existir têm
    o campo nulo. Nulo é "nunca perguntamos", e nunca perguntar é motivo para
    perguntar agora.
    """
    m = filme(com_copias=True)          # sem carimbo
    assert precarrega(cliente, m).data['na_fila'] is True


@pytest.mark.django_db
def test_o_endpoint_nao_espera_a_busca(cliente, django_assert_max_num_queries):
    """
    Ele roda em toda abertura de ficha. Se custasse uma ida ao Prowlarr, teria
    reintroduzido exatamente a espera que veio eliminar.
    """
    from unittest.mock import patch

    m = filme()
    with patch('apps.movies.views.pede_prioridade') as pede:
        precarrega(cliente, m)

    assert pede.call_count == 1


@pytest.mark.django_db
def test_precisa_estar_autenticado(db):
    m = filme()
    assert APIClient().post(reverse('movie-precarrega', args=[m.pk])).status_code in (401, 403)
