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
    Verifica disponibilidade instantânea (cached) no Real-Debrid
    
    Args:
        release_ids: Lista de UUIDs de TorrentRelease
        user_id: UUID do usuário
    
    Returns:
        Dict com available_count
    """
    from apps.integrations.realdebrid import (RealDebridClient,
                                             RealDebridIndisponivel,
                                             chave_do_usuario)
    from django.contrib.auth import get_user_model
    
    User = get_user_model()
    
    try:
        user = User.objects.get(id=user_id)
        
        if not chave_do_usuario(user):
            return {'error': 'Real-Debrid not configured'}
        
        releases = list(TorrentRelease.objects.filter(id__in=release_ids))
        hashes = [r.info_hash for r in releases if r.info_hash]

        async def check_async():
            client = RealDebridClient(chave_do_usuario(user))
            try:
                # O cliente fatia em lotes por conta própria. Antes o
                # comentário aqui dizia "em lotes de 100" e passava todos de
                # uma vez, e o cliente truncava em `hashes[:100]`: do 101 em
                # diante ninguém era checado, e a ausência do hash no retorno
                # virava "não cacheado".
                return await client.check_instant_availability(hashes)
            finally:
                await client.close()

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            availability = loop.run_until_complete(check_async())
        except RealDebridIndisponivel as e:
            # Não marca nada. Tratar falha de consulta como "nada cacheado"
            # apagaria a disponibilidade do acervo inteiro por um blip de rede.
            logger.warning('Checagem de cache indisponível: %s', e)
            return {'error': str(e), 'retryable': True}
        finally:
            loop.close()

        available_count = 0
        agora = timezone.now()
        for release in releases:
            # As chaves vêm em minúsculas, como o acervo guarda info_hash.
            esta_cacheada = availability.get((release.info_hash or '').lower(), False)
            # Grava também quando é False: a flag só subia, então release que
            # saía do cache do Real-Debrid continuava anunciada como pronta
            # para sempre.
            release.instantly_available = esta_cacheada
            release.instant_check_at = agora
            release.save(update_fields=['instantly_available', 'instant_check_at'])
            available_count += int(esta_cacheada)
        
        logger.info(f"Checked {len(releases)} releases, {available_count} instantly available")
        
        return {
            'checked': len(releases),
            'available': available_count
        }
    
    except Exception as e:
        logger.error(f"Error checking instant availability: {e}")
        raise self.retry(exc=e, countdown=120)