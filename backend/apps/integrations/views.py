from xml.etree import ElementTree as ET

from apps.integrations.letterboxd import LetterboxdClient
from apps.integrations.models import (LetterboxdDiary, LetterboxdList,
                                      LetterboxdListItem)
from apps.integrations.plex import PlexClient
from apps.movies.models import Movie
from apps.user_sessions.models import CinemaSession
# A helper to run synchronous ORM operations safely inside async views
from asgiref.sync import sync_to_async
from django.shortcuts import render
from django.utils import timezone
from fuzzywuzzy import fuzz
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

# Create your views here.
# apps/integrations/views.py

@sync_to_async
def _update_plex_movies(movie_matches, rating_key):
    updated_count = 0
    for movie in movie_matches:
        movie.in_plex = True
        movie.plex_rating_key = rating_key
        movie.save(update_fields=['in_plex', 'plex_rating_key'])
        updated_count += 1
    return updated_count

@api_view(['POST'])
@permission_classes([IsAuthenticated])
async def sync_plex_library(request):
    """
    Sincroniza biblioteca do Plex
    - Busca todos os filmes no Plex
    - Atualiza campo in_plex=True no banco
    """
    user = request.user
    
    if not user.plex_server_url or not user.plex_token:
        return Response(
            {'error': 'Plex not configured'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    client = PlexClient(user.plex_server_url, user.plex_token)
    try:
        # Get movies library
        library_key = await client.get_movies_library_key()
        if not library_key:
            return Response({'error': 'No movie library found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Get all movies
        response = await client.client.get(
            f"{client.server_url}/library/sections/{library_key}/all"
        )
        
        root = ET.fromstring(response.text)
        
        total_updated_count = 0
        for video in root.findall('.//Video'):
            title = video.get('title')
            year = video.get('year')
            
            if not title or not year:
                continue
            
            # Use async-safe ORM call
            movies = await sync_to_async(list)(Movie.objects.filter(
                title__iexact=title,
                year=int(year)
            ))
            
            if movies:
                 updated = await _update_plex_movies(movies, video.get('ratingKey'))
                 total_updated_count += updated
        
        return Response({
            'message': 'Plex library synced',
            'movies_updated': total_updated_count
        })
    except Exception as e:
         return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    finally:
        await client.close()


@sync_to_async
def _get_session_rating_keys(session_id, user):
    try:
        session = CinemaSession.objects.get(id=session_id, user=user)
        rating_keys = []
        for sm in session.session_movies. select_related('movie').all(): # type: ignore
            if sm.movie.plex_rating_key:
                rating_keys.append(sm.movie.plex_rating_key)
        return session, rating_keys
    except CinemaSession.DoesNotExist:
        return None, None

@sync_to_async
def _update_session_playlist(session, playlist_id):
    session.plex_playlist_id = playlist_id
    session.playlist_created = True
    session.save(update_fields=['plex_playlist_id', 'playlist_created'])

@api_view(['POST'])
@permission_classes([IsAuthenticated])
async def create_session_playlist(request, session_id):
    """
    Cria playlist no Plex para uma sessão
    """
    user = request.user
    if not user.plex_server_url or not user.plex_token:
        return Response(
            {'error': 'Plex not configured'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Safe DB read
    session, rating_keys = await _get_session_rating_keys(session_id, user)
    
    if not session:
        return Response(
            {'error': 'Session not found'},
            status=status.HTTP_404_NOT_FOUND
        )

    if not rating_keys:
         return Response(
            {'error': 'No movies with plex rating keys in this session'},
            status=status.HTTP_400_BAD_REQUEST
        )

    client = PlexClient(user.plex_server_url, user.plex_token)
    try:
        playlist_id = await client.create_playlist(
            name=f"{session.emoji} {session.name}",
            rating_keys=rating_keys
        )
        
        # Safe DB write
        await _update_session_playlist(session, playlist_id)
        
        return Response({
            'message': 'Playlist created in Plex',
            'playlist_id': playlist_id
        })
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    finally:
        await client.close()

# ------------------------------------------------------------------------------------
# Letterboxd Logic 
# ------------------------------------------------------------------------------------

@sync_to_async
def _process_diary_entry(user, entry):
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
    
    matched = False
    if not diary_entry.matched and entry['film_year']:
        best_match = None
        best_score = 0
        
        # 1. Caminho Rápido: Busca Exata (O(1))
        exact_match = Movie.objects.filter(
            year=entry['film_year'],
            title__iexact=entry['film_name']
        ).first()
        
        if exact_match:
            best_match = exact_match
            best_score = 100
        else:
            # 2. Fallback Seguro: Busca parcial rigorosa limitando a no máximo 5 retornos
            matches = list(Movie.objects.filter(
                year=entry['film_year'],
                title__icontains=entry['film_name']
            )[:5])
            
            for movie in matches:
                score = fuzz.ratio(entry['film_name'].lower(), movie.title.lower())
                if score > best_score:
                    best_score = score
                    best_match = movie
        
        if best_score > 85 and best_match:
            diary_entry.movie = best_match
            diary_entry.matched = True
            diary_entry.save(update_fields=['movie', 'matched'])
            matched = True
            
    return created, matched

@sync_to_async
def _update_user_sync_time(user):
    user.letterboxd_last_sync = timezone.now()
    user.save(update_fields=['letterboxd_last_sync'])

@api_view(['POST'])
@permission_classes([IsAuthenticated])
async def sync_letterboxd_diary(request):
    """
    Sincroniza diário do Letterboxd
    """
    user = request.user
    
    if not user.letterboxd_username:
        return Response(
            {'error': 'Letterboxd username not set'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    client = LetterboxdClient(user.letterboxd_username)
    try:
        entries = await client.get_diary_entries(limit=500)
        new_count = 0
        matched_count = 0
        
        for entry in entries:
            created, matched = await _process_diary_entry(user, entry)
            if created: new_count += 1
            if matched: matched_count += 1
            
        await _update_user_sync_time(user)
        
        return Response({
            'message': 'Letterboxd diary synced',
            'new_entries': new_count,
            'total_entries': len(entries),
            'matched': matched_count
        })
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    finally:
        await client.close()

@sync_to_async
def _process_letterboxd_list(user, list_data, films):
    lb_list, created = LetterboxdList.objects.update_or_create(
        user=user,
        letterboxd_list_id=list_data['list_id'],
        defaults={
            'name': list_data['name'],
            'description': list_data['description'],
            'letterboxd_url': list_data['url'],
            'film_count': list_data['film_count'],
        }
    )
    
    if lb_list.sync_enabled and films:
        lb_list.items.all().delete() # type: ignore
        for film in films:
            LetterboxdListItem.objects.create(
                list=lb_list,
                position=film['position'],
                film_name=film['film_name'],
                film_year=film['film_year'],
                letterboxd_film_id=film.get('letterboxd_slug', ''),
            )
        return lb_list.name
    return None

@api_view(['POST'])
@permission_classes([IsAuthenticated])
async def sync_letterboxd_lists(request):
    """
    Sincroniza listas do Letterboxd
    """
    user = request.user
    
    if not user.letterboxd_username:
        return Response(
            {'error': 'Letterboxd username not set'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    client = LetterboxdClient(user.letterboxd_username)
    try:
        lists = await client.get_lists()
        synced_lists = []
        
        for list_data in lists:
            # Need to get films asynchronously BEFORE diving into sync_to_async
            films = await client.get_list_films(list_data['url']) 
            synced_name = await _process_letterboxd_list(user, list_data, films)
            if synced_name:
                synced_lists.append(synced_name)
        
        return Response({
            'message': 'Letterboxd lists synced',
            'total_lists': len(lists),
            'synced_lists': synced_lists
        })
    except Exception as e:
         return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    finally:
        await client.close()