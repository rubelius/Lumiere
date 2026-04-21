import asyncio

from adrf.decorators import api_view
from adrf.viewsets import ViewSet
from apps.core.core_cache import CacheManager
from apps.core.permissions import IsOwner, IsPremiumUser
from apps.core.throttling import ExpensiveOperationThrottle
from apps.integrations.prowlarr import ProwlarrClient
from apps.integrations.realdebrid import RealDebridClient
from apps.movies.utils import calculate_quality_score, parse_quality_from_title
from django.db.models import Q
from django.shortcuts import render
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .filters import MovieFilter, TorrentReleaseFilter
from .models import Movie, TorrentRelease
from .serializers import (MovieDetailSerializer, MovieListSerializer,
                          TorrentReleaseCreateSerializer,
                          TorrentReleaseSerializer)


class AsyncMovieViewSet(ViewSet):
    """Async ViewSet para operações I/O bound"""
    
    async def list(self, request):
        """Async list endpoint"""
        from django.db import models

        # Async query (Django 5.0+)
        movies = []
        async for movie in Movie.objects.all()[:20]:
            movies.append(movie)
        
        return Response({
            'count': len(movies),
            'results': [...]
        })

class CinemaSessionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsOwner]
    
    def get_permissions(self):
        """Define permissões por action"""
        if self.action == 'list':
            permission_classes = [IsAuthenticated]
        elif self.action in ['create', 'update', 'partial_update', 'destroy']:
            permission_classes = [IsAuthenticated, IsOwner]
        else:
            permission_classes = [IsAuthenticated]
        
        return [permission() for permission in permission_classes]

class MovieViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet para filmes
    
    Endpoints:
    - GET /api/movies/ - Lista filmes com filtros
    - GET /api/movies/{id}/ - Detalhes do filme
    - GET /api/movies/top_rated/ - Top 100 TSPDT
    - GET /api/movies/search/ - Busca avançada
    - POST /api/movies/{id}/search_torrents/ - Buscar torrents
    """
    permission_classes = [IsAuthenticated]
    queryset = Movie.objects.all()
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = MovieFilter
    search_fields = ['title', 'original_title', 'director', 'overview']
    ordering_fields = ['year', 'ranking_2026', 'tmdb_rating', 'created_at']
    ordering = ['ranking_2026']
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return MovieDetailSerializer
        return MovieListSerializer
    
    def get_queryset(self):
        """Optimize queries"""
        queryset = super().get_queryset()
        
        if self.action == 'retrieve':
            queryset = queryset.prefetch_related(
                'torrent_releases',
                #'similarities__similar_movie'
            )
        
        return queryset
    
    @action(detail=False, methods=['get'])
    def top_rated(self, request):
        """Top 100 filmes do TSPDT 2026"""
        movies = self.queryset.filter(
            ranking_2026__isnull=False
        ).order_by('ranking_2026')[:100]
        
        serializer = self.get_serializer(movies, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def available(self, request):
        """Filmes já disponíveis no Plex ou Real-Debrid"""
        movies = self.queryset.filter(
            Q(in_plex=True) | Q(available_instantly=True)
        )
        
        page = self.paginate_queryset(movies)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(movies, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def search_torrents(self, request, pk=None):
        """
        Busca torrents para o filme via Prowlarr
        
        Body:
        {
            "min_resolution": "1080p",
            "prefer_remux": true,
            "require_advanced_audio": false,
            "min_seeders": 5
        }
        """
        movie = self.get_object()
        
        # TODO: Implementar integração Prowlarr (próxima seção)
        # Por enquanto, retorna releases já existentes
        
        # Parâmetros de busca
        min_resolution = request.data.get('min_resolution', '1080p')
        prefer_remux = request.data.get('prefer_remux', False)
        require_advanced_audio = request.data.get('require_advanced_audio', False)
        min_seeders = request.data.get('min_seeders', 5)
        
        # Filtrar releases
        releases = movie.torrent_releases.filter(
            seeders__gte=min_seeders
        )
        
        if prefer_remux:
            releases = releases.filter(is_remux=True)
        
        if require_advanced_audio:
            releases = releases.filter(
                Q(has_atmos=True) | Q(has_dtsx=True) | Q(has_truehd=True)
            )
        
        releases = releases.order_by('-quality_score')[:20]
        
        serializer = TorrentReleaseSerializer(releases, many=True)
        
        return Response({
            'movie': MovieDetailSerializer(movie).data,
            'releases': serializer.data,
            'total_found': releases.count()
        })
    
    @action(detail=True, methods=['get'])
    def recommendations(self, request, pk=None):
        """Recomendações baseadas neste filme"""
        movie = self.get_object()
        
        from apps.ml.models import MovieSimilarity

        # Get similar movies
        similarities = MovieSimilarity.objects.filter(
            movie=movie
        ).select_related('similar_movie').order_by('-overall_similarity')[:20]
        
        recommendations = []
        for sim in similarities:
            recommendations.append({
                'movie': MovieListSerializer(sim.similar_movie).data,
                'similarity_score': float(sim.overall_similarity),
                'similarity_type': sim.similarity_type,
                'reason': f"Similar {sim.similarity_type.replace('_', ' ')}"
            })
        
        return Response({
            'based_on': MovieListSerializer(movie).data,
            'recommendations': recommendations
        })
    
    @action(detail=True, methods=['post'])
    def search_torrents(self, request, pk=None):
        """Busca torrents via Prowlarr"""
        movie = self.get_object()
        user = request.user
        
        # Verificar se usuário tem Prowlarr configurado
        if not user.prowlarr_url or not user.prowlarr_api_key:
            return Response(
                {'error': 'Prowlarr not configured. Please configure in settings.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Parâmetros de busca
        min_resolution = request.data.get('min_resolution', '1080p')
        prefer_remux = request.data.get('prefer_remux', False)
        require_advanced_audio = request.data.get('require_advanced_audio', False)
        min_seeders = request.data.get('min_seeders', 5)
        
        # Buscar via Prowlarr
        async def search_async():
            client = ProwlarrClient(user.prowlarr_url, user.prowlarr_api_key)
            try:
                results = await client.search_movie(
                    title=movie.title,
                    year=movie.year,
                    imdb_id=movie.imdb_id
                )
                return results
            finally:
                await client.close()
        
        # Executar busca assíncrona
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        prowlarr_results = loop.run_until_complete(search_async())
        loop.close()
        
        # Processar e salvar releases
        created_releases = []
        for result in prowlarr_results:
            # Parse quality
            quality_data = parse_quality_from_title(result['title'])
            result.update(quality_data)
            
            # Calculate scores
            scores = calculate_quality_score(result)
            result.update(scores)
            
            # Filtrar por critérios
            if result['seeders'] < min_seeders:
                continue
            
            if prefer_remux and not result.get('is_remux'):
                continue
            
            if require_advanced_audio:
                if not (result.get('has_atmos') or result.get('has_dtsx') or result.get('has_truehd')):
                    continue
            
            # Criar ou atualizar release
            release, created = TorrentRelease.objects.update_or_create(
                info_hash=result['info_hash'],
                defaults={
                    'movie': movie,
                    **result
                }
            )
            
            if created:
                created_releases.append(release)
        
        # Retornar resultados
        serializer = TorrentReleaseSerializer(
            TorrentRelease.objects.filter(
                movie=movie
            ).order_by('-quality_score')[:20],
            many=True
        )
        
        return Response({
            'movie': MovieDetailSerializer(movie).data,
            'releases': serializer.data,
            'new_releases_found': len(created_releases),
            'total_releases': TorrentRelease.objects.filter(movie=movie).count()
        })
        
    @action(detail=True, methods=['post'])
    def search_torrents(self, request, pk=None):
        """
        Busca torrents - operação custosa
        Throttle: 10 por hora
        """
        self.throttle_classes = [ExpensiveOperationThrottle]
        self.check_throttles(request)

    @method_decorator(cache_page(60 * 30))  # Cache por 30 minutos
    def list(self, request, *args, **kwargs):
        """Lista com cache"""
        return super().list(request, *args, **kwargs)
    
    def retrieve(self, request, *args, **kwargs):
        """Retrieve com cache manual"""
        movie_id = kwargs.get('pk')
        
        # Try cache first
        cached_data = CacheManager.get_movie(movie_id)
        if cached_data:
            return Response(cached_data)
        
        # Get from DB
        movie = self.get_object()
        serializer = self.get_serializer(movie)
        data = serializer.data
        
        # Cache result
        CacheManager.set_movie(movie_id, data, timeout=3600)
        
        return Response(data)
    
    def get_queryset(self):
        """Optimize queries with select_related and prefetch_related"""
        queryset = Movie.objects.all()
        
        if self.action == 'list':
            # List view - only necessary fields
            queryset = queryset.only(
                'id', 'title', 'year', 'director',
                'poster_url', 'ranking_2026'
            )
        
        elif self.action == 'retrieve':
            # Detail view - prefetch related data
            queryset = queryset.prefetch_related(
                'torrent_releases',
                #'similarities__similar_movie',
            )
        
        return queryset
    
    @action(detail=False)
    def with_releases(self, request):
        """
        Movies com releases - optimize N+1
        
        BAD: N+1 queries
        for movie in movies:
            releases = movie.torrent_releases.all()
        
        GOOD: 2 queries
        movies = Movie.objects.prefetch_related('torrent_releases')
        """
        movies = Movie.objects.prefetch_related(
            'torrent_releases'
        )[:20]
        
        serializer = self.get_serializer(movies, many=True)
        return Response(serializer.data)


class TorrentReleaseViewSet(viewsets.ModelViewSet):
    """ViewSet para gerenciar releases de torrent"""
    permission_classes = [IsAuthenticated]
    queryset = TorrentRelease.objects.all()
    serializer_class = TorrentReleaseSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = [
        'movie', 'resolution', 'is_remux', 'has_atmos', 
        'instantly_available', 'in_realdebrid'
    ]
    ordering_fields = ['quality_score', 'seeders', 'found_at']
    ordering = ['-quality_score', '-seeders']
    
    def get_queryset(self):
        """Filter by user's movies or public releases"""
        queryset = super().get_queryset()
        
        # Optionally filter by movie
        movie_id = self.request.query_params.get('movie_id')
        if movie_id:
            queryset = queryset.filter(movie_id=movie_id)
        
        return queryset
    
    @action(detail=True, methods=['post'])
    def add_to_realdebrid(self, request, pk=None):
        """
        Adiciona release ao Real-Debrid
        """
        release = self.get_object()
        user = request.user
        
        # Verificar configuração
        if not user.realdebrid_api_key:
            return Response(
                {'error': 'Real-Debrid not configured'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Adicionar ao RD
        async def add_async():
            client = RealDebridClient(user.realdebrid_api_key)
            try:
                # Add magnet
                torrent_id = await client.add_magnet(release.magnet_link)
                
                # Select files (seleciona maior arquivo = filme)
                info = await client.get_torrent_info(torrent_id)
                if info.get('files'):
                    largest_file = max(info['files'], key=lambda f: f.get('bytes', 0))
                    await client.select_files(torrent_id, [largest_file['id']])
                
                return torrent_id
            finally:
                await client.close()
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            torrent_id = loop.run_until_complete(add_async())
        except Exception as e:
            return Response(
                {'error': f'Failed to add to Real-Debrid: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        finally:
            loop.close()
        
        # Atualizar release
        release.in_realdebrid = True
        release.realdebrid_id = torrent_id
        release.realdebrid_status = 'downloading'
        release.realdebrid_added_at = timezone.now()
        release.save()
        
        return Response({
            'message': 'Added to Real-Debrid',
            'torrent_id': torrent_id,
            'release': TorrentReleaseSerializer(release).data
        })