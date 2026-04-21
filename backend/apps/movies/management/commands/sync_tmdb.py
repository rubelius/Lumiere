import os
from time import sleep

import httpx
from apps.movies.models import Movie
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Sincroniza metadados do TMDB para filmes'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--limit',
            type=int,
            default=100,
            help='Número de filmes para processar (default: 100)'
        )
        parser.add_argument(
            '--missing-only',
            action='store_true',
            help='Apenas filmes sem metadados TMDB'
        )
    
    def handle(self, *args, **options):
        limit = options['limit']
        missing_only = options['missing_only']
        
        # Get TMDB API key from env
        api_key = os.getenv('TMDB_API_KEY')
        if not api_key:
            self.stdout.write(
                self.style.ERROR('✗ TMDB_API_KEY não configurada')
            )
            return
        
        # Get movies to process
        if missing_only:
            movies = Movie.objects.filter(tmdb_id__isnull=True)[:limit]
        else:
            movies = Movie.objects.all()[:limit]
        
        self.stdout.write(f"Processando {movies.count()} filmes...")
        
        processed = 0
        found = 0
        not_found = 0
        
        for movie in movies:
            try:
                # Search TMDB
                search_url = "https://api.themoviedb.org/3/search/movie"
                params = {
                    'api_key': api_key,
                    'query': movie.title,
                    'year': movie.year,
                    'language': 'en-US'
                }
                
                response = httpx.get(search_url, params=params, timeout=10)
                response.raise_for_status()
                data = response.json()
                
                if data['results']:
                    # Take first result
                    result = data['results'][0]
                    
                    # Get full details
                    details_url = f"https://api.themoviedb.org/3/movie/{result['id']}"
                    details_response = httpx.get(
                        details_url,
                        params={'api_key': api_key, 'append_to_response': 'credits'},
                        timeout=10
                    )
                    details = details_response.json()
                    
                    # Update movie
                    movie.tmdb_id = result['id']
                    movie.imdb_id = details.get('imdb_id', '')
                    movie.overview = result.get('overview', '')
                    movie.tmdb_rating = result.get('vote_average')
                    movie.poster_url = f"https://image.tmdb.org/t/p/w500{result['poster_path']}" if result.get('poster_path') else ''
                    movie.backdrop_url = f"https://image.tmdb.org/t/p/original{result['backdrop_path']}" if result.get('backdrop_path') else ''
                    
                    # Genres
                    if details.get('genres'):
                        movie.genres = [g['name'] for g in details['genres']]
                        if not movie.primary_genre and movie.genres:
                            movie.primary_genre = movie.genres[0]
                    
                    # Runtime
                    if details.get('runtime'):
                        movie.length_minutes = details['runtime']
                    
                    # Country
                    if details.get('production_countries'):
                        movie.country = details['production_countries'][0]['iso_3166_1']
                    
                    # Credits
                    if details.get('credits'):
                        # Cast
                        cast = details['credits'].get('cast', [])[:10]
                        movie.tmdb_data = {
                            'cast': [
                                {'name': c['name'], 'character': c['character']}
                                for c in cast
                            ],
                            'crew': details['credits'].get('crew', [])[:20]
                        }
                    
                    movie.save()
                    found += 1
                    
                    self.stdout.write(f"  ✓ {movie.title} ({movie.year})")
                else:
                    not_found += 1
                    self.stdout.write(f"  ✗ Não encontrado: {movie.title} ({movie.year})")
                
                processed += 1
                
                # Rate limiting
                sleep(0.3)  # 3-4 requests per second
            
            except Exception as e:
                self.stdout.write(
                    self.style.WARNING(f"  ! Erro em {movie.title}: {str(e)}")
                )
                continue
        
        self.stdout.write(
            self.style.SUCCESS(
                f"\n✓ Processados: {processed} | Encontrados: {found} | Não encontrados: {not_found}"
            )
        )


# Uso:
# python manage.py sync_tmdb --limit 100 --missing-only