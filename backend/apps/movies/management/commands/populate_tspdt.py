import re

import httpx
from apps.movies.models import Movie
from bs4 import BeautifulSoup
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Popula banco com filmes do TSPDT (They Shoot Pictures, Don\'t They?)'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--limit',
            type=int,
            default=1000,
            help='Número de filmes para popular (default: 1000)'
        )
        parser.add_argument(
            '--year',
            type=int,
            default=2026,
            help='Ano do ranking TSPDT (default: 2026)'
        )
    
    def handle(self, *args, **options):
        limit = options['limit']
        year = options['year']
        
        self.stdout.write(f"Populando top {limit} filmes do TSPDT {year}...")
        
        # TSPDT list URL (ajustar conforme necessário)
        url = f"https://www.theyshootpictures.com/gf1000_all1000films.htm"
        
        try:
            response = httpx.get(url, timeout=30)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Parse table (estrutura pode variar)
            # Exemplo genérico - ajustar para estrutura real
            films_data = []
            
            # NOTA: Esta é uma estrutura exemplo
            # A estrutura HTML real do TSPDT pode variar
            for row in soup.find_all('tr')[:limit]:
                cols = row.find_all('td')
                if len(cols) < 4:
                    continue
                
                try:
                    ranking = int(cols[0].get_text(strip=True))
                    title = cols[1].get_text(strip=True)
                    director = cols[2].get_text(strip=True)
                    year_text = cols[3].get_text(strip=True)
                    
                    # Extract year
                    year_match = re.search(r'(\d{4})', year_text)
                    film_year = int(year_match.group(1)) if year_match else None
                    
                    films_data.append({
                        'ranking': ranking,
                        'title': title,
                        'director': director,
                        'year': film_year
                    })
                except (ValueError, AttributeError) as e:
                    continue
            
            # Create or update movies
            created = 0
            updated = 0
            
            for film in films_data:
                # O modelo guarda a posição mais recente em ranking_current e a
                # série inteira em tspdt_history. Os campos por ano
                # (ranking_2025/2026) foram removidos na migração 0002, e
                # gravar neles derrubava este comando na primeira linha.
                movie, created_flag = Movie.objects.get_or_create(
                    title=film['title'],
                    year=film['year'],
                    defaults={'director': film['director']},
                )
                movie.director = film['director'] or movie.director
                movie.ranking_current = film['ranking']
                historico = dict(movie.tspdt_history or {})
                historico[str(year)] = film['ranking']
                movie.tspdt_history = historico
                movie.save(update_fields=[
                    'director', 'ranking_current', 'tspdt_history'])
                
                if created_flag:
                    created += 1
                else:
                    updated += 1
            
            self.stdout.write(
                self.style.SUCCESS(
                    f"✓ Processados {len(films_data)} filmes: {created} novos, {updated} atualizados"
                )
            )
        
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"✗ Erro: {str(e)}")
            )


# Uso:
# python manage.py populate_tspdt --limit 1000 --year 2026