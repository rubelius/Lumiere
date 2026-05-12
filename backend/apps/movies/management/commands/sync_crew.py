import time
import requests
from django.core.management.base import BaseCommand
from django.db.models import Q
from tqdm import tqdm
from apps.movies.models import Movie

class Command(BaseCommand):
    help = "Sincroniza cirurgicamente a equipe técnica (Crew) via TMDB para filmes com a coluna vazia."

    def handle(self, *args, **options):
        # Sua chave da API do TMDB
        TMDB_API_KEY = "a9a828011885cfb1c6f3e7b816d23aec"

        # O Filtro Mágico: Pega apenas quem tem ID no TMDB, mas o array 'crew' está vazio ou nulo
        movies = Movie.objects.filter(tmdb_id__isnull=False).filter(Q(crew=[]) | Q(crew__isnull=True))
        
        total = movies.count()
        if total == 0:
            self.stdout.write(self.style.SUCCESS("🎉 Todos os filmes do banco já possuem a equipe técnica preenchida!"))
            return

        self.stdout.write(self.style.WARNING(f"🎬 Iniciando extração cirúrgica de equipe para {total} filmes..."))

        target_jobs = {"Director", "Director of Photography", "Original Music Composer", "Screenplay", "Writer", "Producer"}
        success_count = 0

        # Usamos .iterator() para não explodir a memória RAM carregando 25 mil filmes de uma vez
        for movie in tqdm(movies.iterator(), total=total, desc="TMDB Crew Sync"):
            url = f"https://api.themoviedb.org/3/movie/{movie.tmdb_id}/credits?api_key={TMDB_API_KEY}"
            
            try:
                res = requests.get(url, timeout=10)
                
                # Se batermos no limite de requisições, o TMDB manda um 429
                if res.status_code == 429:
                    time.sleep(2)
                    res = requests.get(url, timeout=10) # Tenta de novo
                    
                if res.status_code == 200:
                    crew_raw = res.json().get("crew", [])
                    crew_formatado = []
                    
                    for c in crew_raw:
                        if c.get("job") in target_jobs:
                            foto = f"https://image.tmdb.org/t/p/w185{c.get('profile_path')}" if c.get("profile_path") else None
                            crew_formatado.append({
                                "name": c.get("name"),
                                "job": c.get("job"),
                                "department": c.get("department"),
                                "profile_url": foto
                            })
                    
                    # Salva no banco APENAS a coluna crew
                    movie.crew = crew_formatado
                    movie.save(update_fields=['crew'])
                    success_count += 1
                    
            except Exception as e:
                pass # Se der erro de rede num filme específico, ignora e pula pro próximo
            
            # O TMDB permite ~40 requisições por segundo. Essa pausa minúscula garante que não seremos bloqueados.
            time.sleep(0.03)

        self.stdout.write(self.style.SUCCESS(f"\n🚀 Sincronização Concluída! {success_count} equipes montadas com sucesso."))