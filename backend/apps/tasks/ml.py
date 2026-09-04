import logging

import numpy as np
from apps.integrations.models import LetterboxdDiary
from apps.ml.embedding import (MovieEmbeddingGenerator,
                               UserTasteEmbeddingGenerator)
from apps.ml.models import MovieSimilarity, UserTasteProfile
from apps.movies.models import Movie
from celery import shared_task
from django.db import transaction  # <-- ADICIONADO: Import para transação atômica
from django.db.models import Q
from pgvector.django import CosineDistance, L2Distance

logger = logging.getLogger(__name__)


@shared_task(bind=True)
def generate_movie_embeddings(self, movie_ids: list = None, batch_size: int = 32):
    """
    Gera embeddings para filmes que ainda não têm
    
    Args:
        movie_ids: Lista de UUIDs (None = processar todos sem embedding)
        batch_size: Tamanho do batch
    """
    try:
        # Get movies without embeddings
        if movie_ids:
            movies = Movie.objects.filter(id__in=movie_ids)
        else:
            movies = Movie.objects.filter(
                Q(embedding__isnull=True) | Q(embedding_model='')
            )[:1000]  # Limit to avoid overload
        
        if not movies.exists():
            logger.info("No movies to process")
            return {'processed': 0}
        
        logger.info(f"Generating embeddings for {movies.count()} movies")
        
        # Prepare movie data
        movies_data = []
        movies_list = list(movies)
        
        for movie in movies_list:
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
        generator = MovieEmbeddingGenerator()
        embeddings = generator.generate_batch_embeddings(movies_data, batch_size=batch_size)
        
        # Grava em lote: um UPDATE por filme seriam mil idas ao banco.
        for movie, embedding in zip(movies_list, embeddings):
            movie.embedding = embedding.tolist()
            movie.embedding_model = generator.model_name
        Movie.objects.bulk_update(
            movies_list, ['embedding', 'embedding_model'], batch_size=500
        )
        
        logger.info(f"Generated embeddings for {len(movies_list)} movies")
        
        return {
            'processed': len(movies_list),
            'model': generator.model_name
        }
    
    except Exception as e:
        logger.error(f"Error generating movie embeddings: {e}")
        raise self.retry(exc=e, countdown=300)


@shared_task
def update_movie_embeddings():
    """
    Periodic task: atualiza embeddings de filmes novos
    
    Roda diariamente às 4 AM via beat schedule
    """
    # Qualquer filme sem embedding, e não só os da última semana: com a
    # janela de 7 dias, um filme que escapasse dela (porque a fila falhou, ou
    # porque entrou num backfill antigo) ficaria sem embedding para sempre.
    # O lote é limitado para a execução periódica não virar um trabalho longo.
    pendentes = list(
        Movie.objects.filter(embedding__isnull=True).values_list('id', flat=True)[:1000]
    )

    if not pendentes:
        return {'message': 'No new movies to process'}

    return generate_movie_embeddings.apply_async(args=[[str(i) for i in pendentes]])


@shared_task(bind=True)
def compute_movie_similarities(self, movie_id: str, top_n: int = 50):
    """
    Recalcula as similaridades de um filme, sob demanda.

    A lógica vive em apps/ml/similarity.py. Esta task já teve uma cópia dela,
    e a cópia envelheceu: carimbava 'all-MiniLM-L6-v2' em model_version muito
    depois de o projeto ter trocado de modelo. Como é justamente esse campo
    que diz quais linhas ainda estão no modelo antigo, um carimbo mentiroso
    torna a próxima migração impossível de auditar.
    """
    from apps.ml.similarity import calcula_para_filme

    try:
        movie = Movie.objects.get(id=movie_id)
    except Movie.DoesNotExist:
        return {'error': 'Movie not found'}

    try:
        gravadas = calcula_para_filme(movie, top_n=top_n)
    except Exception as e:
        logger.error(f"Error computing similarities: {e}")
        raise self.retry(exc=e, countdown=300)

    if not gravadas:
        logger.warning(f"Movie {movie_id} has no embedding")
        return {'error': 'No embedding'}

    logger.info(f"Computed {gravadas} similarities for {movie.title}")
    return {'movie_id': str(movie_id), 'similarities_created': gravadas}


