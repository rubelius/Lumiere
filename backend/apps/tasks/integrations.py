import asyncio
import logging

from apps.integrations.letterboxd import LetterboxdClient
from apps.integrations.models import (LetterboxdDiary, LetterboxdList,
                                      LetterboxdListItem)
from apps.integrations.plex import PlexClient
from apps.movies.models import Movie
from celery import shared_task
from django.utils import timezone
from fuzzywuzzy import fuzz

logger = logging.getLogger(__name__)


@shared_task(bind=True)
def sync_letterboxd_diary(self, user_id: str, limit: int = 500):
    """
    Sincroniza diário do Letterboxd para um usuário
    
    Args:
        user_id: UUID do usuário
        limit: Número máximo de entradas
    """
    from django.contrib.auth import get_user_model
    User = get_user_model()
    
    try:
        user = User.objects.get(id=user_id)
        
        if not user.letterboxd_username:
            logger.error(f"User {user_id} has no Letterboxd username")
            return {'error': 'No Letterboxd username'}
        
        # Fetch diary entries
        async def fetch_async():
            client = LetterboxdClient(user.letterboxd_username)
            try:
                entries = await client.get_diary_entries(limit=limit)
                return entries
            finally:
                await client.close()
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        entries = loop.run_until_complete(fetch_async())
        loop.close()
        
        new_count = 0
        matched_count = 0
        
        for entry in entries:
            # Create or update diary entry
            diary_entry, created = LetterboxdDiary.objects.update_or_create(
                user=user,
                letterboxd_entry_id=entry['entry_id'],
                defaults={
                    'film_name': entry['film_name'],
                    'film_year': entry['film_year'],
                    'watched_date': entry['watched_date'],
                    'rating': entry.get('rating'),
                    'review': entry.get('review', ''),
                    'rewatch': entry.get('rewatch', False),
                    'like': entry.get('like', False),
                    'letterboxd_uri': entry['link'],
                }
            )
            
            if created:
                new_count += 1
            
            # Try to match with database movie
            if not diary_entry.matched and entry['film_year']:
                # Fuzzy match
                matches = Movie.objects.filter(
                    year=entry['film_year']
                )[:100]  # Limit for performance
                
                best_match = None
                best_score = 0
                
                for movie in matches:
                    score = fuzz.ratio(
                        entry['film_name'].lower(),
                        movie.title.lower()
                    )
                    if score > best_score:
                        best_score = score
                        best_match = movie
                
                # Match if confidence > 85%
                if best_score > 85 and best_match:
                    diary_entry.movie = best_match
                    diary_entry.matched = True
                    diary_entry.save()
                    matched_count += 1
        
        # Update user sync timestamp
        user.letterboxd_last_sync = timezone.now()
        user.save()
        
        logger.info(f"Synced {len(entries)} diary entries for {user.username}, {new_count} new, {matched_count} matched")
        
        return {
            'user_id': str(user_id),
            'total_entries': len(entries),
            'new_entries': new_count,
            'matched': matched_count
        }
    
    except Exception as e:
        logger.error(f"Error syncing Letterboxd diary: {e}")
        raise self.retry(exc=e, countdown=300)


@shared_task
def sync_all_letterboxd_diaries():
    """
    Periodic task: sincroniza diários de todos os usuários com Letterboxd conectado
    
    Roda a cada 6 horas via beat schedule
    """
    from django.contrib.auth import get_user_model
    User = get_user_model()
    
    users = User.objects.filter(
        letterboxd_connected=True,
        letterboxd_username__isnull=False
    )
    
    logger.info(f"Syncing Letterboxd diaries for {users.count()} users")
    
    for user in users:
        sync_letterboxd_diary.apply_async(
            args=[str(user.id)],
            countdown=0
        )
    
    return {'users_synced': users.count()}


@shared_task(bind=True)
def sync_plex_library(self, user_id: str):
    """
    Sincroniza biblioteca Plex do usuário
    
    Marca filmes como in_plex=True
    """
    from django.contrib.auth import get_user_model
    User = get_user_model()
    
    try:
        user = User.objects.get(id=user_id)
        
        if not user.plex_server_url or not user.plex_token:
            return {'error': 'Plex not configured'}
        
        # Sync library
        async def sync_async():
            client = PlexClient(user.plex_server_url, user.plex_token)
            try:
                library_key = await client.get_movies_library_key()
                if not library_key:
                    return {'error': 'No movie library found'}
                
                # Get all movies from Plex
                response = await client.client.get(
                    f"{client.server_url}/library/sections/{library_key}/all"
                )
                
                from xml.etree import ElementTree as ET
                root = ET.fromstring(response.text)
                
                plex_movies = []
                for video in root.findall('.//Video'):
                    plex_movies.append({
                        'title': video.get('title'),
                        'year': int(video.get('year')) if video.get('year') else None,
                        'rating_key': video.get('ratingKey'),
                    })
                
                return plex_movies
            finally:
                await client.close()
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        plex_movies = loop.run_until_complete(sync_async())
        loop.close()
        
        if isinstance(plex_movies, dict) and 'error' in plex_movies:
            return plex_movies
        
        # Match with database
        updated_count = 0
        for plex_movie in plex_movies:
            if not plex_movie['title'] or not plex_movie['year']:
                continue
            
            # Try exact match first
            matches = Movie.objects.filter(
                title__iexact=plex_movie['title'],
                year=plex_movie['year']
            )
            
            # Fuzzy match if no exact match
            if not matches.exists():
                candidates = Movie.objects.filter(year=plex_movie['year'])[:50]
                
                best_match = None
                best_score = 0
                
                for movie in candidates:
                    score = fuzz.ratio(
                        plex_movie['title'].lower(),
                        movie.title.lower()
                    )
                    if score > best_score:
                        best_score = score
                        best_match = movie
                
                if best_score > 90 and best_match:
                    matches = [best_match]
            
            # Update matched movies
            for movie in matches:
                movie.in_plex = True
                movie.plex_rating_key = plex_movie['rating_key']
                movie.save()
                updated_count += 1
        
        logger.info(f"Synced Plex library for {user.username}, {updated_count} movies updated")
        
        return {
            'user_id': str(user_id),
            'plex_movies': len(plex_movies),
            'database_updated': updated_count
        }
    
    except Exception as e:
        logger.error(f"Error syncing Plex library: {e}")
        raise self.retry(exc=e, countdown=300)