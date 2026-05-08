import time
import requests
from celery import shared_task
from django.conf import settings
from django.db import transaction
from apps.ingestion.models import RawIngestion
from apps.movies.models import Movie
import os

TMDB_API_KEY = getattr(settings, 'TMDB_API_KEY', os.getenv('TMDB_API_KEY', ''))
TMDB_BASE_URL = 'https://api.themoviedb.org/3'

def format_library_title(title):
    """
    Transforma formatos de biblioteca ("Return, The") em formatos naturais ("The Return")
    """
    title = str(title).strip()
    suffixes = [', The', ', A', ', An', ', O', ', Os', ', A', ', As', ', L\'', ', Le', ', La', ', Les', ', Il', ', Lo', ', La', ', I', ', Gli', ', Le', ', El', ', Los', ', Las']
    
    for suffix in suffixes:
        if title.endswith(suffix):
            article = suffix.replace(', ', '')
            base_title = title[:-len(suffix)]
            return f"{article} {base_title}"
            
    return title

@shared_task(bind=True, max_retries=3)
def process_pending_ingestions(self):
    if not TMDB_API_KEY:
        return "ERRO FATAL: TMDB_API_KEY não encontrada."

    pending_tasks = RawIngestion.objects.filter(status='PENDING')[:50]
    
    if not pending_tasks.exists():
        return "Nenhuma ingestão pendente."
        
    success_count = 0
    fail_count = 0
    
    for task in pending_tasks:
        task.status = 'PROCESSING'
        task.save(update_fields=['status'])
        
        raw = task.raw_data
        
        raw_title = raw.get('Title', '')
        search_title = format_library_title(raw_title)
        
        year_str = str(raw.get('Year', ''))
        clean_year = year_str.split('.')[0] if year_str else ''
        
        try:
            # -----------------------------------------------------------------
            # 2. BUSCA O ID DO TMDB
            # -----------------------------------------------------------------
            search_params = {
                'api_key': TMDB_API_KEY,
                'query': search_title,
                'language': 'pt-BR'
            }
            if clean_year.isdigit():
                search_params['year'] = clean_year
                
            search_res = requests.get(f"{TMDB_BASE_URL}/search/movie", params=search_params, timeout=10)
            search_res.raise_for_status()
            search_data = search_res.json()
            
            if not search_data.get('results'):
                raise ValueError(f"Filme '{search_title}' não localizado no TMDB.")
                
            tmdb_id = search_data['results'][0]['id']
            
            # -----------------------------------------------------------------
            # 3. EXTRAÇÃO PROFUNDA 
            # -----------------------------------------------------------------
            detail_params = {
                'api_key': TMDB_API_KEY,
                'language': 'pt-BR',
                'append_to_response': 'credits,videos,release_dates,keywords'
            }
            detail_res = requests.get(f"{TMDB_BASE_URL}/movie/{tmdb_id}", params=detail_params, timeout=10)
            detail_res.raise_for_status()
            tmdb_data = detail_res.json()
            
            # -----------------------------------------------------------------
            # 4. HARMONIZAÇÃO DE DADOS MESTRE
            # -----------------------------------------------------------------
            
            final_title = tmdb_data.get('title', search_title)
            
            directors = [crew['name'] for crew in tmdb_data.get('credits', {}).get('crew', []) if crew.get('job') == 'Director']
            tmdb_director = directors[0] if directors else raw.get('Director(s)', '')

            tspdt_history = {}
            for y in range(2008, 2030): 
                val = raw.get(str(y), '0')
                if str(val).isdigit() and int(val) > 0:
                    tspdt_history[str(y)] = int(val)

            ranking_current_str = raw.get('2026', '0')
            ranking_current = int(ranking_current_str) if str(ranking_current_str).isdigit() and ranking_current_str != '0' else None

            trailer_url = ''
            for video in tmdb_data.get('videos', {}).get('results', []):
                if video.get('site') == 'YouTube' and video.get('type') == 'Trailer':
                    trailer_url = f"https://www.youtube.com/watch?v={video.get('key')}"
                    break
                    
            cast_list = []
            if 'credits' in tmdb_data and 'cast' in tmdb_data['credits']:
                for actor in tmdb_data['credits']['cast'][:8]:
                    cast_list.append({
                        'name': actor.get('name'),
                        'character': actor.get('character'),
                        'profile_url': f"https://image.tmdb.org/t/p/w185{actor.get('profile_path')}" if actor.get('profile_path') else None
                    })

            mpaa_rating = ''
            for country_release in tmdb_data.get('release_dates', {}).get('results', []):
                if country_release.get('iso_3166_1') == 'US':
                    dates = country_release.get('release_dates', [])
                    if dates and dates[0].get('certification'):
                        mpaa_rating = dates[0].get('certification')
                        break

            genre_list = [g['name'] for g in tmdb_data.get('genres', [])]
            production_companies = [pc['name'] for pc in tmdb_data.get('production_companies', [])]
            spoken_languages = [lang['iso_639_1'] for lang in tmdb_data.get('spoken_languages', [])]
            keyword_list = [k['name'] for k in tmdb_data.get('keywords', {}).get('keywords', [])]
            
            poster_path = tmdb_data.get('poster_path')
            
            # CORREÇÃO CRÍTICA AQUI: O TMDB usa "backdrop_path", não "background_path"
            backdrop_path = tmdb_data.get('backdrop_path')
            
            collection = tmdb_data.get('belongs_to_collection')

            # -----------------------------------------------------------------
            # 5. SALVAMENTO ATÔMICO NA CURATED ZONE
            # -----------------------------------------------------------------
            with transaction.atomic():
                movie, created = Movie.objects.update_or_create(
                    tmdb_id=tmdb_id,
                    defaults={
                        'title': final_title,
                        'original_title': tmdb_data.get('original_title', ''),
                        'year': int(clean_year) if clean_year.isdigit() else None,
                        
                        'imdb_id': tmdb_data.get('imdb_id'),
                        'tspdt_id': raw.get('idTSPDT'),
                        
                        'director': tmdb_director,
                        'country': raw.get('Country', ''),
                        'length_minutes': tmdb_data.get('runtime') or (int(raw.get('Length', 0)) if str(raw.get('Length', '0')).isdigit() else None),
                        'color': raw.get('Colour', ''),
                        
                        'overview': tmdb_data.get('overview', ''),
                        'tagline': tmdb_data.get('tagline', ''),
                        'genres': genre_list,
                        'keywords': keyword_list,
                        'cast': cast_list,
                        'production_companies': production_companies,
                        'spoken_languages': spoken_languages,
                        'mpaa_rating': mpaa_rating,
                        'collection_name': collection.get('name') if collection else None,
                        
                        'budget': tmdb_data.get('budget'),
                        'revenue': tmdb_data.get('revenue'),
                        
                        'poster_url': f"https://image.tmdb.org/t/p/w780{poster_path}" if poster_path else '',
                        
                        # CORREÇÃO AQUI: Passamos a usar a varável correta e com resolução 'original'
                        'background_url': f"https://image.tmdb.org/t/p/original{backdrop_path}" if backdrop_path else '',
                        
                        'trailer_url': trailer_url,
                        
                        'ranking_current': ranking_current,
                        'tspdt_history': tspdt_history,
                        'tmdb_rating': tmdb_data.get('vote_average'),
                        'tmdb_vote_count': tmdb_data.get('vote_count'),
                    }
                )
                
                task.status = 'COMPLETED'
                task.error_log = f"Curated Zone rica! Movie ID: {movie.id}"
                task.save(update_fields=['status', 'error_log', 'updated_at'])
                success_count += 1
                
        except Exception as e:
            task.status = 'FAILED'
            task.error_log = f"ERRO: {str(e)}"
            task.save(update_fields=['status', 'error_log', 'updated_at'])
            fail_count += 1
            
        time.sleep(0.1)
            
    return f"Lote finalizado. Sucessos: {success_count} | Falhas: {fail_count}"