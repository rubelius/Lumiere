"""
Testes do filtro de resultados de busca por torrent.

Havia duas cópias deste filtro — uma na view, outra na task. A da view lia
`min_resolution` do pedido e nunca o aplicava, então releases abaixo do piso
eram gravadas e devolvidas ao usuário como se ele não tivesse pedido nada.
"""

import pytest

from apps.movies.utils import passa_no_filtro

BOM = {'seeders': 50, 'resolution': '1080p', 'is_remux': True, 'has_atmos': True}


def com(**mudancas):
    return {**BOM, **mudancas}


def test_resolucao_abaixo_do_piso_e_recusada():
    """O critério que a view lia e jogava fora."""
    assert not passa_no_filtro(com(resolution='720p'), {'min_resolution': '1080p'})
    assert not passa_no_filtro(com(resolution='480p'), {'min_resolution': '1080p'})


def test_resolucao_no_piso_ou_acima_passa():
    assert passa_no_filtro(com(resolution='1080p'), {'min_resolution': '1080p'})
    assert passa_no_filtro(com(resolution='2160p'), {'min_resolution': '1080p'})


def test_resolucao_ilegivel_nao_passa_por_piso_conhecido():
    """
    Título de onde não se extraiu resolução não pode entrar como se fosse boa:
    o pedido diz um piso, e não sabemos se este resultado o alcança.
    """
    assert not passa_no_filtro(com(resolution=None), {'min_resolution': '1080p'})
    assert not passa_no_filtro(com(resolution='CAM'), {'min_resolution': '720p'})


@pytest.mark.parametrize('mudanca, filtros', [
    ({'seeders': 2}, {'min_seeders': 5}),
    ({'is_remux': False}, {'prefer_remux': True}),
    ({'has_atmos': False, 'has_dtsx': False, 'has_truehd': False},
     {'require_advanced_audio': True}),
])
def test_demais_criterios_continuam_valendo(mudanca, filtros):
    assert not passa_no_filtro(com(**mudanca), {'min_resolution': '480p', **filtros})


def test_piso_padrao_e_1080p():
    """Sem pedido explícito, o padrão é o mesmo que a view e a task usavam."""
    assert not passa_no_filtro(com(resolution='720p'), {})
    assert passa_no_filtro(com(resolution='1080p'), {})
