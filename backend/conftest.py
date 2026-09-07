"""
Pytest configuration for Lumière tests
"""
import os

import django
from django.conf import settings

# Set Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'lumiere.settings')

# Transporte em memória do Kombu: a publicação funciona e não sai do processo.
BROKER_DE_TESTE = 'memory://'
BACKEND_DE_TESTE = 'cache+memory://'

# ── Isolamento do broker ──────────────────────────────────────────────────
#
# Sem isto a suíte publicava no broker de produção e um worker no ar executava
# as tarefas de verdade. Foi assim que 48 tarefas de `train_user_taste_profile`
# ficaram represadas apontando para usuários de teste já apagados — e o risco
# maior nem era esse: um teste que chegue a `search_torrents_for_movie` ou a
# `add_to_realdebrid` faria o worker bater nas APIs externas com as credenciais
# reais do usuário. Mesma razão do `camada_em_memoria` abaixo, que já fazia isso
# para a camada de canais.
#
# Aqui no topo do módulo, e no AMBIENTE, de propósito. Duas coisas tornam
# qualquer outro ponto inútil, as duas em silêncio:
#
#   1. o Celery lê CELERY_BROKER_URL do ambiente como preconf, e preconf ganha
#      das settings do Django — trocar `app.conf.broker_url` depois do import
#      é desfeito sem aviso;
#   2. o `.env` do projeto define essa variável, mas `load_dotenv` não
#      sobrescreve o que já está no ambiente, então escrever antes basta.
#
# Não é modo eager: as tarefas continuam apenas sendo publicadas, então um
# teste que verifica "isto enfileira uma tarefa" segue valendo.
os.environ['CELERY_BROKER_URL'] = BROKER_DE_TESTE
os.environ['CELERY_RESULT_BACKEND'] = BACKEND_DE_TESTE


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
