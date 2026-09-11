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

# ── Isolamento do cache ───────────────────────────────────────────────────
#
# Mesma história do broker, e custou o mesmo tipo de confusão: a suíte usava o
# MESMO Redis da aplicação (db 1, prefixo `lumiere`), e três arquivos de teste
# chamam `cache.clear()`. No django_redis isso apaga todas as chaves do
# prefixo, não só as do teste.
#
# O estrago observado: rodar a suíte enquanto o rastreador de cópias
# trabalhava apagou o cadeado da rodada em curso. Uma segunda rodada passaria
# a varrer os mesmos filmes em paralelo — duas idas ao Prowlarr pelo mesmo
# título —, e o diagnóstico é caro porque nada acusa: o cadeado simplesmente
# não está mais lá.
#
# A mesma varredura apaga também os documentos de estado das buscas em curso
# (a tela volta a dizer "ociosa" no meio de uma busca), a fila de pedidos do
# rastreador e a varredura guardada da conta do Real-Debrid.
#
# Redis de verdade, e não locmem: o código depende de `cache.add` ser SETNX
# atômico entre PROCESSOS — é o cadeado que impede duas buscas do mesmo filme.
# Com LocMemCache cada processo tem o seu dicionário e o cadeado deixaria de
# ser um cadeado, silenciosamente. Muda-se o banco e o prefixo, não o backend.
os.environ.setdefault('REDIS_URL_TESTE', 'redis://localhost:6379/15')


def pytest_configure(config):
    """Setup Django for pytest"""
    if not settings.configured:
        django.setup()

    # Depois do django.setup(), porque só então CACHES existe para ser trocado.
    #
    # O BANCO separado é a única proteção que funciona, e isto foi medido:
    # `cache.clear()` no django_redis executa FLUSHDB e apaga o banco INTEIRO,
    # ignorando o KEY_PREFIX. Uma chave gravada com o prefixo da aplicação no
    # mesmo banco do teste morre junto.
    #
    # O prefixo diferente fica assim mesmo, mas pelo que ele de fato faz:
    # tornar óbvio, ao inspecionar o Redis, qual chave veio de onde. Não conte
    # com ele para isolar nada.
    settings.CACHES = {
        'default': {
            **settings.CACHES['default'],
            'LOCATION': os.environ['REDIS_URL_TESTE'],
            'KEY_PREFIX': 'lumiere-teste',
        }
    }


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
