import asyncio
import logging

from apps.integrations.prowlarr import ProwlarrClient, ProwlarrIndisponivel
from apps.movies.models import Movie, TorrentRelease
from apps.movies.utils import passa_no_filtro, calculate_quality_score, parse_quality_from_title
from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def search_torrents_for_movie(self, movie_id: str, user_id: str, filters: dict = None):
    """
    Busca torrents para um filme específico
    
    Args:
        movie_id: UUID do filme
        user_id: UUID do usuário (para pegar credenciais Prowlarr)
        filters: Dict com min_resolution, prefer_remux, etc.
    
    Returns:
        Dict com total_found, new_releases
    """
    from django.contrib.auth import get_user_model
    User = get_user_model()
    
    try:
        movie = Movie.objects.get(id=movie_id)
        user = User.objects.get(id=user_id)
        
        if not user.prowlarr_url or not user.prowlarr_api_key:
            logger.error(f"User {user_id} has no Prowlarr config")
            return {'error': 'Prowlarr not configured'}
        
        # Default filters
        if filters is None:
            filters = {}
        
        min_resolution = filters.get('min_resolution', '1080p')
        prefer_remux = filters.get('prefer_remux', False)
        require_advanced_audio = filters.get('require_advanced_audio', False)
        min_seeders = filters.get('min_seeders', 5)
        
        # Search via Prowlarr
        async def search_async():
            client = ProwlarrClient(user.prowlarr_url, user.prowlarr_api_key)
            try:
                results = await client.search_movie(
                    title=movie.title,
                    year=movie.year,
                    imdb_id=movie.imdb_id,
                    original_title=movie.original_title
                )
                return results
            finally:
                await client.close()
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            prowlarr_results = loop.run_until_complete(search_async())
        except ProwlarrIndisponivel as e:
            # Erro de integração não se resolve tentando de novo: chave
            # errada continua errada na terceira tentativa. Devolver o motivo
            # é mais útil que três retries e um FAILURE sem explicação.
            logger.warning('Busca de releases indisponível: %s', e)
            return {'error': str(e), 'retryable': False}
        finally:
            loop.close()
        
        # Process and save releases
        new_count = 0
        total_count = 0
        
        for result in prowlarr_results:
            total_count += 1
            
            # Parse quality
            quality_data = parse_quality_from_title(result['title'])
            result.update(quality_data)
            
            # Calculate scores
            scores = calculate_quality_score(result)
            result.update(scores)
            
            # Filtro compartilhado com a view. Eram duas cópias, e a da
            # view tinha perdido o critério de resolução pelo caminho.
            if not passa_no_filtro(result, {
                'min_seeders': min_seeders,
                'prefer_remux': prefer_remux,
                'require_advanced_audio': require_advanced_audio,
                'min_resolution': min_resolution,
            }):
                continue
            
            # Create or update release
            release, created = TorrentRelease.objects.update_or_create(
                info_hash=result['info_hash'],
                defaults={
                    'movie': movie,
                    **result
                }
            )
            
            if created:
                new_count += 1
        
        # Update movie availability
        best_release = movie.torrent_releases.order_by('-quality_score').first()
        if best_release:
            movie.current_quality_score = best_release.quality_score
            movie.save()
        
        logger.info(f"Found {total_count} torrents for {movie.title}, {new_count} new")
        
        return {
            'movie_id': str(movie_id),
            'total_found': total_count,
            'new_releases': new_count,
            'best_quality_score': best_release.quality_score if best_release else 0
        }
    
    except Movie.DoesNotExist:
        logger.error(f"Movie {movie_id} not found")
        return {'error': 'Movie not found'}
    
    except Exception as e:
        logger.error(f"Error searching torrents: {e}")
        # Retry with exponential backoff
        raise self.retry(exc=e, countdown=60 * (2 ** self.request.retries))


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