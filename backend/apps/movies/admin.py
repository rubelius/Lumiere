from django.contrib import admin
from .models import Movie

@admin.register(Movie)
class MovieAdmin(admin.ModelAdmin):
    # Quais colunas vão aparecer na lista principal
    list_display = ('title', 'year', 'director', 'length_minutes', 'in_plex')
    # Adiciona uma barra de pesquisa no topo
    search_fields = ('title', 'original_title', 'director')
    # Adiciona um painel de filtros lateral
    list_filter = ('year', 'in_plex', 'available_instantly')