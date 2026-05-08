from django.core.management.base import BaseCommand
from apps.movies.models import Movie
import requests
import time
from django.conf import settings
import os
from tqdm import tqdm

# Pega a chave da API
TMDB_API_KEY = getattr(settings, 'TMDB_API_KEY', os.getenv('TMDB_API_KEY', ''))

class Command(BaseCommand):
    help = 'Corrige os backgrounds e dados financeiros faltantes buscando no TMDB'

    def handle(self, *args, **options):
        if not TMDB_API_KEY:
            self.stdout.write(self.style.ERROR("ERRO: TMDB_API_KEY não encontrada."))
            return

        # Pega APENAS os filmes sem fundo
        movies_to_repair = Movie.objects.filter(background_url__in=[None, ''])
        total = movies_to_repair.count()
        
        if total == 0:
            self.stdout.write(self.style.SUCCESS("Todos os filmes já possuem background!"))
            return
            
        self.stdout.write(self.style.WARNING(f"Iniciando download de alta resolução para {total} filmes..."))

        # Inicia a barra de progresso verde e bonita
        for movie in tqdm(movies_to_repair, desc="Baixando Backgrounds", unit="filme", colour="green"):
            if not movie.tmdb_id:
                continue

            try:
                url = f"https://api.themoviedb.org/3/movie/{movie.tmdb_id}?api_key={TMDB_API_KEY}&language=pt-BR"
                res = requests.get(url, timeout=10)
                
                if res.status_code == 200:
                    data = res.json()
                    
                    # 1. Corrige o Fundo (Backdrop)
                    backdrop = data.get('backdrop_path')
                    if backdrop:
                        movie.background_url = f"https://image.tmdb.org/t/p/original{backdrop}"
                    
                    # 2. Garante os dados extras
                    movie.tagline = data.get('tagline', movie.tagline)
                    movie.budget = data.get('budget', movie.budget)
                    movie.revenue = data.get('revenue', movie.revenue)
                    movie.tmdb_rating = data.get('vote_average', movie.tmdb_rating)
                    
                    movie.save()
                
                # Respeita a API do TMDB
                time.sleep(0.1)

            except Exception as e:
                # O tqdm.write garante que o print do erro não quebre a barra de progresso visualmente
                tqdm.write(f"Erro no filme {movie.title}: {e}")
        
        self.stdout.write(self.style.SUCCESS("\n--- Reparo Finalizado com Sucesso! ---"))