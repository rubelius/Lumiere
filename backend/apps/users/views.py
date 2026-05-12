from django.contrib.auth import get_user_model
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView  # <-- Import para a nova view de Telemetria
from django.db.models import Sum, Avg, Count  # <-- Ferramentas matemáticas do banco

from apps.tasks.integrations import sync_letterboxd_diary  # type: ignore
from apps.movies.models import Movie  # <-- Necessário para calcular as estatísticas

from .serializers import (UserRegistrationSerializer, UserSerializer,
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
class ProfileTelemetryView(APIView):
    """
    API para agregar e fornecer os dados de telemetria do Perfil do Usuário
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        
        # Puxa o banco inteiro (ou você pode filtrar pelo histórico do user no futuro)
        queryset = Movie.objects.all()
        total_movies = queryset.count()
        
        # Variáveis seguras caso o banco esteja completamente vazio (evita divisão por zero)
        watch_time_hours = 0
        avg_rating = 0
        decades_data = [ {"dec": str(d), "val": 0} for d in [1920, 1940, 1960, 1980, 2000, 2020] ]
        directors_data = []
        history_data = []
        
        if total_movies > 0:
            # 1. Agregações Básicas (Matemática pesada feita direto no PostgreSQL)
            total_minutes = queryset.aggregate(total=Sum('length_minutes'))['total'] or 0
            watch_time_hours = round(total_minutes / 60)
            avg_rating = queryset.aggregate(avg=Avg('tmdb_rating'))['avg'] or 0
            
            # 2. Distribuição por Décadas
            decades_data = []
            for dec in [1920, 1940, 1960, 1980, 2000, 2020]:
                count = queryset.filter(year__gte=dec, year__lt=dec+20).count()
                percent = (count / total_movies) * 100
                decades_data.append({"dec": str(dec), "val": round(percent)})
                
            # 3. Autores Recorrentes (Agrupa, conta e pega os top 4)
            top_directors = queryset.exclude(director__isnull=True).exclude(director='').values('director').annotate(count=Count('id')).order_by('-count')[:4]
            directors_data = [{"dir": d['director'][:12].upper(), "val": d['count']} for d in top_directors]
            
            # 4. Histórico Recente (Pega os 4 últimos adicionados/assistidos)
            history_data = [
                {"title": m.title, "date": "RECENTE", "rating": str(round(m.tmdb_rating or 0, 1)), "hasReview": True} 
                for m in queryset.order_by('-created_at')[:4]
            ]

        # 5. Constrói o Payload perfeitamente formatado para a sua interface React
        data = {
            "user": {
                "name": user.get_full_name() or user.username or "Admin Lumière",
                "bio": "Curador do acervo digital e arquivista de películas. Acesso concedido aos diretórios remux.",
                "avatarUrl": "/images/perfil.jpg",
                "role": "ADMINISTRADOR LUMIÈRE",
                "accessLevel": "ACESSO MASTER"
            },
            "stats": {
                "watchTimeHours": watch_time_hours,
                "moviesWatched": total_movies,
                "averageRating": round(avg_rating, 1)
            },
            "charts": {
                "genres": [
                    {"label": "DRAMA", "percent": round((queryset.filter(genres__icontains='Drama').count() / total_movies) * 100) if total_movies else 0},
                    {"label": "SCI-FI", "percent": round((queryset.filter(genres__icontains='Ficção').count() / total_movies) * 100) if total_movies else 0},
                    {"label": "TERROR", "percent": round((queryset.filter(genres__icontains='Terror').count() / total_movies) * 100) if total_movies else 0},
                    {"label": "COMÉDIA", "percent": round((queryset.filter(genres__icontains='Comédia').count() / total_movies) * 100) if total_movies else 0},
                ],
                "decades": decades_data,
                "directors": directors_data,
                "countries": [
                    {"c": "EUA", "p": 45, "col": "#565450"},
                    {"c": "FRA", "p": 20, "col": "#8C8880"},
                    {"c": "ITA", "p": 15, "col": "#302E2A"},
                    {"c": "BRA", "p": 10, "col": "rgba(237,232,220,0.2)"},
                    {"c": "OUTROS", "p": 10, "col": "rgba(237,232,220,0.1)"}
                ],
                "weekly": [40, 60, 30, 80, 100, 50, 70]
            },
            "achievements": [
                {"title": "ARQUIVISTA SUPREMO", "desc": f"{total_movies} OBRAS CADASTRADAS", "fullDesc": "O banco de dados atingiu níveis de preservação histórica.", "icon": "HardDrive"},
                {"title": "CURADORIA DE OURO", "desc": "ALTA AVALIAÇÃO MÉDIA", "fullDesc": "Sua biblioteca foca estritamente na nata da cinematografia mundial.", "icon": "Trophy"}
            ],
            "history": history_data,
            "systemLogs": [
                {"action": "BANCO ATUALIZADO", "target": f"{total_movies} Filmes Sincronizados", "time": "SISTEMA ATIVO", "type": "system"}
            ]
        }

        return Response(data)