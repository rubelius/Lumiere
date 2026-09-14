"""
O endereço do motor de torrent precisa ser mesmo configurável.

O defeito que estes testes guardam: `getattr(settings, 'TORRENT_SERVICE_URL',
padrão)` sobre um nome que o `settings.py` NÃO DEFINIA caía sempre no padrão.
A chave existia no código de quem lê e em lugar nenhum de quem configura — uma
configuração que só parecia configuração, e justamente a que muda quando o
motor deixa o `localhost` e passa a rodar atrás do gluetun.

É o mesmo formato de defeito que este projeto já encontrou noutros cantos: um
botão, uma flag ou uma chave que aceita valor e não muda nada.
"""

import importlib

from django.conf import settings
from django.test import override_settings

from apps.integrations import torrent


def test_o_settings_define_a_chave_e_nao_so_quem_a_le():
    """
    Sem isto, `getattr` devolve o padrão para sempre e a variável de ambiente
    vira enfeite. A guarda é o `hasattr`, não o valor.
    """
    assert hasattr(settings, 'TORRENT_SERVICE_URL'), \
        'a chave não existe no settings; o getattr de quem lê cairia sempre no padrão'


@override_settings(TORRENT_SERVICE_URL='http://gluetun:8001')
def test_mudar_a_chave_muda_o_endereco_chamado():
    """O teste com dentes: o valor configurado precisa CHEGAR na URL."""
    assert torrent._base() == 'http://gluetun:8001'


@override_settings(TORRENT_SERVICE_URL='http://gluetun:8001/')
def test_a_barra_final_nao_vira_barra_dupla():
    """`http://host:8001//torrent` é 404 em alguns servidores e ninguém vê."""
    assert torrent._base() == 'http://gluetun:8001'


def test_a_chave_e_lida_do_ambiente(monkeypatch):
    """
    Definir no settings não basta se o valor for fixo: quem sobe o container
    configura por ambiente, e é esse caminho que precisa funcionar.
    """
    monkeypatch.setenv('TORRENT_SERVICE_URL', 'http://motor-de-teste:9999')
    modulo = importlib.import_module('lumiere.settings')
    importlib.reload(modulo)
    try:
        assert modulo.TORRENT_SERVICE_URL == 'http://motor-de-teste:9999'
    finally:
        monkeypatch.delenv('TORRENT_SERVICE_URL')
        importlib.reload(modulo)
