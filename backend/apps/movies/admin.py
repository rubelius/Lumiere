from django.contrib import admin
from .models import Movie, TorrentRelease

@admin.register(Movie)
class MovieAdmin(admin.ModelAdmin):
    list_display = ('title', 'year', 'director', 'length_minutes', 'in_plex')
    
    # 👇 A MÁGICA AQUI: Adicionamos 'id' para você poder colar o código exato!
    search_fields = ('id', 'title', 'original_title', 'director')
    
    list_filter = ('year', 'in_plex', 'available_instantly')
    readonly_fields = ('created_at', 'updated_at')

@admin.register(TorrentRelease)
class TorrentReleaseAdmin(admin.ModelAdmin):
    list_display = ('title', 'movie', 'size_gb', 'resolution', 'quality_score')
    search_fields = ('title', 'movie__title')
    list_filter = ('resolution', 'is_remux', 'has_hdr')