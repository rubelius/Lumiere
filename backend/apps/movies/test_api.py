# apps/movies/test_api.py

import pytest
from apps.movies.models import Movie
from rest_framework.test import APIClient


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def authenticated_client(api_client, django_user_model):
    user = django_user_model.objects.create_user(
        username='testuser',
        password='testpass123'
    )
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def sample_movie():
    return Movie.objects.create(
        title='Test Movie',
        year=2020,
        director='Test Director'
    )


@pytest.mark.django_db
def test_list_movies(authenticated_client, sample_movie):
    response = authenticated_client.get('/api/movies/')
    assert response.status_code == 200
    assert len(response.data['results']) == 1


@pytest.mark.django_db
def test_unauthenticated_access(api_client):
    response = api_client.get('/api/movies/')
    assert response.status_code == 401

@pytest.mark.django_db
def test_listagem_nao_faz_consulta_extra_por_filme():
    """
    `.only()` com campo faltando não dá erro: o Django busca o campo ausente
    numa consulta separada, por objeto, e o resultado sai correto. Cinco
    campos do MovieListSerializer estavam fora da lista, e uma página de 20
    filmes custava 101 consultas — cem vezes mais do que sem otimização
    nenhuma.
    """
    from django.db import connection
    from django.test.utils import CaptureQueriesContext

    from apps.movies.models import Movie
    from apps.movies.serializers import MovieListSerializer, campos_da_listagem

    for i in range(5):
        Movie.objects.create(title=f'Filme {i}', year=2000 + i, ranking_current=i + 1)

    with CaptureQueriesContext(connection) as ctx:
        filmes = list(Movie.objects.only(*campos_da_listagem()).order_by('ranking_current')[:5])
        MovieListSerializer(filmes, many=True).data

    assert len(ctx.captured_queries) == 1, (
        f'{len(ctx.captured_queries)} consultas para 5 filmes: algum campo lido '
        f'pelo serializer ficou fora de campos_da_listagem()')
