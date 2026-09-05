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
            ranking_current=1,
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
        """
        O endpoint ordena por ranking_current, onde 1 é o melhor.

        Com um único filme no banco — como era antes — a asserção passava com
        a ordem invertida, com a ordenação removida, com qualquer coisa. Só
        uma lista com mais de um item testa ordem.
        """
        Movie.objects.create(title='Filme do meio', year=1980, ranking_current=50)
        Movie.objects.create(title='Filme do fim', year=1990, ranking_current=900)
        # Sem ranking não entra na lista: o endpoint filtra isnull=False.
        Movie.objects.create(title='Sem ranking', year=2000, ranking_current=None)

        response = self.client.get('/api/movies/top_rated/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [m['title'] for m in response.data],
            ['The Godfather', 'Filme do meio', 'Filme do fim'],
        )
    
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
        self.assertEqual(scores['audio_score'], 40)  # 25 + 5
        self.assertEqual(scores['hdr_score'], 15)
        self.assertEqual(scores['release_score'], 10)
        self.assertEqual(scores['seeds_score'], 5)
        self.assertEqual(scores['quality_score'], 100)
    
    def test_hardcoded_subs_penalty(self):
        """
        Legenda queimada na imagem custa 10 pontos.

        Antes o teste só afirmava que a nota era menor que 100 — coisa que um
        BluRay 1080p já é com folga, com ou sem a penalidade. Apagar o
        desconto do código deixava o teste passando. O que prova a penalidade
        é a DIFERENÇA entre o mesmo release com e sem a marca.
        """
        com_hc = parse_quality_from_title("Movie.2020.1080p.BluRay.x264.HC.AAC-GROUP")
        sem_hc = parse_quality_from_title("Movie.2020.1080p.BluRay.x264.AAC-GROUP")

        self.assertTrue(com_hc['has_hardcoded_subs'])
        self.assertFalse(sem_hc['has_hardcoded_subs'])

        nota_com = calculate_quality_score(com_hc)['quality_score']
        nota_sem = calculate_quality_score(sem_hc)['quality_score']

        self.assertEqual(nota_sem - nota_com, 10)


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

