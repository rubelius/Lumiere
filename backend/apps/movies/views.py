from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from django.utils import timezone
from asgiref.sync import sync_to_async

from apps.core.core_cache import CacheManager
from apps.core.throttling import ExpensiveOperationThrottle
from apps.integrations.prowlarr import ProwlarrClient
from apps.integrations.realdebrid import RealDebridClient
from apps.movies.utils import calculate_quality_score, parse_quality_from_title
from apps.ml.models import MovieSimilarity

from .filters import MovieFilter
from .models import Movie, TorrentRelease
from .serializers import (
    MovieDetailSerializer, 
    MovieListSerializer,
    TorrentReleaseSerializer
)

class AsyncMovieViewSet(viewsets.ViewSet):
    """Async ViewSet para operações I/O bound"""
    
    async def list(self, request):
        """Async list endpoint"""
        movies = []
        async for movie in Movie.objects.all()[:20]:
            movies.append(movie)
        
        return Response({
            'count': len(movies),
            'results': [movie.title for movie in movies]
        })

class MovieViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet para filmes
    """
    permission_classes = [IsAuthenticated]
    queryset = Movie.objects.all()
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = MovieFilter
    search_fields = ['title', 'original_title', 'director', 'overview']
    ordering_fields = ['year', 'ranking_2026', 'tmdb_rating', 'created_at']
    ordering = ['ranking_2026']
    
    def get_serializer_class(self):  # type: ignore
        if self.action == 'retrieve':
            return MovieDetailSerializer
        return MovieListSerializer
    
    def get_queryset(self):
        """Optimize queries with select_related and prefetch_related"""
        queryset = super().get_queryset()
        
        if self.action == 'list':
            queryset = queryset.only(
                'id', 'title', 'year', 'director',
                'poster_url', 'ranking_2026', 'in_plex', 'available_instantly'
            )
        elif self.action == 'retrieve':
            queryset = queryset.prefetch_related('torrent_releases')
            
        return queryset

    @method_decorator(cache_page(60 * 30))  # Cache por 30 minutos
    def list(self, request, *args, **kwargs):
        """Lista com cache"""
        return super().list(request, *args, **kwargs)
    
    def retrieve(self, request, *args, **kwargs):
        """Retrieve com cache manual"""
        # Resolvido o aviso de tipagem garantindo que é string
        movie_id = str(kwargs.get('pk'))
        
        cached_data = CacheManager.get_movie(movie_id)
        if cached_data:
            return Response(cached_data)
        
        movie = self.get_object()
        serializer = self.get_serializer(movie)
        data = serializer.data
        
        CacheManager.set_movie(movie_id, data, timeout=3600)
        return Response(data)
    
    @action(detail=False, methods=['get'])
    def top_rated(self, request):
        movies = self.queryset.filter(ranking_2026__isnull=False).order_by('ranking_2026')[:100]
        serializer = self.get_serializer(movies, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def available(self, request):
        movies = self.queryset.filter(Q(in_plex=True) | Q(available_instantly=True))
        page = self.paginate_queryset(movies)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(movies, many=True)
        return Response(serializer.data)
    
    @action(detail=False)
    def with_releases(self, request):
        """Movies com releases - optimize N+1"""
        # Rota restaurada conforme código original!
        movies = Movie.objects.prefetch_related('torrent_releases')[:20]
        serializer = self.get_serializer(movies, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def recommendations(self, request, pk=None):
        movie = self.get_object()
        similarities = MovieSimilarity.objects.filter(
            movie=movie
        ).select_related('similar_movie').order_by('-overall_similarity')[:20]
        
        recommendations = [{
            'movie': MovieListSerializer(sim.similar_movie).data,
            'similarity_score': float(sim.overall_similarity),
            'similarity_type': sim.similarity_type,
            'reason': f"Similar {str(sim.similarity_type).replace('_', ' ')}"
        } for sim in similarities]
        
        return Response({
            'based_on': MovieListSerializer(movie).data,
            'recommendations': recommendations
        })
    
    @action(detail=True, methods=['post'], throttle_classes=[ExpensiveOperationThrottle])
    async def search_torrents(self, request, pk=None):
        """Busca torrents via Prowlarr (Implementação única, segura e assíncrona)"""
        movie = await sync_to_async(self.get_object)()
        user = request.user
        
        if not user.prowlarr_url or not user.prowlarr_api_key:
            return Response(
                {'error': 'Prowlarr not configured. Please configure in settings.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        min_resolution = request.data.get('min_resolution', '1080p')
        prefer_remux = request.data.get('prefer_remux', False)
        require_advanced_audio = request.data.get('require_advanced_audio', False)
        min_seeders = int(request.data.get('min_seeders', 5))
        
        client = ProwlarrClient(user.prowlarr_url, user.prowlarr_api_key)
        try:
            prowlarr_results = await client.search_movie(
                title=movie.title,
                year=movie.year,
                imdb_id=movie.imdb_id
            )
        finally:
            await client.close()
        
        created_releases = []
        for result in prowlarr_results:
            quality_data = parse_quality_from_title(result['title'])
            result.update(quality_data)
            scores = calculate_quality_score(result)
            result.update(scores)
            
            if result['seeders'] < min_seeders:
                continue
            if prefer_remux and not result.get('is_remux'):
                continue
            if require_advanced_audio and not (result.get('has_atmos') or result.get('has_dtsx') or result.get('has_truehd')):
                continue
            
            release, created = await sync_to_async(TorrentRelease.objects.update_or_create)(
                info_hash=result['info_hash'],
                defaults={'movie': movie, **result}
            )
            if created:
                created_releases.append(release)
                
        await sync_to_async(CacheManager.invalidate_movie)(str(movie.id))
        
        saved_releases = await sync_to_async(list)(
            TorrentRelease.objects.filter(movie=movie).order_by('-quality_score')[:20]
        )
        serializer = TorrentReleaseSerializer(saved_releases, many=True)
        total_count = await sync_to_async(TorrentRelease.objects.filter(movie=movie).count)()
        
        return Response({
            'movie_id': movie.id,
            'releases': serializer.data,
            'new_releases_found': len(created_releases),
            'total_releases': total_count
        })

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
        queryset = super().get_queryset()
        movie_id = self.request.query_params.get('movie_id')
        if movie_id:
            queryset = queryset.filter(movie_id=movie_id)
        return queryset
    
    @action(detail=True, methods=['post'])
    async def add_to_realdebrid(self, request, pk=None):
        """Adiciona release ao Real-Debrid de forma assíncrona segura"""
        release = await sync_to_async(self.get_object)()
        user = request.user
        
        if not user.realdebrid_api_key:
            return Response(
                {'error': 'Real-Debrid not configured'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        client = RealDebridClient(user.realdebrid_api_key)
        try:
            torrent_id = await client.add_magnet(release.magnet_link)
            info = await client.get_torrent_info(torrent_id)
            if info.get('files'):
                largest_file = max(info['files'], key=lambda f: f.get('bytes', 0))
                await client.select_files(torrent_id, [largest_file['id']])
                
            release.in_realdebrid = True
            release.realdebrid_id = torrent_id
            release.realdebrid_status = 'downloading'
            release.realdebrid_added_at = timezone.now()
            await sync_to_async(release.save)()
            
            return Response({
                'message': 'Added to Real-Debrid',
                'torrent_id': torrent_id
            })
        except Exception as e:
            return Response(
                {'error': f'Failed to add to Real-Debrid: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        finally:
            await client.close()