@shared_task(bind=True)
def train_user_taste_profile(self, user_id: str):
    """
    Treina perfil de gosto do usuário baseado em histórico Letterboxd
    
    Args:
        user_id: UUID do usuário
    """
    from django.contrib.auth import get_user_model
    User = get_user_model()
    
    try:
        user = User.objects.get(id=user_id)
        
        # Get watched movies from Letterboxd diary
        diary_entries = LetterboxdDiary.objects.filter(
            user=user,
            matched=True,
            movie__embedding__isnull=False
        ).select_related('movie')
        
        if diary_entries.count() < 10:
            logger.warning(f"User {user_id} has insufficient data (<10 movies)")
            return {'error': 'Insufficient data', 'entries': diary_entries.count()}
        
        # Collect embeddings and ratings
        embeddings = []
        ratings = []
        
        for entry in diary_entries:
            if entry.movie.embedding:
                embeddings.append(entry.movie.embedding)
                # Use rating if available, otherwise neutral 3.0
                ratings.append(float(entry.rating) if entry.rating else 3.0)
        
        # Generate user embedding
        generator = UserTasteEmbeddingGenerator()
        user_embedding = generator.generate_user_embedding(embeddings, ratings)
        
        # Compute preferences (top genres, directors, etc.)
        favorite_genres = {}
        favorite_directors = {}
        favorite_decades = {}
        
        for entry in diary_entries:
            movie = entry.movie
            rating = float(entry.rating) if entry.rating else 3.0
            
            # Only count well-rated movies (>= 3.5)
            if rating >= 3.5:
                # Genres
                for genre in (movie.genres or []):
                    favorite_genres[genre] = favorite_genres.get(genre, 0) + rating
                
                # Directors
                if movie.director:
                    favorite_directors[movie.director] = favorite_directors.get(movie.director, 0) + rating
                
                # Decades
                if movie.year:
                    decade = (movie.year // 10) * 10
                    favorite_decades[str(decade)] = favorite_decades.get(str(decade), 0) + rating
        
        # Sort and limit to top 10
        favorite_genres = dict(sorted(favorite_genres.items(), key=lambda x: x[1], reverse=True)[:10])
        favorite_directors = dict(sorted(favorite_directors.items(), key=lambda x: x[1], reverse=True)[:10])
        favorite_decades = dict(sorted(favorite_decades.items(), key=lambda x: x[1], reverse=True)[:5])
        
        # Statistics
        total_watched = diary_entries.count()
        total_ratings = diary_entries.filter(rating__isnull=False).count()
        avg_rating = sum(ratings) / len(ratings) if ratings else 0.0
        
        # Rating distribution
        rating_dist = {}
        for r in ratings:
            rounded = round(r * 2) / 2  # Round to nearest 0.5
            rating_dist[str(rounded)] = rating_dist.get(str(rounded), 0) + 1
        
        # Create or update taste profile
        profile, created = UserTasteProfile.objects.update_or_create(
            user=user,
            defaults={
                'embedding': user_embedding.tolist(),
                'embedding_model': generator.model_name,
                'favorite_genres': favorite_genres,
                'favorite_directors': favorite_directors,
                'favorite_decades': favorite_decades,
                'total_films_watched': total_watched,
                'total_ratings': total_ratings,
                'average_rating': round(avg_rating, 2),
                'rating_distribution': rating_dist,
                'training_samples': len(embeddings),
                'profile_confidence': min(len(embeddings) / 100.0, 1.0),  # Max at 100 movies
                'needs_retraining': False,
            }
        )
        
        logger.info(f"Trained taste profile for {user.username} ({len(embeddings)} movies)")
        
        return {
            'user_id': str(user_id),
            'created': created,
            'training_samples': len(embeddings),
            'confidence': profile.profile_confidence
        }
    
    except User.DoesNotExist:
        return {'error': 'User not found'}
    except Exception as e:
        logger.error(f"Error training taste profile: {e}")
        raise self.retry(exc=e, countdown=300)


@shared_task
def retrain_all_users():
    """
    Periodic task: retreina perfis de todos os usuários
    
    Roda diariamente às 3 AM via beat schedule
    """
    from django.contrib.auth import get_user_model
    User = get_user_model()
    
    # Get users with Letterboxd connected
    users = User.objects.filter(
        letterboxd_connected=True,
        letterboxd_username__isnull=False
    )
    
    logger.info(f"Retraining taste profiles for {users.count()} users")
    
    for user in users:
        train_user_taste_profile.apply_async(
            args=[str(user.id)],
            countdown=0
        )
    
    return {'users_scheduled': users.count()}

@shared_task
def compute_pending_similarities(batch_size: int = 500, top_n: int = 50):
    """
    Avança o cálculo de similaridades em lotes.

    O acervo tem ~26 mil filmes e cada um guarda até 50 vizinhos, então fazer
    tudo de uma vez seria um trabalho longo demais para uma execução
    periódica. Processa um lote por vez, priorizando o ranking do TSPDT, e
    termina sozinho quando não há mais pendentes.
    """
    from apps.ml.similarity import calcula_para_filme, filmes_pendentes

    pendentes = list(filmes_pendentes(batch_size))
    if not pendentes:
        return {'message': 'Nenhum filme pendente'}

    gravadas = sum(calcula_para_filme(f, top_n=top_n) for f in pendentes)
    logger.info('Similaridades: %s filmes, %s relações', len(pendentes), gravadas)
    return {'filmes': len(pendentes), 'relacoes': gravadas}
