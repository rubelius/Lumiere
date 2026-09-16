"""
Buscar por diretor, ator ou gênero — não só por título.

O DEFEITO: `MovieFilter` declarava `search = CharFilter(field_name='title',
lookup_expr='icontains')`, com o comentário "busca legada (mantida por
segurança)". Ele rodava ANTES do motor de busca da view — `list()` chama
`filter_queryset()` primeiro — e reduzia o queryset ao que casasse no TÍTULO. O
motor híbrido recebia os restos.

MEDIDO pelo endpoint, antes e depois de remover a linha:

    tarantino    0  ->  246        Kurosawa    0  ->   85
    Godard       2  ->  290        Tarkovky    0  ->  116

"Godard" devolvia 2 porque dois filmes têm o nome dele no título.

E não havia teste nenhum de busca por pessoa — foi por isso que a linha
sobreviveu. Estes testes não medem quantos: medem que buscar por quem FEZ o
filme, e não por como ele se chama, devolve alguma coisa.
"""

import pytest
from rest_framework.test import APIClient

from apps.movies.models import Movie


@pytest.fixture
def api(db, django_user_model):
    user = django_user_model.objects.create_user(username='b', password='x')
    cliente = APIClient()
    cliente.force_authenticate(user=user)
    return cliente


@pytest.fixture
def acervo(db):
    Movie.objects.create(
        title='Pulp Fiction: Tempo de Violência', original_title='Pulp Fiction',
        year=1994, director='Quentin Tarantino', country='USA',
        overview='Dois assassinos profissionais.')
    Movie.objects.create(
        title='Os Sete Samurais', original_title='Shichinin no samurai',
        year=1954, director='Akira Kurosawa', country='Japan',
        overview='Uma aldeia contrata sete guerreiros.')
    Movie.objects.create(
        title='Cidadão Kane', original_title='Citizen Kane', year=1941,
        director='Orson Welles', country='USA', overview='Rosebud.')


def busca(api, termo):
    return api.get('/api/movies/', {'search': termo})


@pytest.mark.django_db
def test_buscar_por_diretor_encontra_os_filmes_dele(api, acervo):
    """O caso do relato: "tarantino" não devolvia nada."""
    r = busca(api, 'tarantino')
    assert r.status_code == 200
    assert r.data['count'] >= 1, 'buscar por diretor voltou a não achar nada'
    assert any('Pulp Fiction' in m['title'] for m in r.data['results'])


@pytest.mark.django_db
def test_o_nome_do_diretor_no_titulo_nao_e_o_que_faz_funcionar(api, acervo):
    """
    Kurosawa não aparece em nenhum título do acervo de teste. Se o resultado
    vier, veio do campo `director` — que é o ponto.
    """
    r = busca(api, 'Kurosawa')
    assert r.data['count'] >= 1
    assert all('Kurosawa' not in m['title'] for m in r.data['results'])


@pytest.mark.django_db
def test_buscar_por_titulo_continua_funcionando(api, acervo):
    r = busca(api, 'Cidadão Kane')
    assert r.data['count'] >= 1


@pytest.mark.django_db
def test_o_titulo_original_tambem_conta(api, acervo):
    """Metade do acervo é estrangeiro; procurar pelo nome de origem é comum."""
    assert busca(api, 'Shichinin').data['count'] >= 1


@pytest.mark.django_db
def test_busca_vazia_nao_quebra_nem_filtra(api, acervo):
    r = api.get('/api/movies/')
    assert r.status_code == 200
    assert r.data['count'] == 3


@pytest.mark.django_db
def test_termo_sem_resposta_devolve_lista_vazia_e_nao_erro(api, acervo):
    r = busca(api, 'zzzzznaoexistezzzzz')
    assert r.status_code == 200
    assert r.data['count'] == 0
