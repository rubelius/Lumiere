"""
URL configuration for lumiere project.
"""
from django.contrib import admin
from django.http import HttpResponse
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (TokenObtainPairView,
                                            TokenRefreshView, TokenVerifyView)
from drf_spectacular.views import (SpectacularAPIView, SpectacularRedocView,
                                   SpectacularSwaggerView)

from apps.movies.views import MovieViewSet, TorrentReleaseViewSet
from apps.user_sessions.views import CinemaSessionViewSet, SessionThemeViewSet
from apps.users.views import UserViewSet

# 1. IMPORTAÇÃO NOVA PARA O WEBSOCKET TICKET
from apps.core.views import issue_ws_ticket, health_check


def home(request):
    return HttpResponse("Lumiere Backend Rodando!")


# Router
router = DefaultRouter()
router.register(r'movies', MovieViewSet, basename='movie')
router.register(r'releases', TorrentReleaseViewSet, basename='release')
router.register(r'sessions', CinemaSessionViewSet, basename='session')
router.register(r'themes', SessionThemeViewSet, basename='theme')
router.register(r'users', UserViewSet, basename='user')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', home), # Rota para a raiz

    # Core (Health Checks)
    path('api/health/', health_check, name='health-check'),

    # API
    path('api/', include(router.urls)),
    
    # Authentication & Security
    path('api/auth/register/', UserViewSet.as_view({'post': 'create'}), name='register'),
    path('api/auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/token/verify/', TokenVerifyView.as_view(), name='token_verify'),
    
    # 2. A NOSSA NOVA ROTA DE TICKET WEBSOCKET (Protegida)
    path('api/auth/ws-ticket/', issue_ws_ticket, name='ws-ticket'),
    
    # API Documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # Prometheus metrics endpoint
    path('metrics/', include('django_prometheus.urls')),
]