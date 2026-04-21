import asyncio

from apps.integrations.plex import PlexClient
from apps.movies.models import Movie
from django.shortcuts import render
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

# Create your views here.
# apps/integrations/views.py



@api_view(['POST'])
@permission_classes([IsAuthenticated])
def sync_plex_library(request):
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
    
    async def sync_async():
        client = PlexClient(user.plex_server_url, user.plex_token)
        try:
            # Get movies library
            library_key = await client.get_movies_library_key()
            if not library_key:
                return {'error': 'No movie library found'}
            
            # Get all movies
            response = await client.client.get(
                f"{client.server_url}/library/sections/{library_key}/all"
            )
            
            from xml.etree import ElementTree as ET
            root = ET.fromstring(response.text)
            
            updated_count = 0
            for video in root.findall('.//Video'):
                title = video.get('title')
                year = video.get('year')
                
                if not title or not year:
                    continue
                
                # Try to match with database
                movies = Movie.objects.filter(
                    title__iexact=title,
                    year=int(year)
                )
                
                for movie in movies:
                    movie.in_plex = True
                    movie.plex_rating_key = video.get('ratingKey')
                    movie.save()
                    updated_count += 1
            
            return {'updated': updated_count}
        
        finally:
            await client.close()
    
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        result = loop.run_until_complete(sync_async())
    finally:
        loop.close()
    
    if 'error' in result:
        return Response(result, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    return Response({
        'message': 'Plex library synced',
        'movies_updated': result['updated']
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_session_playlist(request, session_id):
    """
    Cria playlist no Plex para uma sessão
    """
    from apps.sessions.models import CinemaSession
    
    try:
        session = CinemaSession.objects.get(
            id=session_id,
            user=request.user
        )
    except CinemaSession.DoesNotExist:
        return Response(
            {'error': 'Session not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    user = request.user
    if not user.plex_server_url or not user.plex_token:
        return Response(
            {'error': 'Plex not configured'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    async def create_async():
        client = PlexClient(user.plex_server_url, user.plex_token)
        try:
            # Get rating keys for all movies in session
            rating_keys = []
            for sm in session.session_movies.all():
                if sm.movie.plex_rating_key:
                    rating_keys.append(sm.movie.plex_rating_key)
            
            if not rating_keys:
                return {'error': 'No movies in Plex'}
            
            # Create playlist
            playlist_id = await client.create_playlist(
                name=f"{session.emoji} {session.name}",
                rating_keys=rating_keys
            )
            
            return {'playlist_id': playlist_id}
        
        finally:
            await client.close()
    
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        result = loop.run_until_complete(create_async())
    finally:
        loop.close()
    
    if 'error' in result:
        return Response(result, status=status.HTTP_400_BAD_REQUEST)
    
    # Update session
    session.plex_playlist_id = result['playlist_id']
    session.playlist_created = True
    session.save()
    
    return Response({
        'message': 'Playlist created in Plex',
        'playlist_id': result['playlist_id']
    })

# apps/integrations/views.py (adicionar)

from apps.integrations.letterboxd import LetterboxdClient
from apps.integrations.models import (LetterboxdDiary, LetterboxdList,
                                      LetterboxdListItem)
from apps.movies.models import Movie
from fuzzywuzzy import fuzz


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def sync_letterboxd_diary(request):
    """
    Sincroniza diário do Letterboxd
    """
    user = request.user
    
    if not user.letterboxd_username:
        return Response(
            {'error': 'Letterboxd username not set'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    async def sync_async():
        client = LetterboxdClient(user.letterboxd_username)
        try:
            entries = await client.get_diary_entries(limit=500)
            
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
                    matches = Movie.objects.filter(
                        year=entry['film_year'],
                        title__icontains=entry['film_name'][:20]  # Partial match
                    )
                    
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
            
            return {
                'new_entries': new_count,
                'total_entries': len(entries),
                'matched': matched_count
            }
        
        finally:
            await client.close()
    
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        result = loop.run_until_complete(sync_async())
    finally:
        loop.close()
    
    # Update user sync timestamp
    user.letterboxd_last_sync = timezone.now()
    user.save()
    
    return Response({
        'message': 'Letterboxd diary synced',
        **result
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def sync_letterboxd_lists(request):
    """
    Sincroniza listas do Letterboxd
    """
    user = request.user
    
    if not user.letterboxd_username:
        return Response(
            {'error': 'Letterboxd username not set'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    async def sync_async():
        client = LetterboxdClient(user.letterboxd_username)
        try:
            # Get all lists
            lists = await client.get_lists()
            
            synced_lists = []
            
            for list_data in lists:
                # Create or update list
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
                
                # Sync films in list
                if lb_list.sync_enabled:
                    films = await client.get_list_films(list_data['url'])
                    
                    # Clear existing items
                    lb_list.items.all().delete()
                    
                    # Add new items
                    for film in films:
                        LetterboxdListItem.objects.create(
                            list=lb_list,
                            position=film['position'],
                            film_name=film['film_name'],
                            film_year=film['film_year'],
                            letterboxd_film_id=film.get('letterboxd_slug', ''),
                        )
                    
                    synced_lists.append(lb_list.name)
            
            return {
                'total_lists': len(lists),
                'synced_lists': synced_lists
            }
        
        finally:
            await client.close()
    
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        result = loop.run_until_complete(sync_async())
    finally:
        loop.close()
    
    return Response({
        'message': 'Letterboxd lists synced',
        **result
    })