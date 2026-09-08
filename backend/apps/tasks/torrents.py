import asyncio
import logging

from apps.movies.models import Movie, TorrentRelease
from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=0)
def search_torrents_for_movie(self, movie_id: str, user_id: str, filters: dict = None):
    """
    Procura cópias de um filme e registra o desfecho onde a tela consegue ler.

    O trabalho todo mora em apps/movies/release_search.py. Esta task existe
    para tirá-lo do caminho da requisição — a busca leva de 40 a 100 segundos —
    e para transformar qualquer falha num documento legível.

    Antes havia aqui uma segunda cópia da lógica da view, já divergida: sem a
    checagem de cache no Real-Debrid, sem recalcular o resumo do filme, sem
    invalidar a ficha, e com um `movie.save()` que reescrevia a linha inteira.

    `max_retries=0` de propósito. Repetir em 60s e 120s enquanto uma pessoa
    olha o botão é prometer um progresso que ela não vê; e a versão anterior
    já se recusava a repetir ProwlarrIndisponivel, com comentário dizendo
    exatamente isso. Agora vale para toda falha: o erro chega à tela, e quem
    decide tentar de novo é quem está olhando.
    """
    from django.contrib.auth import get_user_model
    from django.core.exceptions import ObjectDoesNotExist

    from apps.movies.release_search import (executa_busca, grava_conclusao,
                                            grava_erro, marca_buscando)

    try:
        movie = Movie.objects.get(id=movie_id)
        user = get_user_model().objects.get(id=user_id)
    except (Movie.DoesNotExist, ObjectDoesNotExist) as e:
        # Registro apagado entre o clique e a execução. Sem gravar o erro, a
        # chave de andamento ficaria cinco minutos e a tela diria "na fila"
        # para uma busca que nunca vai acontecer.
        grava_erro(str(movie_id), f'A busca não pôde começar: {e}')
        return {'error': str(e)}

    marca_buscando(str(movie_id))

    try:
        resultado = executa_busca(movie, user, filters)
    except Exception as e:
        logger.warning('Busca de cópias falhou para %s: %s', movie_id, e)
        grava_erro(str(movie_id), str(e))
        return {'error': str(e)}

    grava_conclusao(str(movie_id), resultado)
    return resultado



@shared_task
def search_torrents_batch(movie_ids: list, user_id: str, filters: dict = None):
    """
    Busca torrents para múltiplos filmes em paralelo
    
    Args:
        movie_ids: Lista de UUIDs
        user_id: UUID do usuário
        filters: Filtros de busca
    
    Returns:
        Dict com results para cada filme
    """
    from celery import group

    # Create task group
    job = group([
        search_torrents_for_movie.s(movie_id, user_id, filters)
        for movie_id in movie_ids
    ])
    
    # Execute in parallel
    result = job.apply_async()
    
    return {
        'task_id': result.id,
        'total_movies': len(movie_ids)
    }


@shared_task(bind=True)
def check_instant_availability_batch(self, release_ids: list, user_id: str):
    """
    Não faz mais nada, e diz isso.

    Perguntava a `/torrents/instantAvailability` quais hashes o Real-Debrid já
    tinha no acervo. O provedor desativou a rota: ela responde 403 com
    `{'error': 'disabled_endpoint', 'error_code': 37}` para qualquer chave
    válida. Não há substituto — a capacidade foi removida, não movida.

    A pergunta que restou é outra, e vive em apps/movies/realdebrid_estado.py:
    o que está na CONTA do usuário, com status e progresso.

    Fica como stub, e não apagada, porque `search_torrents_batch` e qualquer
    agendamento antigo ainda podem despachá-la; sumir daria NotRegistered.
    """
    logger.info('check_instant_availability_batch é stub: o Real-Debrid '
                'desativou instantAvailability. Use realdebrid_estado.')
    return {'skipped': 'endpoint desativado pelo provedor',
            'releases': len(release_ids or [])}


