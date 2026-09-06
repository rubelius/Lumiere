from django.contrib.auth import get_user_model
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema, inline_serializer
from asgiref.sync import async_to_sync
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from collections import Counter

from rest_framework.views import APIView  # <-- Import para a nova view de Telemetria
from django.db.models import Sum, Avg, Count  # <-- Ferramentas matemáticas do banco

from apps.tasks.integrations import sync_letterboxd_diary  # type: ignore
from apps.movies.models import Movie, WatchHistory  # <-- Necessário para calcular as estatísticas

from .serializers import (IntegrationSettingsSerializer,
                          UserRegistrationSerializer, UserSerializer,
                          UserTasteProfileSerializer)

User = get_user_model()


class UserViewSet(viewsets.ModelViewSet):
    """ViewSet para usuários"""
    queryset = User.objects.all()
    serializer_class = UserSerializer
    
    def get_permissions(self):
        if self.action == 'create':
            return [AllowAny()]
        return [IsAuthenticated()]
    
    def get_serializer_class(self):  # type: ignore
        if self.action == 'create':
            return UserRegistrationSerializer
        return UserSerializer
    
    def get_queryset(self):  # type: ignore
        """Usuário só pode ver/editar próprio perfil"""
        if self.request.user.is_staff:  # type: ignore
            return super().get_queryset()
        return User.objects.filter(id=self.request.user.id) # type: ignore
    
    @action(detail=False, methods=['get'])
    def me(self, request):
        """Retorna usuário atual"""
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)
    
    @extend_schema(
        request=IntegrationSettingsSerializer,
        responses=IntegrationSettingsSerializer,
        description=(
            'Credenciais das fontes de reprodução. Os tokens são write-only: '
            'a resposta diz apenas se cada integração está configurada.'
        ),
    )
    @action(detail=False, methods=['get', 'patch'])
    def integrations(self, request):
        if request.method == 'PATCH':
            serializer = IntegrationSettingsSerializer(
                request.user, data=request.data, partial=True
            )
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)

        return Response(IntegrationSettingsSerializer(request.user).data)

    @extend_schema(
        request=inline_serializer(
            name='OpenSubtitlesLogin',
            fields={'username': serializers.CharField(), 'password': serializers.CharField(write_only=True)},
        ),
        responses=IntegrationSettingsSerializer,
        description=(
            'Troca usuário e senha do OpenSubtitles por um token. A senha não '
            'é armazenada — só o token que ela produz.'
        ),
    )
    @action(detail=False, methods=['post'], url_path='opensubtitles-login')
    def opensubtitles_login(self, request):
        from apps.integrations.opensubtitles import obter_token

        usuario = (request.data.get('username') or '').strip()
        senha = request.data.get('password') or ''
        if not (usuario and senha):
            return Response({'detail': 'Informe usuário e senha.'}, status=400)
        if not request.user.opensubtitles_api_key:
            return Response({'detail': 'Configure antes a chave de API.'}, status=400)

        token = async_to_sync(obter_token)(request.user.opensubtitles_api_key, usuario, senha)
        if not token:
            return Response({'detail': 'OpenSubtitles recusou as credenciais.'}, status=400)

        request.user.opensubtitles_username = usuario
        request.user.opensubtitles_token = token
        request.user.save(update_fields=['opensubtitles_username', 'opensubtitles_token'])
        return Response(IntegrationSettingsSerializer(request.user).data)

    @action(detail=False, methods=['get'])
    def taste_profile(self, request):
        """Retorna perfil de gosto do usuário"""
        try:
            profile = request.user.taste_profile  # type: ignore
            serializer = UserTasteProfileSerializer(profile)
            return Response(serializer.data)
        except:
            return Response(
                {'message': 'No taste profile yet. Sync Letterboxd first.'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=False, methods=['post'])
    def connect_letterboxd(self, request):
        """
        Conecta conta Letterboxd
        """
        username = request.data.get('username')
        
        if not username:
            return Response(
                {'error': 'username is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user = request.user
        user.letterboxd_username = username
        user.letterboxd_connected = True
        user.save()
        
        # STUB 1 RESOLVIDO: Dispara a task no Celery
        sync_letterboxd_diary.delay(str(user.id))
        
        return Response({
            'message': 'Letterboxd connected. Sync started in background.',
            'username': username
        })


# ==============================================================================
# O NOVO CÉREBRO ANALÍTICO DO SEU PERFIL
# ==============================================================================
@extend_schema(
    responses=OpenApiTypes.OBJECT,
    description=(
        'Agregações de telemetria do perfil. O corpo é um objeto montado '
        'dinamicamente a partir das consultas de agregação.'
    ),
)
class ProfileTelemetryView(APIView):
    """
    Telemetria do perfil: o que ESTE usuário assistiu.

    Antes vinha do acervo inteiro. Uma conta criada agora, sem nenhum filme
    visto, exibia "39.866 H de exibição", "25.908 obras assistidas" e uma
    avaliação média de 6,3 com o rótulo "crítico exigente" — porque eram a
    soma das durações, a contagem e a média do TMDB do catálogo. Os países e
    o gráfico semanal eram percentuais escritos à mão.

    Agora tudo sai de WatchHistory. Quando não há histórico, os números vêm
    zerados: um perfil vazio é a verdade sobre uma conta nova, e é o que
    convida a assistir alguma coisa.
    """
    permission_classes = [IsAuthenticated]

    GENEROS_DO_ESPECTRO = [
        ('DRAMA', 'Drama'),
        ('SCI-FI', 'Ficção'),
        ('TERROR', 'Terror'),
        ('COMÉDIA', 'Comédia'),
    ]
    DECADAS = [1920, 1940, 1960, 1980, 2000, 2020]

    def get(self, request):
        user = request.user

        vistos = list(
            WatchHistory.objects
            .filter(user=user, completed=True)
            .select_related('movie')
            .order_by('-last_watched_at')
        )
        filmes = [v.movie for v in vistos]
        total = len(filmes)

        def porcentagem(quantos):
            return round((quantos / total) * 100) if total else 0

        minutos = sum(f.length_minutes or 0 for f in filmes)
        notas = [v.rating for v in vistos if v.rating is not None]

        generos = [
            {'label': rotulo,
             'percent': porcentagem(sum(1 for f in filmes
                                        if any(termo.lower() in (g or '').lower()
                                               for g in (f.genres or []))))}
            for rotulo, termo in self.GENEROS_DO_ESPECTRO
        ]

        decadas = [
            {'dec': str(d),
             'val': porcentagem(sum(1 for f in filmes
                                    if f.year and d <= f.year < d + 20))}
            for d in self.DECADAS
        ]

        diretores = Counter(f.director for f in filmes if f.director)
        paises = Counter(f.country for f in filmes if f.country)

        # Atividade por dia da semana, do próprio histórico. Segunda = 0.
        por_dia = Counter(v.last_watched_at.weekday() for v in vistos)
        pico = max(por_dia.values()) if por_dia else 0
        semanal = [round((por_dia.get(d, 0) / pico) * 100) if pico else 0
                   for d in range(7)]

        TONS = ['#565450', '#8C8880', '#302E2A',
                'rgba(237,232,220,0.2)', 'rgba(237,232,220,0.1)']

        return Response({
            'user': {
                'name': user.get_full_name() or user.username,
                'bio': 'Curador do acervo digital e arquivista de películas.',
                'avatarUrl': '/images/perfil.jpg',
                'role': 'ADMINISTRADOR LUMIÈRE' if user.is_staff else 'ESPECTADOR',
                'accessLevel': 'ACESSO MASTER' if user.is_superuser else 'ACESSO PADRÃO',
            },
            'stats': {
                'watchTimeHours': round(minutos / 60),
                'moviesWatched': total,
                # Sem nota atribuída não há média. Zero diria "avaliou tudo com
                # zero", que é diferente de "ainda não avaliou nada".
                'averageRating': round(sum(notas) / len(notas), 1) if notas else None,
                'ratedCount': len(notas),
            },
            'charts': {
                'genres': generos,
                'decades': decadas,
                'directors': [{'dir': nome[:12].upper(), 'val': quantos}
                              for nome, quantos in diretores.most_common(4)],
                'countries': [{'c': (pais or '??')[:6].upper(), 'p': porcentagem(q),
                               'col': TONS[i % len(TONS)]}
                              for i, (pais, q) in enumerate(paises.most_common(5))],
                'weekly': semanal,
            },
            'achievements': self._conquistas(total, len(notas), diretores),
            'history': [
                {
                    'title': v.movie.title,
                    'date': v.last_watched_at.strftime('%d/%m/%Y'),
                    'rating': str(v.rating) if v.rating is not None else '—',
                    'hasReview': v.rating is not None,
                    'timesWatched': v.times_watched,
                }
                for v in vistos[:6]
            ],
            'systemLogs': [
                {'action': 'ACERVO CATALOGADO',
                 'target': f'{Movie.objects.count()} filmes disponíveis',
                 'time': 'SISTEMA ATIVO', 'type': 'system'},
            ],
        })

    @staticmethod
    def _conquistas(total, avaliados, diretores):
        """
        Marcos que a pessoa alcançou de fato.

        Antes eram dois elogios fixos sobre o tamanho do acervo, exibidos
        igualmente para quem nunca tinha assistido nada.
        """
        ganhas = []
        if total >= 10:
            ganhas.append({
                'title': 'PERFIL CALIBRADO', 'desc': f'{total} OBRAS ASSISTIDAS',
                'fullDesc': 'Histórico suficiente para o recomendador traçar seu gosto.',
                'icon': 'HardDrive',
            })
        if avaliados >= 5:
            ganhas.append({
                'title': 'CRÍTICO ATIVO', 'desc': f'{avaliados} AVALIAÇÕES',
                'fullDesc': 'Suas notas afinam o peso de cada filme no perfil.',
                'icon': 'Trophy',
            })
        if diretores and diretores.most_common(1)[0][1] >= 5:
            nome, quantos = diretores.most_common(1)[0]
            ganhas.append({
                'title': 'RETROSPECTIVA', 'desc': f'{quantos} DE {nome.upper()[:18]}',
                'fullDesc': 'Você percorreu a filmografia de um autor.',
                'icon': 'Trophy',
            })
        return ganhas