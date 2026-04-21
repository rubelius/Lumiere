"""
URL configuration for lumiere project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from apps.movies.views import MovieViewSet, TorrentReleaseViewSet
from apps.user_sessions.views import CinemaSessionViewSet, SessionThemeViewSet
from apps.users.views import UserViewSet
from django.contrib import admin
from django.http import HttpResponse
from django.urls import include, path
from drf_spectacular.views import (SpectacularAPIView, SpectacularRedocView,
                                   SpectacularSwaggerView)
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (TokenObtainPairView,
                                            TokenRefreshView, TokenVerifyView)


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

    # API
    path('api/', include(router.urls)),
    
    # Authentication
    path('api/auth/register/', UserViewSet.as_view({'post': 'create'}), name='register'),
    path('api/auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/token/verify/', TokenVerifyView.as_view(), name='token_verify'),
    
    # API Documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # Prometheus metrics endpoint
    path('metrics/', include('django_prometheus.urls')),

]


