"""
Um pedido que se perdeu não pode ser respondido com o resultado anterior.

O DEFEITO: o documento de andamento expira em 5 minutos; o de resultado vive
uma hora. Passados 5 minutos sem ninguém executar a task — worker fora do ar,
fila lenta, broker acumulando —, a chave de andamento some e a leitura cai no
RESULTADO ANTERIOR. A tela escrevia "NENHUMA CÓPIA NOVA — OS INDEXADORES
RESPONDERAM E NÃO HAVIA NADA ALÉM DO QUE JÁ ESTÁ AQUI", destravava o botão, e
dava por respondida uma busca que nunca rodou.

E o segundo defeito do mesmo endereço: essa frase também era dita quando a
busca trouxe cópias do filme certo e o filtro barrou todas. "Não existe" e
"seu filtro recusou doze" pedem ações opostas.
"""

import pytest
from django.core.cache import cache
from django.utils import timezone

from apps.movies.release_search import (CHAVE_PEDIDO, CHAVE_RESULTADO,
                                        CONCLUIDA, PERDIDA, documento,
                                        estado_da_busca, marca_enfileirada)

FILME = 'ffffffff-0000-0000-0000-000000000000'


@pytest.fixture(autouse=True)
def limpa():
    for chave in (CHAVE_PEDIDO, CHAVE_RESULTADO):
        cache.delete(chave.format(FILME))
    cache.delete(f'busca_releases:andamento:{FILME}')
    yield


def resultado_de(quando, **campos):
    cache.set(CHAVE_RESULTADO.format(FILME),
              documento(FILME, estado=CONCLUIDA, concluida_em=quando,
                        new_releases_found=0, **campos),
              3600)


def test_pedido_mais_novo_que_o_resultado_e_um_pedido_perdido():
    resultado_de('2026-09-16T10:00:00+00:00')
    cache.set(CHAVE_PEDIDO.format(FILME), '2026-09-16T11:00:00+00:00', 3600)

    estado = estado_da_busca(FILME)
    assert estado['estado'] == PERDIDA, (
        'o resultado de uma hora atrás respondeu por um pedido que nunca rodou')
    assert 'FORA DO AR' in (estado['erro'] or '')


def test_resultado_posterior_ao_pedido_responde_normalmente():
    cache.set(CHAVE_PEDIDO.format(FILME), '2026-09-16T10:00:00+00:00', 3600)
    resultado_de('2026-09-16T10:00:30+00:00')

    assert estado_da_busca(FILME)['estado'] == CONCLUIDA


def test_sem_pedido_nenhum_o_resultado_vale():
    """Quem nunca clicou vê o resultado guardado, como sempre viu."""
    resultado_de('2026-09-16T10:00:00+00:00')
    assert estado_da_busca(FILME)['estado'] == CONCLUIDA


def test_o_andamento_continua_ganhando_de_tudo():
    """A regra antiga não pode ter sido quebrada pela nova."""
    resultado_de('2026-09-16T10:00:00+00:00')
    doc = marca_enfileirada(FILME)
    assert doc is not None
    assert estado_da_busca(FILME)['estado'] == 'enfileirada'


def test_reivindicar_grava_um_carimbo_que_sobrevive_ao_andamento():
    """
    É o carimbo que permite descobrir depois que o pedido se perdeu. Sem ele,
    a expiração do andamento apaga qualquer vestígio de que alguém pediu.
    """
    marca_enfileirada(FILME)
    assert cache.get(CHAVE_PEDIDO.format(FILME)) is not None

    # O andamento expira; o carimbo fica.
    cache.delete(f'busca_releases:andamento:{FILME}')
    resultado_de('2020-01-01T00:00:00+00:00')
    assert estado_da_busca(FILME)['estado'] == PERDIDA


def test_resultado_sem_carimbo_de_conclusao_nao_responde_por_um_pedido():
    """
    Um resultado que não diz QUANDO terminou não pode ser usado para afirmar
    que terminou depois do pedido. A resposta pessimista é a certa: o custo de
    errar para cá é um "tente de novo" a mais; para o outro lado, é dar por
    respondida uma busca que nunca rodou.
    """
    cache.set(CHAVE_RESULTADO.format(FILME),
              documento(FILME, estado=CONCLUIDA, new_releases_found=0), 3600)
    cache.set(CHAVE_PEDIDO.format(FILME), '2026-09-16T11:00:00+00:00', 3600)

    assert estado_da_busca(FILME)['estado'] == PERDIDA
