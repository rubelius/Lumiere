"""
Filtros customizados para Movies

Resolve problema com ArrayField no django-filter
"""

import django_filters

from .models import Movie, TorrentRelease


class MovieFilter(django_filters.FilterSet):
    """Filtro customizado para Movie com suporte a ArrayField"""
    
    # Filtro customizado para ArrayField genres
    genres = django_filters.CharFilter(
        field_name='genres',
        lookup_expr='contains'
    )
    
    # Filtro por ano com range
    year_min = django_filters.NumberFilter(field_name='year', lookup_expr='gte')
    year_max = django_filters.NumberFilter(field_name='year', lookup_expr='lte')
    
    # Busca por título
    search = django_filters.CharFilter(
        field_name='title',
        lookup_expr='icontains'
    )
    
    class Meta:
        model = Movie
        fields = {
            'year': ['exact', 'gte', 'lte'],
            'country': ['exact', 'icontains'],
            'in_plex': ['exact'],
            'available_instantly': ['exact'],
            'director': ['exact', 'icontains'],
        }


class TorrentReleaseFilter(django_filters.FilterSet):
    """Filtro para TorrentRelease"""
    
    resolution = django_filters.CharFilter(lookup_expr='icontains')
    quality_score_min = django_filters.NumberFilter(
        field_name='quality_score',
        lookup_expr='gte'
    )
    
    class Meta:
        model = TorrentRelease
        fields = {
            'resolution': ['exact', 'icontains'],
            'is_remux': ['exact'],
            'has_atmos': ['exact'],
            'has_dolby_vision': ['exact'],
            'instantly_available': ['exact'],
        }