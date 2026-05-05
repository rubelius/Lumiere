from datetime import timedelta
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.permissions import IsOwner
from apps.tasks.sessions import prepare_session  # type: ignore

from .models import CinemaSession, SessionMovie, SessionTheme
from .serializers import (CinemaSessionDetailSerializer,
                          CinemaSessionListSerializer, SessionThemeSerializer)

class CinemaSessionViewSet(viewsets.ModelViewSet):
    """
    ViewSet para sessões de cinema
    """
    permission_classes = [IsAuthenticated, IsOwner]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'theme_type']
    ordering = ['-scheduled_date']
    
    def get_permissions(self):
        """Define permissões por action"""
        if self.action in ['list', 'upcoming', 'past']:
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsOwner()]
        
    def get_queryset(self):  # type: ignore
        """Retorna apenas sessões do usuário"""
        return CinemaSession.objects.filter(
            user=self.request.user
        ).prefetch_related(
            'session_movies__movie',
            'session_movies__selected_release',
            'theme'
        )
    
    def get_serializer_class(self):  # type: ignore
        if self.action in ['retrieve', 'create', 'update', 'partial_update']:
            return CinemaSessionDetailSerializer
        return CinemaSessionListSerializer
    
    @action(detail=False, methods=['get'])
    def upcoming(self, request):
        """Sessões futuras (próximos 30 dias)"""
        now = timezone.now()
        thirty_days = now + timedelta(days=30)
        
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
        with transaction.atomic():
            # select_for_update() cria um "lock" na linha. 
            # O segundo clique fica esperando o primeiro terminar.
            session = CinemaSession.objects.select_for_update().get(pk=pk)

            if session.user != request.user:
                return Response(
                    {'error': 'Not found'}, 
                    status=status.HTTP_404_NOT_FOUND
                )
            if session.status != 'planning':
                return Response(
                    {'error': f'Cannot prepare session in status: {session.status}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            session.status = 'preparing'
            session.save(update_fields=['status', 'updated_at'])

        # Importante: A task é disparada FORA do with block, 
        # para garantir que a transação do banco já foi comitada.
        prepare_session.delay(str(session.id))

        return Response({
            'message': 'Session preparation started.',
            'session': CinemaSessionListSerializer(session).data
        })
    
    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        with transaction.atomic():
            session = CinemaSession.objects.select_for_update().get(pk=pk)

            if session.user != request.user:
                return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
            if session.status != 'ready':
                return Response(
                    {'error': f'Cannot start session in status: {session.status}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            session.status = 'in_progress'
            session.actual_start_time = timezone.now()
            session.started_at = timezone.now()
            session.save(update_fields=['status', 'actual_start_time', 'started_at', 'updated_at'])

        return Response({
            'message': 'Session started',
            'session': CinemaSessionDetailSerializer(session, context={'request': request}).data
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
        """Adiciona filme à sessão"""
        session = self.get_object()
        movie_id = request.data.get('movie_id')
        
        if not movie_id:
            return Response(
                {'error': 'movie_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        last_order = session.session_movies.order_by('-order').first()
        next_order = (last_order.order + 1) if last_order else 0
        
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