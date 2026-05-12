import os
import re
import time
import requests
from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction
from tqdm import tqdm

from apps.movies.models import Movie

class Command(BaseCommand):
    help = "Sincroniza metadados premium do OMDb (Awards, Rotten Tomatoes, Metacritic) respeitando cota diária."

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=1000, help='Limite de requisições diárias (Padrão: 950 para ter margem de segurança)')

    def handle(self, *args, **options):
        api_key = getattr(settings, 'OMDB_API_KEY', os.getenv('OMDB_API_KEY', ''))
        if not api_key:
            self.stdout.write(self.style.ERROR("ERRO: OMDB_API_KEY não encontrada no .env ou settings."))
            return

        limit = options['limit']

        # A ESTRATÉGIA: Pegamos apenas filmes QUE TEM imdb_id e QUE AINDA NÃO FORAM CHECADOS
        movies_to_sync = Movie.objects.exclude(imdb_id__isnull=True).exclude(imdb_id='').filter(omdb_checked=False)[:limit]
        
        total = movies_to_sync.count()
        if total == 0:
            self.stdout.write(self.style.SUCCESS("🎉 Todos os filmes com IMDb ID já foram enriquecidos pelo OMDb!"))
            return

        self.stdout.write(self.style.WARNING(f"Iniciando sync OMDb para {total} filmes (Limite configurado: {limit}/dia)"))

        session = requests.Session()
        success_count = 0
        error_count = 0

        for movie in tqdm(movies_to_sync, total=total, desc="OMDb Sync"):
            try:
                url = f"http://www.omdbapi.com/?i={movie.imdb_id}&apikey={api_key}"
                res = session.get(url, timeout=10)
                res.raise_for_status()
                data = res.json()

                if data.get("Response") == "False":
                    # Filme não existe no OMDb. Marcamos como checked para não tentar de novo amanhã.
                    movie.omdb_checked = True
                    movie.save(update_fields=['omdb_checked'])
                    error_count += 1
                    continue

                # ── EXTRAÇÃO INTELIGENTE DOS DADOS ──
                updates = {'omdb_checked': True}

                # 1. Awards / Festivais
                awards_text = data.get("Awards", "")
                if awards_text and awards_text != "N/A":
                    updates['awards_summary'] = awards_text
                    
                    # Convertendo a string do OMDb pro array de 'festivals' que o nosso front já lê!
                    if not movie.festivals: # Só injeta se a lista atual estiver vazia
                        festivals_array = [{
                            "award": "Honrarias e Indicações",
                            "name": "Registro OMDb",
                            "year": awards_text
                        }]
                        # Tenta extrair se é Oscar vencedor para dar um destaque visual bonito
                        if "Won" in awards_text and "Oscar" in awards_text:
                            festivals_array[0]["award"] = "Vencedor do Oscar"
                        elif "Nominated" in awards_text and "Oscar" in awards_text:
                            festivals_array[0]["award"] = "Indicado ao Oscar"

                        updates['festivals'] = festivals_array

                # 2. Ratings (Rotten Tomatoes & Metacritic)
                ratings = data.get("Ratings", [])
                for r in ratings:
                    if r.get("Source") == "Rotten Tomatoes":
                        updates['rotten_tomatoes_rating'] = r.get("Value")
                    elif r.get("Source") == "Metacritic":
                        updates['metacritic_rating'] = r.get("Value")

                # 3. Classificação Indicativa (PG-13, R)
                mpaa = data.get("Rated", "N/A")
                if mpaa != "N/A" and not movie.mpaa_rating:
                    updates['mpaa_rating'] = mpaa

                # 4. Bilheteria Americana (BoxOffice)
                box_office = data.get("BoxOffice", "N/A")
                if box_office != "N/A" and not movie.revenue:
                    try:
                        clean_revenue = int(re.sub(r'[^\d]', '', box_office))
                        updates['revenue'] = clean_revenue
                    except ValueError:
                        pass
                
                # 5. Rating do IMDb (Se o TMDB não tiver trazido)
                imdb_rating = data.get("imdbRating", "N/A")
                if imdb_rating != "N/A" and not movie.imdb_rating:
                    try:
                        updates['imdb_rating'] = float(imdb_rating)
                    except ValueError:
                        pass
                
                imdb_votes = data.get("imdbVotes", "N/A")
                if imdb_votes != "N/A" and not movie.imdb_vote_count:
                    try:
                        updates['imdb_vote_count'] = int(imdb_votes.replace(",", ""))
                    except ValueError:
                        pass

                # ── SALVAMENTO ATÔMICO ──
                with transaction.atomic():
                    for attr, value in updates.items():
                        setattr(movie, attr, value)
                    movie.save(update_fields=list(updates.keys()))
                
                success_count += 1

            except Exception as e:
                error_count += 1
                self.stdout.write(self.style.ERROR(f"\nErro em {movie.title}: {e}"))
            
            # Rate limit gentil (O OMDb é gratuito, vamos pegar leve)
            time.sleep(0.05)

        self.stdout.write(self.style.SUCCESS(f"\n✅ Sync Finalizado! Sucessos: {success_count} | Não encontrados/Erros: {error_count}"))
        self.stdout.write(self.style.WARNING("Lembrete: O script consumiu cota de requisições. Para varrer o resto, rode novamente amanhã!"))