"""
Pytest configuration for Lumière tests
"""
import os

import django
from django.conf import settings

# Set Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'lumiere.settings')

def pytest_configure(config):
    """Setup Django for pytest"""
    if not settings.configured:
        django.setup()

import pytest


@pytest.fixture
def camada_em_memoria(settings):
    """
    Troca o Redis por uma camada em memória durante o teste.

    O consumer de sessão transmite para um grupo, e sem camada de canais o
    group_send não chega a lugar nenhum. Usar o Redis real deixaria a suíte
    dependente de um serviço no ar e de o estado dele estar limpo.
    """
    settings.CHANNEL_LAYERS = {
        'default': {'BACKEND': 'channels.layers.InMemoryChannelLayer'},
    }
