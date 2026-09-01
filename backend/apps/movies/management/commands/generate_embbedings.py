from apps.ml.embedding import MovieEmbeddingGenerator
from apps.movies.models import Movie
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Gera embeddings para filmes'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--limit',
            type=int,
            default=None,
            help='Número de filmes para processar'
        )
        parser.add_argument(
            '--batch-size',
            type=int,
            default=32,
            help='Tamanho do batch (default: 32)'
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Regenerar embeddings mesmo se já existirem'
        )
    
    def handle(self, *args, **options):
        limit = options['limit']
        batch_size = options['batch_size']
        force = options['force']
        
        # Get movies
        if force:
            movies = Movie.objects.all()
        else:
            from django.db.models import Q
            movies = Movie.objects.filter(
                Q(embedding__isnull=True) | Q(embedding_model='')
            )
        
        if limit:
            movies = movies[:limit]

        # Congela os ids ANTES de começar. O queryset filtra por
        # embedding__isnull=True e é preguiçoso: a cada lote gravado ele
        # encolhe, e refatiar com offset crescente sobre um conjunto que
        # diminui pula metade dos filmes e termina numa fatia vazia.
        ids = list(movies.values_list('id', flat=True))
        total = len(ids)
        
        if total == 0:
            self.stdout.write(
                self.style.SUCCESS('✓ Todos os filmes já têm embeddings')
            )
            return
        
        self.stdout.write(f"Gerando embeddings para {total} filmes...")
        
        # Process in batches
        generator = MovieEmbeddingGenerator()
        processed = 0
        
        for i in range(0, total, batch_size):
            batch = list(Movie.objects.filter(id__in=ids[i:i + batch_size]))
            if not batch:
                continue
            
            # Prepare data
            movies_data = []
            for movie in batch:
                movies_data.append({
                    'title': movie.title,
                    'overview': movie.overview or '',
                    'director': movie.director or '',
                    'genres': movie.genres or [],
                    'themes': movie.themes or [],
                    'moods': movie.moods or [],
                    'keywords': movie.keywords or [],
                })
            
            # Generate embeddings
            embeddings = generator.generate_batch_embeddings(
                movies_data,
                batch_size=len(movies_data)
            )
            
            # Grava em lote: um UPDATE por filme seriam 25 mil idas ao banco.
            for movie, embedding in zip(batch, embeddings):
                movie.embedding = embedding.tolist()
                movie.embedding_model = generator.model_name
            Movie.objects.bulk_update(
                batch, ['embedding', 'embedding_model'], batch_size=500
            )
            processed += len(batch)
            
            self.stdout.write(f"  Processados: {processed}/{total}")
        
        self.stdout.write(
            self.style.SUCCESS(
                f"✓ Embeddings gerados para {processed} filmes"
            )
        )


# Uso:
# python manage.py generate_embeddings --limit 1000 --batch-size 32