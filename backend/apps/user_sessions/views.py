from datetime import timedelta
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from apps.core.permissions import IsOwner
from apps.tasks.sessions import prepare_session  # type: ignore

from .models import (CinemaSession, SessionInvite, SessionMessage,
                     SessionMovie, SessionParticipant, SessionTheme)
from .serializers import (CinemaSessionSerializer, SessionInviteSerializer,
                          SessionMessageSerializer,
                          SessionParticipantSerializer, SessionThemeSerializer)

class CinemaSessionViewSet(viewsets.ModelViewSet):
    """
    ViewSet para sessões de cinema
    """
    permission_classes = [IsAuthenticated, IsOwner]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'theme_type']
    ordering = ['-scheduled_date']
    
    # Actions que um convidado precisa alcançar. Sem isto, IsOwner barraria o
    # participante em tudo e a projeção coletiva não sairia do papel: ele não
    # conseguiria ver a ficha, a lista de quem está junto, nem o chat.
    #
    # A escrita da sessão — preparar, iniciar, convidar, revogar — continua
    # exigindo ser dono.
    ACTIONS_DE_PARTICIPANTE = ('retrieve', 'participants', 'messages', 'current', 'relevant')

    def get_permissions(self):
        """Define permissões por action"""
        if self.action in ('list', 'upcoming', 'past', 'join', 'current', 'relevant'):
            return [IsAuthenticated()]
        if self.action in self.ACTIONS_DE_PARTICIPANTE:
            # O queryset já limita a dono ou participante; IsOwner aqui
            # excluiria justamente o convidado.
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsOwner()]
        
    def get_queryset(self):  # type: ignore
        """Retorna apenas sessões do usuário"""
        # Na geração do schema não há request autenticado: filtrar por
        # AnonymousUser estoura e o drf-spectacular perde o modelo (e o tipo
        # do parâmetro de rota, que caía para "string").
        if getattr(self, 'swagger_fake_view', False):
            return CinemaSession.objects.none()
        # Dono OU participante convidado. Antes só o dono enxergava a
        # sessão, o que impedia qualquer projeção coletiva de existir: o
        # convidado não conseguia nem carregar a ficha do que ia assistir.
        #
        # A escrita continua restrita ao dono, por IsOwner nas outras actions.
        return CinemaSession.objects.filter(
            Q(user=self.request.user) | Q(participants__user=self.request.user)
        ).distinct().prefetch_related(
            'session_movies__movie',
            'session_movies__selected_release',
            'theme'
        )
    
    def get_serializer_class(self):
        return CinemaSessionSerializer

    # 2. ADICIONE esta função para avisar o serializer se estamos na tela de Detalhes ou Lista
    def get_serializer_context(self):
        context = super().get_serializer_context()
        # Define detail=True se a ação for ver apenas um item (retrieve)
        context['detail'] = self.action == 'retrieve'
        return context
    
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
    
    @extend_schema(
        responses={200: CinemaSessionSerializer},
        summary='A sessão que importa agora: a em curso, ou a próxima agendada.',
        description=(
            'Uma pergunta, uma consulta. A tela precisava dividir isso entre '
            '/current/ e /upcoming/, e a sessão MUDA de endpoint no instante '
            'em que é iniciada — sai de upcoming, entra em current. Nesse '
            'instante a tela via as duas listas discordarem e anunciava '
            '"nenhuma projeção agendada" logo depois de a pessoa ter começado '
            'uma. Com um endpoint só não há duas respostas para conciliar.'
        ),
    )
    @action(detail=False, url_path='relevant')
    def relevant(self, request):
        agora = timezone.now()
        base = self.get_queryset()

        # Em curso ganha da agendada: uma projeção acontecendo agora é mais
        # relevante que qualquer coisa no futuro.
        sessao = base.filter(status='in_progress').order_by('-actual_start_time').first()
        if not sessao:
            sessao = (
                base.filter(scheduled_date__gte=agora,
                            status__in=['planning', 'preparing', 'ready'])
                .order_by('scheduled_date').first()
            )

        if not sessao:
            return Response(None)
        return Response(self.get_serializer(
            sessao, context={'request': request, 'detail': True}).data)

    @extend_schema(
        responses={200: CinemaSessionSerializer},
        summary='A sessão em curso, se houver alguma.',
        description=(
            'Separada de /upcoming/ de propósito: uma sessão em andamento não '
            'é futura, e incluí-la lá distorceria o significado do endpoint. '
            'Sem esta rota a sessão sumia da tela no instante em que começava, '
            'e a ação de encerrá-la ficava inalcançável.'
        ),
    )
    @action(detail=False, methods=['get'])
    def current(self, request):
        sessao = (
            self.get_queryset()
            .filter(status='in_progress')
            .order_by('-actual_start_time')
            .first()
        )
        if not sessao:
            return Response(None)
        return Response(self.get_serializer(
            sessao, context={'request': request, 'detail': True}).data)

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
    
    @extend_schema(
        request=None,
        responses={200: CinemaSessionSerializer},
        summary='Entra numa sessão usando o código do convite.',
        description=(
            'Não leva o id da sessão: quem recebe um convite tem o código, '
            'não o identificador. O código é resolvido no servidor.'
        ),
    )
    @action(detail=False, methods=['post'])
    def join(self, request):
        codigo = (request.data.get('code') or '').strip()
        convite = SessionInvite.objects.filter(code=codigo).select_related('session').first()

        # A mesma resposta para código inexistente, expirado e revogado: cada
        # mensagem distinta contaria a quem estivesse tentando adivinhar se o
        # código existe.
        if not convite or not convite.valido:
            return Response({'error': 'Convite inválido ou expirado.'},
                            status=status.HTTP_404_NOT_FOUND)

        sessao = convite.session
        if sessao.user_id == request.user.id:
            return Response({'error': 'Você é o anfitrião desta sessão.'},
                            status=status.HTTP_400_BAD_REQUEST)

        SessionParticipant.objects.get_or_create(
            session=sessao, user=request.user,
            defaults={'role': SessionParticipant.PAPEL_CONVIDADO})

        return Response(CinemaSessionSerializer(
            sessao, context={'request': request, 'detail': True}).data)

    # ── projeção coletiva ────────────────────────────────────────────────

    def _participacao(self, sessao, user):
        """A participação desta pessoa, criando a do dono na primeira visita."""
        if sessao.user_id == user.id:
            p, _ = SessionParticipant.objects.get_or_create(
                session=sessao, user=user,
                defaults={'role': SessionParticipant.PAPEL_ANFITRIAO})
            return p
        return SessionParticipant.objects.filter(session=sessao, user=user).first()

    @extend_schema(
        request=None,
        responses={201: SessionInviteSerializer},
        summary='Cria um convite para a sessão. Só o dono.',
        description=(
            'Devolve um código que dá a uma conta existente acesso à sessão. '
            'O código é a credencial: expira e pode ser revogado, porque um '
            'convite eterno vira uma porta que ninguém lembra que deixou aberta.'
        ),
    )
    @action(detail=True, methods=['post'])
    def invite(self, request, pk=None):
        sessao = self.get_object()
        convite = SessionInvite.objects.create(
            session=sessao, created_by=request.user,
            code=SessionInvite.gera_codigo(),
            expires_at=timezone.now() + timedelta(hours=SessionInvite.HORAS_DE_VALIDADE),
        )
        return Response(SessionInviteSerializer(convite).data,
                        status=status.HTTP_201_CREATED)

    @extend_schema(
        request=None,
        responses={200: SessionInviteSerializer(many=True)},
        summary='Revoga todos os convites em aberto da sessão. Só o dono.',
    )
    @action(detail=True, methods=['post'], url_path='revoke-invites')
    def revoke_invites(self, request, pk=None):
        sessao = self.get_object()
        sessao.invites.filter(revoked=False).update(revoked=True)
        return Response(SessionInviteSerializer(sessao.invites.all(), many=True).data)

    @extend_schema(
        request=None,
        responses={200: SessionParticipantSerializer(many=True)},
        summary='Quem está assistindo, e onde cada um está no filme.',
    )
    @action(detail=True, methods=['get'])
    def participants(self, request, pk=None):
        sessao = self.get_object()
        self._participacao(sessao, request.user)
        return Response(SessionParticipantSerializer(
            sessao.participants.select_related('user'), many=True).data)

    @extend_schema(
        responses={200: SessionMessageSerializer(many=True),
                   201: SessionMessageSerializer},
        summary='Lê e escreve o chat da sessão.',
        description=(
            'Cada fala guarda o ponto do filme em que foi dita: numa projeção '
            'coletiva o comentário só faz sentido junto da cena, e quem chega '
            'atrasado precisa ver a conversa no ponto certo em vez de levar '
            'spoiler do terceiro ato.'
        ),
    )
    @action(detail=True, methods=['get', 'post'])
    def messages(self, request, pk=None):
        sessao = self.get_object()
        participacao = self._participacao(sessao, request.user)
        # Hoje isto não é alcançável: o queryset já limita a dono ou
        # participante, e quem não é nem um nem outro leva 404 no get_object.
        # Fica como segunda barreira porque a primeira é a definição do
        # queryset, e alargá-la — para sessão pública, por exemplo — é
        # exatamente o tipo de mudança que este projeto já fez. Sem isto, essa
        # mudança abriria o chat junto sem ninguém perceber.
        if not participacao:
            return Response({'error': 'Você não participa desta sessão.'},
                            status=status.HTTP_403_FORBIDDEN)

        if request.method == 'GET':
            falas = sessao.messages.select_related('participant__user')[:200]
            return Response(SessionMessageSerializer(
                falas, many=True, context={'request': request}).data)

        texto = (request.data.get('text') or '').strip()
        if not texto:
            return Response({'error': 'Mensagem vazia.'},
                            status=status.HTTP_400_BAD_REQUEST)

        fala = SessionMessage.objects.create(
            session=sessao, participant=participacao, text=texto[:2000],
            playback_position_seconds=int(request.data.get('position') or 0),
        )
        return Response(
            SessionMessageSerializer(fala, context={'request': request}).data,
            status=status.HTTP_201_CREATED)

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
                raise ValidationError({'status': f'Cannot prepare session in status: {session.status}'})

            session.status = 'preparing'
            session.save(update_fields=['status', 'updated_at'])

        # Importante: A task é disparada FORA do with block, 
        # para garantir que a transação do banco já foi comitada.
        prepare_session.delay(str(session.id))

        return Response({
            'message': 'Session preparation started.',
            'session': CinemaSessionSerializer(session).data
        })
    
    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        with transaction.atomic():
            session = CinemaSession.objects.select_for_update().get(pk=pk)

            if session.user != request.user:
                return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
            if session.status != 'ready':
                raise ValidationError({'status': f'Cannot start session in status: {session.status}'})

            session.status = 'in_progress'
            session.actual_start_time = timezone.now()
            session.started_at = timezone.now()
            session.save(update_fields=['status', 'actual_start_time', 'started_at', 'updated_at'])

        return Response({
            'message': 'Session started',
            'session': CinemaSessionSerializer(session, context={'request': request, 'detail': True}).data
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
        
        # O movie_id vinha cru do cliente para o create(). Os três erros mais
        # comuns viravam 500: UUID malformado (ValidationError), filme que não
        # existe (violação de chave estrangeira) e filme já na sessão
        # (unique_together). Nenhum deles é falha do servidor.
        from apps.movies.models import Movie

        try:
            filme = Movie.objects.get(pk=movie_id)
        except (Movie.DoesNotExist, DjangoValidationError, ValueError):
            return Response(
                {'error': 'Movie not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        if session.session_movies.filter(movie=filme).exists():
            return Response(
                {'error': 'Movie already in session'},
                status=status.HTTP_409_CONFLICT
            )

        last_order = session.session_movies.order_by('-order').first()
        next_order = (last_order.order + 1) if last_order else 0

        try:
            session_movie = SessionMovie.objects.create(
                session=session,
                movie=filme,
                order=next_order
            )
        except IntegrityError:
            # Duas requisições simultâneas passam juntas pela checagem acima;
            # a restrição do banco é quem decide, e o perdedor recebe 409.
            return Response(
                {'error': 'Movie already in session'},
                status=status.HTTP_409_CONFLICT
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