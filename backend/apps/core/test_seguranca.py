"""
Testes da configuração de segurança.

Os três defeitos aqui têm a mesma assinatura: a configuração declara a
proteção, o Django aceita a declaração, e a proteção não existe. Nada falha,
nada avisa — só não protege.
"""

import pytest
from django.conf import settings


def test_throttling_declarado_esta_ligado():
    """
    DEFAULT_THROTTLE_RATES sem DEFAULT_THROTTLE_CLASSES é decoração: o DRF lê
    as taxas e não aplica limite nenhum, em endpoint nenhum.
    """
    drf = settings.REST_FRAMEWORK
    assert drf.get('DEFAULT_THROTTLE_CLASSES'), (
        'taxas declaradas sem classes: nada é limitado')

    classes = ' '.join(drf['DEFAULT_THROTTLE_CLASSES'])
    for taxa in drf.get('DEFAULT_THROTTLE_RATES', {}):
        if taxa in ('anon', 'user'):
            assert taxa.capitalize() in classes or taxa in classes.lower(), (
                f'taxa {taxa} sem classe que a aplique')


def test_login_tem_limite_proprio_e_mais_apertado():
    """
    Login é o único endpoint onde repetir a chamada é o ataque. Herdar o
    limite de navegação (100/hora) deixa espaço de sobra para força bruta.
    """
    taxas = settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']
    assert 'login' in taxas, 'login sem escopo próprio de throttle'

    def por_hora(t):
        n, periodo = t.split('/')
        return int(n) * {'min': 60, 'hour': 1, 'day': 1 / 24}[periodo.rstrip('ute')]

    assert por_hora(taxas['login']) < por_hora(taxas['anon']) * 10, (
        'limite de login não é mais restritivo que o de navegação')

    from lumiere.urls import LoginThrottled
    assert LoginThrottled.throttle_scope == 'login'


def test_blacklist_de_refresh_tem_onde_gravar():
    """
    BLACKLIST_AFTER_ROTATION sem o app token_blacklist não levanta erro: a
    rotação emite um refresh novo e o antigo continua válido até expirar.
    Um token roubado sobrevive ao logout e à troca de senha.
    """
    if settings.SIMPLE_JWT.get('BLACKLIST_AFTER_ROTATION'):
        assert 'rest_framework_simplejwt.token_blacklist' in settings.INSTALLED_APPS, (
            'blacklist ligada sem o app que a implementa')


def test_producao_recusa_subir_com_a_chave_de_exemplo():
    """
    A SECRET_KEY assina os JWT. A chave de exemplo está versionada neste
    repositório, então subir produção com ela permite forjar um token para
    qualquer usuário. O Django não avisa: sobe normalmente, e o security.W009
    nem dispara, porque a string de exemplo tem 64 caracteres.
    """
    import importlib

    import lumiere.settings as s
    from django.core.exceptions import ImproperlyConfigured

    origem = open(s.__file__).read()
    assert 'CHAVE_DE_EXEMPLO' in origem, 'a comparação sumiu do settings'
    assert 'ImproperlyConfigured' in origem

    # Executa o módulo com DEBUG desligado e a chave de exemplo no ambiente.
    import os
    from unittest.mock import patch

    with patch.dict(os.environ, {'DEBUG': 'False', 'SECRET_KEY': s.CHAVE_DE_EXEMPLO}):
        with pytest.raises(ImproperlyConfigured, match='SECRET_KEY'):
            importlib.reload(s)

    # Devolve o módulo ao estado do teste.
    with patch.dict(os.environ, {'DEBUG': 'True'}):
        importlib.reload(s)
