import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from unittest.mock import patch

from apps.movies.models import Movie
from apps.user_sessions.models import CinemaSession, SessionTheme

User = get_user_model()

@pytest.fixture
def api_client():
    return APIClient()

@pytest.fixture
def auth_client(api_client):
    user = User.objects.create_user(username='tester', password='password123')
    response = api_client.post('/api/auth/token/', {'username': 'tester', 'password': 'password123'})
    token = response.data['access']
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
    api_client.user = user
    return api_client

@pytest.fixture
def setup_data():
    theme = SessionTheme.objects.create(name='Sci-Fi Night', emoji='👽', description='Space!')
    # CORREÇÃO 1: Adicionado o campo "year" que é obrigatório no banco
    movie1 = Movie.objects.create(title='Interstellar', year=2014, length_minutes=169)
    movie2 = Movie.objects.create(title='Alien', year=1979, length_minutes=117)
    return {'theme': theme, 'movie1': movie1, 'movie2': movie2}

@pytest.mark.django_db
class TestCinemaSessionAPI:

    def test_create_session_success(self, auth_client, setup_data):
        payload = {
            'name': 'Friday Movie Night',
            'scheduled_date': (timezone.now() + timezone.timedelta(days=1)).isoformat(),
            'theme_id': str(setup_data['theme'].id),
            'theme_type': 'custom',
            'movie_ids': [str(setup_data['movie1'].id), str(setup_data['movie2'].id)]
        }

        response = auth_client.post('/api/sessions/', payload, format='json')
        
        assert response.status_code == 201
        assert response.data['name'] == 'Friday Movie Night'
        assert response.data['movie_count'] == 2
        assert response.data['estimated_duration_minutes'] == 286

    def test_create_session_invalid_movie(self, auth_client, setup_data):
        payload = {
            'name': 'Bad Session',
            'scheduled_date': timezone.now().isoformat(),
            'theme_type': 'custom',
            'movie_ids': ['00000000-0000-0000-0000-000000000000']
        }
        
        response = auth_client.post('/api/sessions/', payload, format='json')
        
        assert response.status_code == 400
        assert response.data['error']['code'] == 'VALIDATION_ERROR'
        assert 'movie_ids' in response.data['error']['fields']

    @patch('apps.tasks.sessions.prepare_session.delay')
    def test_prepare_session_state_machine(self, mock_prepare, auth_client, setup_data):
        # CORREÇÃO 2: Adicionado o campo "scheduled_date"
        session = CinemaSession.objects.create(
            user=auth_client.user,
            name='Test Prep',
            status='planning',
            scheduled_date=timezone.now() + timezone.timedelta(days=1)
        )

        response = auth_client.post(f'/api/sessions/{session.id}/prepare/')
        
        assert response.status_code == 200
        assert response.data['session']['status'] == 'preparing'
        mock_prepare.assert_called_once_with(str(session.id))

    def test_prepare_session_wrong_state(self, auth_client):
        # CORREÇÃO 3: Adicionado o campo "scheduled_date"
        session = CinemaSession.objects.create(
            user=auth_client.user,
            name='Already Ready',
            status='ready',
            scheduled_date=timezone.now() + timezone.timedelta(days=1)
        )

        response = auth_client.post(f'/api/sessions/{session.id}/prepare/')
        
        assert response.status_code == 400
        assert response.data['error']['code'] == 'VALIDATION_ERROR'