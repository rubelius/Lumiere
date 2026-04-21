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
        
        total = movies.count()
        
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
            batch = list(movies[i:i+batch_size])
            
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
            
            # Save
            for movie, embedding in zip(batch, embeddings):
                movie.embedding = embedding.tolist()
                movie.embedding_model = generator.model_name
                movie.save(update_fields=['embedding', 'embedding_model'])
                processed += 1
            
            self.stdout.write(f"  Processados: {processed}/{total}")
        
        self.stdout.write(
            self.style.SUCCESS(
                f"✓ Embeddings gerados para {processed} filmes"
            )
        )


# Uso:
# python manage.py generate_embeddings --limit 1000 --batch-size 32