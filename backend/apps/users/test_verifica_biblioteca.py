"""
"Conectado" tem que querer dizer que o servidor respondeu.

O DEFEITO: `jellyfin_connected` era `bool(url and token)` — um predicado que
responde "os dois campos têm texto" e estava respondendo "o servidor
respondeu". O PATCH que grava só valida o FORMATO da URL; nada naquele caminho
falava com o Jellyfin. URL com um dígito errado, token vencido, servidor
desligado: tudo mostrava ✓ CONECTADO em dourado.

E um "sim" eterno seria quase tão falso: o servidor de casa desliga à noite.
"""

from unittest.mock import patch

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.users.verifica_biblioteca import (GRAVADO, HORAS_ATE_A_RESPOSTA_ENVELHECER,
                                            NAO_CONFIGURADO, RESPONDEU, estado,
                                            verifica)


def agora_menos(horas):
    return timezone.now() - timezone.timedelta(hours=horas)


# ── o estado que a tela lê ────────────────────────────────────────────────

def test_sem_credencial_e_nao_configurado():
    assert estado(False, None) == NAO_CONFIGURADO
    assert estado(False, timezone.now()) == NAO_CONFIGURADO


def test_credencial_sem_resposta_e_apenas_gravada():
    """O defeito inteiro: isto dizia CONECTADO."""
    assert estado(True, None) == GRAVADO


def test_resposta_recente_e_o_unico_caso_de_respondeu():
    assert estado(True, timezone.now()) == RESPONDEU
    assert estado(True, agora_menos(1)) == RESPONDEU


def test_a_resposta_envelhece():
    """
    Um "sim" de três dias atrás não diz nada sobre agora — o servidor de casa
    desliga à noite e o token expira. Voltar para "gravado" é dizer o que se
    sabe.
    """
    assert estado(True, agora_menos(HORAS_ATE_A_RESPOSTA_ENVELHECER + 1)) == GRAVADO


def test_a_fronteira_do_envelhecimento():
    assert estado(True, agora_menos(HORAS_ATE_A_RESPOSTA_ENVELHECER - 0.5)) == RESPONDEU


# ── perguntar de verdade ──────────────────────────────────────────────────

@pytest.fixture
def usuario(db, django_user_model):
    return django_user_model.objects.create_user(
        username='u', password='x',
        jellyfin_server_url='http://casa:8096', jellyfin_token='k')


@pytest.mark.django_db
def test_servidor_que_responde_ganha_carimbo(usuario):
    with patch('apps.users.verifica_biblioteca._pergunta_ao_jellyfin',
               return_value=True):
        mudou = verifica(usuario)
    assert mudou['jellyfin_verificado_em'] is not None


@pytest.mark.django_db
def test_servidor_que_nao_responde_nao_ganha_carimbo(usuario):
    with patch('apps.users.verifica_biblioteca._pergunta_ao_jellyfin',
               return_value=False):
        mudou = verifica(usuario)
    assert mudou['jellyfin_verificado_em'] is None


@pytest.mark.django_db
def test_um_servidor_fora_do_ar_nao_derruba_o_salvamento(usuario):
    """
    Gravar e verificar são duas coisas, e só a segunda pode falhar. Uma
    exceção aqui impediria alguém de guardar o endereço de um servidor que
    está desligado neste minuto.
    """
    with patch('apps.users.verifica_biblioteca._pergunta_ao_jellyfin',
               side_effect=OSError('sem rota')):
        mudou = verifica(usuario)
    assert mudou['jellyfin_verificado_em'] is None


@pytest.mark.django_db
def test_credencial_nova_apaga_o_carimbo_antigo(usuario):
    """
    Uma resposta de ontem não prova nada sobre a credencial que acabou de ser
    gravada — e deixar o carimbo faria a tela dizer RESPONDEU sobre um token
    que ninguém testou.
    """
    usuario.jellyfin_verificado_em = agora_menos(1)
    usuario.save()
    with patch('apps.users.verifica_biblioteca._pergunta_ao_jellyfin',
               return_value=False):
        mudou = verifica(usuario)
    assert mudou['jellyfin_verificado_em'] is None


@pytest.mark.django_db
def test_sem_credencial_nao_se_pergunta_nada(db, django_user_model):
    vazio = django_user_model.objects.create_user(username='v', password='x')
    with patch('apps.users.verifica_biblioteca._pergunta_ao_jellyfin') as sonda:
        mudou = verifica(vazio)
    assert mudou == {}
    assert sonda.call_count == 0


# ── o caminho inteiro, pela API ───────────────────────────────────────────

@pytest.mark.django_db
def test_gravar_credencial_pergunta_ao_servidor(db, django_user_model):
    user = django_user_model.objects.create_user(username='w', password='x')
    api = APIClient()
    api.force_authenticate(user=user)

    with patch('apps.users.verifica_biblioteca._pergunta_ao_jellyfin',
               return_value=True) as sonda:
        resposta = api.patch(
            reverse('user-integrations'),
            {'jellyfin_server_url': 'http://casa:8096', 'jellyfin_token': 'k'},
            format='json')

    assert resposta.status_code == 200
    assert sonda.call_count == 1, 'gravou sem perguntar a ninguém'
    assert resposta.data['jellyfin_estado'] == RESPONDEU


@pytest.mark.django_db
def test_servidor_mudo_grava_e_diz_apenas_gravado(db, django_user_model):
    user = django_user_model.objects.create_user(username='y', password='x')
    api = APIClient()
    api.force_authenticate(user=user)

    with patch('apps.users.verifica_biblioteca._pergunta_ao_jellyfin',
               return_value=False):
        resposta = api.patch(
            reverse('user-integrations'),
            {'jellyfin_server_url': 'http://casa:8096', 'jellyfin_token': 'k'},
            format='json')

    assert resposta.status_code == 200, 'o servidor mudo impediu de gravar'
    user.refresh_from_db()
    assert user.jellyfin_token == 'k', 'a credencial não foi guardada'
    assert resposta.data['jellyfin_estado'] == GRAVADO
    assert resposta.data['jellyfin_connected'] is True, (
        'o campo antigo mudou de significado; ele é contrato de API')
