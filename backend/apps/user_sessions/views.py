from apps.core.permissions import IsOwner, IsPremiumUser
from django.shortcuts import render
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
# Create your views here.
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import CinemaSession, SessionMovie, SessionTheme
from .serializers import (CinemaSessionDetailSerializer,
                          CinemaSessionListSerializer, SessionThemeSerializer)


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

class CinemaSessionViewSet(viewsets.ModelViewSet):
    """
    ViewSet para sessões de cinema
    
    Endpoints:
    - GET /api/sessions/ - Lista sessões do usuário
    - POST /api/sessions/ - Cria nova sessão
    - GET /api/sessions/{id}/ - Detalhes da sessão
    - PATCH /api/sessions/{id}/ - Atualiza sessão
    - DELETE /api/sessions/{id}/ - Deleta sessão
    - GET /api/sessions/upcoming/ - Próximas sessões
    - POST /api/sessions/{id}/prepare/ - Inicia preparação
    - POST /api/sessions/{id}/start/ - Inicia sessão
    - POST /api/sessions/{id}/complete/ - Completa sessão
    """
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'theme_type']
    ordering = ['-scheduled_date']
    
    def get_queryset(self):
        """Retorna apenas sessões do usuário"""
        return CinemaSession.objects.filter(
            user=self.request.user
        ).prefetch_related(
            'session_movies__movie',
            'session_movies__selected_release',
            'theme'
        )
    
    def get_serializer_class(self):
        if self.action in ['retrieve', 'create', 'update', 'partial_update']:
            return CinemaSessionDetailSerializer
        return CinemaSessionListSerializer
    
    @action(detail=False, methods=['get'])
    def upcoming(self, request):
        """Sessões futuras (próximos 30 dias)"""
        now = timezone.now()
        thirty_days = now + timezone.timedelta(days=30)
        
        sessions = self.get_queryset().filter(
            scheduled_date__gte=now,
            scheduled_date__lte=thirty_days,
            status__in=['planning', 'preparing', 'ready']
        ).order_by('scheduled_date')
        
        serializer = self.get_serializer(sessions, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def past(self, request):
        """Sessões passadas"""
        sessions = self.get_queryset().filter(
            status__in=['completed', 'cancelled']
        ).order_by('-scheduled_date')
        
        page = self.paginate_queryset(sessions)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(sessions, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def prepare(self, request, pk=None):
        """
        Inicia preparação da sessão
        - Busca torrents para cada filme
        - Verifica disponibilidade instantânea
        - Inicia downloads se auto_download=True
        """
        session = self.get_object()
        
        if session.status != 'planning':
            return Response(
                {'error': 'Session must be in planning status'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # TODO: Trigger Celery task
        # from apps.tasks.sessions import prepare_session
        # prepare_session.delay(str(session.id))
        
        session.status = 'preparing'
        session.save()
        
        return Response({
            'message': 'Session preparation started',
            'session': self.get_serializer(session).data
        })
    
    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        """Inicia a sessão (marca como in_progress)"""
        session = self.get_object()
        
        if session.status != 'ready':
            return Response(
                {'error': 'Session must be ready to start'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        session.status = 'in_progress'
        session.actual_start_time = timezone.now()
        session.started_at = timezone.now()
        session.save()
        
        return Response({
            'message': 'Session started',
            'session': self.get_serializer(session).data
        })
    
    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Completa a sessão"""
        session = self.get_object()
        
        if session.status != 'in_progress':
            return Response(
                {'error': 'Session must be in progress'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        session.status = 'completed'
        session.actual_end_time = timezone.now()
        session.completed_at = timezone.now()
        session.save()
        
        return Response({
            'message': 'Session completed',
            'session': self.get_serializer(session).data
        })
    
    @action(detail=True, methods=['post'])
    def add_movie(self, request, pk=None):
        """
        Adiciona filme à sessão
        
        Body: {"movie_id": "uuid"}
        """
        session = self.get_object()
        movie_id = request.data.get('movie_id')
        
        if not movie_id:
            return Response(
                {'error': 'movie_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get next order number
        last_order = session.session_movies.order_by('-order').first()
        next_order = (last_order.order + 1) if last_order else 0
        
        # Create session movie
        session_movie = SessionMovie.objects.create(
            session=session,
            movie_id=movie_id,
            order=next_order
        )
        
        from apps.movies.serializers import MovieListSerializer
        return Response({
            'message': 'Movie added to session',
            'session_movie': {
                'id': str(session_movie.id),
                'movie': MovieListSerializer(session_movie.movie).data,
                'order': session_movie.order
            }
        })


class SessionThemeViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet para temas pré-definidos"""
    permission_classes = [IsAuthenticated]
    queryset = SessionTheme.objects.filter(is_predefined=True)
    serializer_class = SessionThemeSerializer
    ordering = ['name']