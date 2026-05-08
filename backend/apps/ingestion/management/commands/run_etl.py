import time
import requests
import re
import os
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from django.core.management.base import BaseCommand
from django.conf import settings
from django.db import transaction
from apps.ingestion.models import RawIngestion
from apps.movies.models import Movie
from tqdm import tqdm

class TMDBClient:
    """Robust API Client with Connection Pooling and Exponential Backoff."""
    def __init__(self, api_key):
        self.api_key = api_key
        self.base_url = 'https://api.themoviedb.org/3'
        
        # Configure Retry Strategy (Saves pipeline from intermittent network drops)
        retry_strategy = Retry(
            total=5,
            backoff_factor=1, # 1s, 2s, 4s, 8s, 16s
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["GET"]
        )
        adapter = HTTPAdapter(max_retries=retry_strategy, pool_connections=10, pool_maxsize=10)
        self.session = requests.Session()
        self.session.mount("https://", adapter)

    def get(self, endpoint, params=None):
        if params is None:
            params = {}
        params['api_key'] = self.api_key
        params['language'] = 'pt-BR'
        
        url = f"{self.base_url}{endpoint}"
        response = self.session.get(url, params=params, timeout=10)
        response.raise_for_status()
        return response.json()

class Command(BaseCommand):
    help = 'Production-Grade ETL: Extracts, Validates, and Persists Cinematic Metadata'

    def sanitize_title(self, raw_title):
        """Strips [TV], [LOST FILM], (1984), and shifts articles (Return, The -> The Return)."""
        title = str(raw_title).strip()
        # 1. Remove bracketed/parenthetical noise
        title = re.sub(r'\[.*?\]|\(.*?\)', '', title).strip()
        
        # 2. Re-arrange library suffixes
        suffixes = [', The', ', A', ', An', ', O', ', Os', ', A', ', As', ', L\'', ', Le', ', La', ', Les', ', Il', ', Lo', ', I', ', Gli', ', El', ', Los', ', Las']
        for suffix in suffixes:
            if title.endswith(suffix):
                article = suffix.replace(', ', '')
                title = f"{article} {title[:-len(suffix)]}"
                break
        return title

    def handle(self, *args, **kwargs):
        api_key = getattr(settings, 'TMDB_API_KEY', os.getenv('TMDB_API_KEY', ''))
        if not api_key:
            self.stdout.write(self.style.ERROR("FATAL: TMDB_API_KEY missing."))
            return

        tmdb = TMDBClient(api_key)
        
        # Target both pending and previously failed items for reconciliation
        pending_tasks = RawIngestion.objects.filter(status__in=['PENDING', 'FAILED'])
        total = pending_tasks.count()
        
        if total == 0:
            self.stdout.write(self.style.SUCCESS("No pending metadata to ingest."))
            return

        self.stdout.write(self.style.WARNING(f"Booting ETL Pipeline. Target Queue: {total} items."))
        log_path = os.path.join(settings.BASE_DIR, 'etl_failures.log')
        
        with open(log_path, 'w', encoding='utf-8') as f:
            f.write("=== LUMIÈRE ETL DIAGNOSTIC LOG ===\n\n")

        success_count, fail_count = 0, 0

        for task in tqdm(pending_tasks, desc="Ingesting TMDB Master Data", unit="film", colour="green"):
            raw = task.raw_data
            raw_title = raw.get('Title', '')
            clean_title = self.sanitize_title(raw_title)
            
            year_str = str(raw.get('Year', ''))
            clean_year = year_str.split('.')[0] if year_str else ''

            try:
                # ==========================================
                # LAYER 1: CASCADING DISCOVERY (Extraction)
                # ==========================================
                search_results = None
                media_type = 'movie'

                # Strategy A: Strict Movie Search
                params = {'query': clean_title}
                if clean_year.isdigit(): params['year'] = clean_year
                data = tmdb.get('/search/movie', params)
                
                # Strategy B: Loose Movie Search (Ignore Year discrepancies)
                if not data.get('results') and 'year' in params:
                    del params['year']
                    data = tmdb.get('/search/movie', params)

                # Strategy C: Multi-Search (Catch Mini-Series and TV Docs)
                if not data.get('results'):
                    multi_data = tmdb.get('/search/multi', params)
                    valid_results = [r for r in multi_data.get('results', []) if r.get('media_type') in ['movie', 'tv']]
                    if valid_results:
                        data['results'] = valid_results
                        media_type = valid_results[0].get('media_type', 'movie')

                if not data.get('results'):
                    raise ValueError(f"Entity not found across all search vectors. Searched: '{clean_title}'")
                    
                tmdb_id = data['results'][0]['id']

                # ==========================================
                # LAYER 2: DEEP ENRICHMENT (Extraction)
                # ==========================================
                # Notice we fetch images (logos), alt titles, and providers here!
                endpoint = f"/{media_type}/{tmdb_id}"
                detail_params = {
                    'append_to_response': 'credits,videos,release_dates,keywords,images',
                    'include_image_language': 'pt,en,null'
                }
                tmdb_data = tmdb.get(endpoint, detail_params)

                # ==========================================
                # LAYER 3: NORMALIZATION & VALIDATION
                # ==========================================
                
                # 1. Title & Runtime Normalization (Accounting for TV)
                final_title = tmdb_data.get('title') or tmdb_data.get('name') or clean_title
                original_title = tmdb_data.get('original_title') or tmdb_data.get('original_name', '')
                
                runtime = tmdb_data.get('runtime')
                if not runtime and media_type == 'tv': # TV shows use episode_run_time
                    episode_runtimes = tmdb_data.get('episode_run_time', [])
                    runtime = episode_runtimes[0] if episode_runtimes else None
                if not runtime: # Fallback to raw data
                    raw_len = str(raw.get('Length', '0'))
                    runtime = int(raw_len) if raw_len.isdigit() else None

                # 2. TSPDT History Matrix
                tspdt_history = {str(y): int(raw.get(str(y))) for y in range(2008, 2030) if str(raw.get(str(y), '0')).isdigit() and int(raw.get(str(y), '0')) > 0}
                ranking_str = raw.get('2026', '0')
                ranking_current = int(ranking_str) if ranking_str.isdigit() and ranking_str != '0' else None

                # 3. Media Extraction (Trailers, Backdrops, and High-End Logos)
                trailer_url = next((f"https://www.youtube.com/watch?v={v['key']}" for v in tmdb_data.get('videos', {}).get('results', []) if v.get('site') == 'YouTube' and v.get('type') == 'Trailer'), '')
                
                poster_path = tmdb_data.get('poster_path')
                backdrop_path = tmdb_data.get('backdrop_path')
                
                logos = tmdb_data.get('images', {}).get('logos', [])
                logo_url = f"https://image.tmdb.org/t/p/w500{logos[0]['file_path']}" if logos else ''

                # 4. Deep Crew Extraction (Auteurs, Cinematography, Score)
                crew = tmdb_data.get('credits', {}).get('crew', [])
                directors = [c['name'] for c in crew if c.get('job') == 'Director' or c.get('job') == 'Executive Producer']
                tmdb_director = directors[0] if directors else raw.get('Director(s)', '')
                
                writers = [c['name'] for c in crew if c.get('department') == 'Writing']
                dops = [c['name'] for c in crew if c.get('job') == 'Director of Photography']
                composers = [c['name'] for c in crew if c.get('job') == 'Original Music Composer']

                # 5. Type Coercion for Unique Constraints (The crash-fixer)
                tmdb_imdb_id = tmdb_data.get('imdb_id')
                safe_imdb_id = tmdb_imdb_id.strip() if tmdb_imdb_id and tmdb_imdb_id.strip() else None

                # ==========================================
                # LAYER 4: TRANSACTIONAL PERSISTENCE
                # ==========================================
                # Network I/O is finished. DB Transaction begins.
                with transaction.atomic():
                    movie, created = Movie.objects.update_or_create(
                        tmdb_id=tmdb_id,
                        defaults={
                            'title': final_title,
                            'year': int(clean_year) if clean_year.isdigit() else None,
                            'original_title': original_title,
                            'imdb_id': safe_imdb_id, # Safely coerced to None if empty
                            'tspdt_id': raw.get('idTSPDT'),
                            'director': tmdb_director,
                            'country': raw.get('Country', ''),
                            'length_minutes': runtime,
                            'color': raw.get('Colour', ''),
                            'overview': tmdb_data.get('overview', ''),
                            'tagline': tmdb_data.get('tagline', ''),
                            'genres': [g['name'] for g in tmdb_data.get('genres', [])],
                            'keywords': [k['name'] for k in tmdb_data.get('keywords', {}).get('keywords', [])],
                            'cast': [{'name': a.get('name'), 'character': a.get('character'), 'profile_url': f"https://image.tmdb.org/t/p/w185{a.get('profile_path')}" if a.get('profile_path') else None} for a in tmdb_data.get('credits', {}).get('cast', [])[:8]],
                            'production_companies': [pc['name'] for pc in tmdb_data.get('production_companies', [])],
                            'spoken_languages': [lang['iso_639_1'] for lang in tmdb_data.get('spoken_languages', [])],
                            'mpaa_rating': next((d.get('certification') for cr in tmdb_data.get('release_dates', {}).get('results', []) if cr.get('iso_3166_1') == 'US' for d in cr.get('release_dates', []) if d.get('certification')), ''),
                            'collection_name': tmdb_data.get('belongs_to_collection', {}).get('name') if tmdb_data.get('belongs_to_collection') else None,
                            'budget': tmdb_data.get('budget', 0),
                            'revenue': tmdb_data.get('revenue', 0),
                            'poster_url': f"https://image.tmdb.org/t/p/w780{poster_path}" if poster_path else '',
                            'background_url': f"https://image.tmdb.org/t/p/original{backdrop_path}" if backdrop_path else '',
                            'trailer_url': trailer_url,
                            'ranking_current': ranking_current,
                            'tspdt_history': tspdt_history,
                            'tmdb_rating': tmdb_data.get('vote_average'),
                            'tmdb_vote_count': tmdb_data.get('vote_count'),
                            'logo_url': logo_url,
                            'cinematographer': dops[0] if dops else '',
                            'composer': composers[0] if composers else '',
                            'writer': writers[0] if writers else '',
                        }
                    )
                    
                    task.status = 'COMPLETED'
                    task.error_log = ''
                    task.save(update_fields=['status', 'error_log'])
                    success_count += 1
                    
            except Exception as e:
                task.status = 'FAILED'
                task.error_log = str(e)
                task.save(update_fields=['status', 'error_log'])
                fail_count += 1
                
                # Structured Logging for Forensic Audits
                with open(log_path, 'a', encoding='utf-8') as f:
                    f.write(f"[{raw.get('idTSPDT', 'N/A')}] {raw_title} ({clean_year}) -> {str(e)}\n")
                
            # Respect rate limit proactively even with connection pooling
            time.sleep(0.05)

        self.stdout.write(self.style.SUCCESS(f"\n✅ ETL Master Run Complete. Success: {success_count} | Failures: {fail_count}"))
        if fail_count > 0:
            self.stdout.write(self.style.WARNING("Check 'etl_failures.log' for untrackable obscure titles."))