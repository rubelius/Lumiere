from apps.movies.models import Movie, TorrentRelease
from apps.movies.utils import calculate_quality_score, parse_quality_from_title
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

# Create your tests here.
# apps/movies/tests.py


User = get_user_model()


class MovieAPITestCase(TestCase):
    """Testes para API de filmes"""
    
    def setUp(self):
        """Setup executado antes de cada teste"""
        self.client = APIClient()
        
        # Create test user
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        
        # Authenticate
        response = self.client.post('/api/auth/token/', {
            'username': 'testuser',
            'password': 'testpass123'
        })
        self.token = response.data['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        
        # Create test movie
        self.movie = Movie.objects.create(
            title='The Godfather',
            original_title='The Godfather',
            year=1972,
            director='Francis Ford Coppola',
            country='USA',
            length_minutes=175,
            primary_genre='Crime',
            ranking_2026=1,
        )
    '''
    def test_list_movies(self):
        """Teste listagem de filmes"""
        response = self.client.get('/api/movies/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['title'], 'The Godfather')
    '''
    
    def test_get_movie_detail(self):
        """Teste detalhes de filme"""
        response = self.client.get(f'/api/movies/{self.movie.id}/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], 'The Godfather')
        self.assertEqual(response.data['year'], 1972)
    
    def test_top_rated(self):
        """Teste endpoint top_rated"""
        response = self.client.get('/api/movies/top_rated/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreater(len(response.data), 0)
        self.assertEqual(response.data[0]['title'], 'The Godfather')
    
    def test_unauthenticated_access(self):
        """Teste acesso sem autenticação"""
        self.client.credentials()  # Remove token
        
        response = self.client.get('/api/movies/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class QualityAlgorithmTestCase(TestCase):
    """Testes para algoritmo de qualidade"""
    
    def test_parse_remux_4k_atmos(self):
        """Teste parsing de release premium"""
        title = "The.Godfather.1972.2160p.UHD.BluRay.REMUX.HDR.DV.Atmos.TrueHD.7.1.x265-FraMeSToR"
        
        result = parse_quality_from_title(title)
        
        self.assertEqual(result['resolution'], '2160p')
        self.assertTrue(result['is_4k'])
        self.assertTrue(result['is_remux'])
        self.assertTrue(result['has_dolby_vision'])
        self.assertTrue(result['has_atmos'])
        self.assertEqual(result['audio_channels'], '7.1')
        self.assertEqual(result['release_group'], 'FraMeSToR')
    
    def test_calculate_perfect_score(self):
        """Teste score perfeito (100)"""
        release_data = {
            'is_remux': True,
            'has_atmos': True,
            'audio_channels': '7.1',
            'has_dolby_vision': True,
            'release_group': 'FraMeSToR',
            'seeders': 150,
            'has_hardcoded_subs': False,
        }
        
        scores = calculate_quality_score(release_data)
        
        self.assertEqual(scores['video_score'], 30)
        self.assertEqual(scores['audio_score'], 30)  # 25 + 5
        self.assertEqual(scores['hdr_score'], 15)
        self.assertEqual(scores['release_score'], 10)
        self.assertEqual(scores['seeds_score'], 5)
        self.assertEqual(scores['quality_score'], 90)
    
    def test_hardcoded_subs_penalty(self):
        """Teste penalidade de legendas hardcoded"""
        title = "Movie.2020.1080p.BluRay.x264.HC.AAC-GROUP"
        
        result = parse_quality_from_title(title)
        self.assertTrue(result['has_hardcoded_subs'])
        
        scores = calculate_quality_score(result)
        # Score deve ser reduzido em 10
        self.assertLess(scores['quality_score'], 100)


class TorrentReleaseAPITestCase(TestCase):
    """Testes para API de releases"""
    
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123'
        )
        
        # Authenticate
        response = self.client.post('/api/auth/token/', {
            'username': 'testuser',
            'password': 'testpass123'
        })
        self.token = response.data['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        
        self.movie = Movie.objects.create(
            title='The Godfather',
            year=2020,
            director='Francis Ford Coppola'
        )
    
    # apps/movies/tests.py
    def test_create_release_auto_parse(self):
        # Criar movie PRIMEIRO
        movie = Movie.objects.create(
            title="The Godfather",
            year=2024,
            director="Francis Ford Coppola",
            tspdt_id="12345"
        )
        
        # Agora criar release
        release = TorrentRelease.objects.create(
            movie=movie,  # ✅ Adicionar movie
            title="Movie.2024.2160p.REMUX.DV.HDR.DTS-HD.MA.7.1.HEVC-FraMeSToR",
            info_hash="abc123",
            size_bytes=50000000000
        )

