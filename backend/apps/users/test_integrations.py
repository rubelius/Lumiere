"""
Testes das credenciais de integração.

Dois contratos importam aqui: token nunca volta na resposta, e a URL do
servidor aceita as formas que um servidor de mídia caseiro realmente usa sem
abrir a porta para esquemas perigosos.
"""

import pytest

from apps.users.serializers import IntegrationSettingsSerializer, valida_url_de_servidor
from rest_framework import serializers


@pytest.mark.parametrize('url', [
    'http://jellyfin:8096',            # nome de serviço Docker
    'http://192.168.1.100:32400',      # IP de rede local
    'http://localhost:8096',
    'https://media.casa.lan/jellyfin',
    'https://jellyfin.exemplo.com',
    '',                                # vazio = limpar a configuração
])
def test_aceita_formas_reais_de_servidor(url):
    assert valida_url_de_servidor(url) == url


@pytest.mark.parametrize('url', [
    'nao-e-url',
    'javascript:alert(1)',             # viraria XSS se caísse num href
    'ftp://servidor/arquivo',
    'http://com espaco:8096',
])
def test_recusa_entrada_invalida_ou_perigosa(url):
    with pytest.raises(serializers.ValidationError):
        valida_url_de_servidor(url)


def test_tokens_sao_write_only():
    """
    O serializer não pode devolver segredo. Se algum token virar legível, o
    valor apareceria em tela de configuração, log de resposta e cache.
    """
    campos = IntegrationSettingsSerializer().fields
    for nome in ('jellyfin_token', 'plex_token', 'realdebrid_api_key'):
        assert campos[nome].write_only, f'{nome} deveria ser write_only'


def test_leitura_expoe_apenas_estado_de_conexao():
    class Falso:
        jellyfin_server_url = 'http://jellyfin:8096'
        jellyfin_user_id = ''
        jellyfin_token = 'segredo'
        plex_server_url = ''
        plex_token = ''
        realdebrid_api_key = 'outro-segredo'

    dados = IntegrationSettingsSerializer(Falso()).data
    assert 'segredo' not in str(dados)
    assert 'outro-segredo' not in str(dados)
    assert dados['jellyfin_connected'] is True
    assert dados['plex_connected'] is False
    assert dados['realdebrid_connected'] is True
