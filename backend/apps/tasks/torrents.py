import asyncio
import logging

from apps.integrations.prowlarr import ProwlarrClient
from apps.movies.models import Movie, TorrentRelease
from apps.movies.utils import calculate_quality_score, parse_quality_from_title
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
                    imdb_id=movie.imdb_id
                )
                return results
            finally:
                await client.close()
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        prowlarr_results = loop.run_until_complete(search_async())
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
            
            # Apply filters
            if result['seeders'] < min_seeders:
                continue
            
            if prefer_remux and not result.get('is_remux'):
                continue
            
            if require_advanced_audio:
                if not (result.get('has_atmos') or result.get('has_dtsx') or result.get('has_truehd')):
                    continue
            
            # Resolution filter
            resolution_order = ['2160p', '1080p', '720p', '480p']
            min_index = resolution_order.index(min_resolution) if min_resolution in resolution_order else 999
            result_index = resolution_order.index(result.get('resolution', '480p')) if result.get('resolution') in resolution_order else 999
            
            if result_index > min_index:
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
    from apps.integrations.realdebrid import RealDebridClient
    from django.contrib.auth import get_user_model
    
    User = get_user_model()
    
    try:
        user = User.objects.get(id=user_id)
        
        if not user.realdebrid_api_key:
            return {'error': 'Real-Debrid not configured'}
        
        releases = TorrentRelease.objects.filter(id__in=release_ids)
        
        # Get info hashes
        hashes = [r.info_hash for r in releases]
        
        # Check availability in batches of 100
        async def check_async():
            client = RealDebridClient(user.realdebrid_api_key)
            try:
                availability = await client.check_instant_availability(hashes)
                return availability
            finally:
                await client.close()
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        availability = loop.run_until_complete(check_async())
        loop.close()
        
        # Update releases
        available_count = 0
        for release in releases:
            is_available = availability.get(release.info_hash.upper(), False)
            
            if is_available:
                release.instantly_available = True
                release.instant_check_at = timezone.now()
                release.save()
                available_count += 1
        
        logger.info(f"Checked {len(releases)} releases, {available_count} instantly available")
        
        return {
            'checked': len(releases),
            'available': available_count
        }
    
    except Exception as e:
        logger.error(f"Error checking instant availability: {e}")
        raise self.retry(exc=e, countdown=120)