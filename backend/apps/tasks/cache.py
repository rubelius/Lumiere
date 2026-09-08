from celery import shared_task

from apps.core.core_cache import CacheManager
from apps.movies.models import Movie
from apps.movies.serializers import MovieDetailSerializer

# Quantos filmes do topo do ranking manter aquecidos.
TOPO_DO_RANKING = 100


@shared_task
def warm_popular_movies_cache():
    """
    Aquece o cache dos filmes mais pedidos.

    Grava na MESMA chave que MovieViewSet.retrieve lê, então precisa gravar a
    mesma forma: só os campos que não dependem de quem pede. Serializando aqui
    não há requisição nem usuário no contexto, então `watch_state` sairia nulo
    e `similar_movies` sairia sem despriorizar o que já foi visto — e essa
    resposta despersonalizada seria servida a todo mundo por 24 horas.

    É o outro lado do mesmo defeito que a view tinha: lá a ficha de um usuário
    vazava para os outros; aqui a de ninguém vazaria para todos.
    """
    populares = (Movie.objects
                 .filter(ranking_current__lte=TOPO_DO_RANKING)
                 .order_by('ranking_current'))

    aquecidos = 0
    for movie in populares:
        estavel = {
            campo: valor
            for campo, valor in MovieDetailSerializer(movie).data.items()
            if campo not in MovieDetailSerializer.CAMPOS_POR_USUARIO
        }
        CacheManager.set_movie(str(movie.id), estavel, timeout=86400)
        aquecidos += 1

    return {'warmed': aquecidos}
