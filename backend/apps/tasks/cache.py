from apps.core.cache import CacheManager
from apps.movies.models import Movie
from apps.movies.serializers import MovieDetailSerializer
from celery import shared_task


@shared_task
def warm_popular_movies_cache():
    """
    Aquece cache dos filmes mais populares
    
    Roda diariamente para garantir cache quente
    """
    # Top 100 TSPDT
    popular_movies = Movie.objects.filter(
        ranking_2026__lte=100
    ).order_by('ranking_2026')
    
    warmed = 0
    
    for movie in popular_movies:
        serializer = MovieDetailSerializer(movie)
        CacheManager.set_movie(str(movie.id), serializer.data, timeout=86400)
        warmed += 1
    
    return {'warmed': warmed}


# Adicionar ao beat schedule:
# 'warm-popular-movies-cache': {
#     'task': 'apps.tasks.cache.warm_popular_movies_cache',
#     'schedule': crontab(minute=0, hour=2),  # 2 AM daily
# },