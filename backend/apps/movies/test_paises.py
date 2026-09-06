"""
Testes da normalização de origem.

O campo `country` mistura três formatos, e contá-lo cru produziu "423 países
representados" num mundo que tem menos de 200.
"""

import pytest

from apps.movies.paises import origens_distintas, para_codigo, separa


@pytest.mark.parametrize('valor, esperado', [
    ('UK-Germany-Sweden-Belgium-USA', ['UK', 'Germany', 'Sweden', 'Belgium', 'USA']),
    ('Canada-France', ['Canada', 'France']),
    ('US', ['US']),
    ('  France  ', ['France']),
    ('', []),
])
def test_separa_coproducao(valor, esperado):
    assert list(separa(valor)) == esperado


@pytest.mark.parametrize('origem, codigo', [
    ('US', 'US'),
    ('USA', 'US'),          # o mesmo país, contado duas vezes antes
    ('France', 'FR'),
    ('Hong Kong', 'HK'),
    ('South Korea', 'KR'),
])
def test_nome_e_codigo_convergem(origem, codigo):
    assert para_codigo(origem) == codigo


@pytest.mark.parametrize('historico', ['USSR', 'West Germany', 'Czechoslovakia'])
def test_estado_historico_nao_vira_o_sucessor(historico):
    """
    Mapear USSR para RU seria decisão editorial disfarçada de normalização:
    um filme soviético de 1970 não é um filme russo. Sem código ISO vigente,
    a origem fica como está e conta como origem própria.
    """
    assert para_codigo(historico) == historico
    assert para_codigo(historico) not in ('RU', 'DE', 'CZ')


def test_us_e_usa_contam_como_um_pais_so():
    assert len(origens_distintas(['US', 'USA', 'United States'])) == 1


def test_coproducao_nao_e_um_pais():
    """'UK-Germany' contava como uma origem distinta de 'UK' e de 'Germany'."""
    assert origens_distintas(['UK-Germany', 'UK', 'Germany']) == {'GB', 'DE'}


def test_valor_vazio_nao_vira_origem():
    assert origens_distintas(['', None, '  ', '-']) == set()


@pytest.mark.parametrize('a, b', [
    ('UK', 'GB'),               # o mesmo país em duas grafias
    ('SU', 'USSR'),             # código e nome do mesmo estado histórico
    ('YU', 'Yugoslavia'),
    ('XC', 'Czechoslovakia'),
    ('XG', 'East Germany'),
])
def test_grafias_do_mesmo_lugar_convergem(a, b):
    """
    Cada um destes pares aparece no acervo nas duas formas. Sem convergir,
    cada lugar era contado duas vezes — 'SU' em 387 filmes e 'USSR' em 44.
    """
    assert para_codigo(a) == para_codigo(b)


def test_uk_e_gb_sao_um_pais_so():
    assert origens_distintas(['UK', 'GB', 'UK-France']) == {'GB', 'FR'}


def test_sovietico_nao_e_russo():
    """Contar SU como RU apagaria uma cinematografia inteira da contagem."""
    assert len(origens_distintas(['SU', 'RU'])) == 2
