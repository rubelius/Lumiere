"""
A suíte não pode tocar no cache da aplicação.

Custou um diagnóstico caro: rodar os testes enquanto o rastreador de cópias
trabalhava apagou o cadeado da rodada em curso, porque três arquivos de teste
chamam `cache.clear()` e o cache era o MESMO da aplicação (db 1, prefixo
`lumiere`). No django_redis, `clear()` apaga todas as chaves do prefixo.

Nada acusa quando isso acontece. O cadeado simplesmente não está mais lá, duas
rodadas passam a varrer os mesmos filmes, e a tela volta a dizer "ociosa" no
meio de uma busca — porque os documentos de estado também foram embora.

É a mesma família do isolamento do broker, que este projeto já pagou uma vez:
a suíte publicava em produção e um worker no ar executava as tarefas de
verdade.
"""

import os

import pytest
from django.conf import settings
from django.core.cache import cache


def test_o_teste_escreve_em_outro_banco_do_redis():
    """
    A ÚNICA proteção que funciona, e isto foi medido: `cache.clear()` no
    django_redis executa FLUSHDB e apaga o banco inteiro, ignorando o
    KEY_PREFIX. Separar só o prefixo não isola coisa nenhuma.
    """
    destino = settings.CACHES['default']

    assert destino['LOCATION'] == os.environ['REDIS_URL_TESTE']
    assert destino['LOCATION'].endswith('/15'), 'banco de teste mudou de lugar'
    assert not destino['LOCATION'].endswith('/1'), 'voltou para o banco da aplicação'


def test_o_prefixo_tambem_e_outro():
    """
    Não isola — o FLUSHDB do `clear()` passa por cima dele —, mas deixa óbvio
    de onde veio cada chave ao olhar o Redis.
    """
    assert settings.CACHES['default']['KEY_PREFIX'] == 'lumiere-teste'


def test_continua_sendo_redis_de_verdade():
    """
    Não vale trocar por LocMemCache.

    O cadeado da busca é `cache.add`, que precisa ser um SETNX atômico ENTRE
    PROCESSOS — é ele que impede um clique e uma rodada do rastreador
    buscarem o mesmo filme ao mesmo tempo. Com LocMemCache cada processo tem o
    seu próprio dicionário: o cadeado passa nos testes e deixa de ser um
    cadeado em produção, sem nada acusar.
    """
    assert 'redis' in settings.CACHES['default']['BACKEND'].lower()


def test_add_continua_sendo_setnx():
    """A propriedade da qual o cadeado depende, exercitada de verdade."""
    cache.delete('prova-de-setnx')
    assert cache.add('prova-de-setnx', '1', 30) is True
    assert cache.add('prova-de-setnx', '2', 30) is False, 'add sobrescreveu'
    assert cache.get('prova-de-setnx') == '1'
    cache.delete('prova-de-setnx')


def test_clear_apaga_o_banco_inteiro_e_nao_so_o_prefixo():
    """
    O fato que torna o banco separado obrigatório, travado como teste para
    ninguém "simplificar" o conftest de volta para um prefixo só.
    """
    from django_redis import get_redis_connection

    conexao = get_redis_connection('default')
    conexao.set('outro-prefixo-qualquer:chave', 'x', ex=60)

    cache.clear()

    assert conexao.get('outro-prefixo-qualquer:chave') is None, (
        'clear() passou a respeitar o prefixo — a proteção do banco separado '
        'pode ser revista, mas só depois de medir de novo')
