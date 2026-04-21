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