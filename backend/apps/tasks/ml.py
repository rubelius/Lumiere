import logging

import numpy as np
from apps.integrations.models import LetterboxdDiary
from apps.ml.embedding import (MovieEmbeddingGenerator,
                               UserTasteEmbeddingGenerator)
from apps.ml.models import MovieSimilarity, UserTasteProfile
from apps.movies.models import Movie
from celery import shared_task
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
        
        # Save embeddings
        for movie, embedding in zip(movies_list, embeddings):
            movie.embedding = embedding.tolist()
            movie.embedding_model = generator.model_name
            movie.save(update_fields=['embedding', 'embedding_model'])
        
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
    # Process movies added in last 7 days without embeddings
    from datetime import timedelta

    from django.utils import timezone
    
    week_ago = timezone.now() - timedelta(days=7)
    
    recent_movies = Movie.objects.filter(
        created_at__gte=week_ago,
        embedding__isnull=True
    )
    
    if not recent_movies.exists():
        return {'message': 'No new movies to process'}
    
    movie_ids = [str(m.id) for m in recent_movies]
    
    return generate_movie_embeddings.apply_async(args=[movie_ids])


@shared_task(bind=True)
def compute_movie_similarities(self, movie_id: str, top_n: int = 50):
    """
    Calcula e salva similaridades para um filme
    
    Usa pgvector para busca eficiente de nearest neighbors
    
    Args:
        movie_id: UUID do filme
        top_n: Número de filmes similares para salvar
    """
    try:
        movie = Movie.objects.get(id=movie_id)
        
        if not movie.embedding:
            logger.warning(f"Movie {movie_id} has no embedding")
            return {'error': 'No embedding'}
        
        # Find similar movies using pgvector
        # Using cosine distance (lower is more similar)
        similar_movies = Movie.objects.filter(
            embedding__isnull=False
        ).exclude(
            id=movie.id
        ).annotate(
            distance=CosineDistance('embedding', movie.embedding)
        ).order_by('distance')[:top_n]
        
        # Delete existing similarities
        MovieSimilarity.objects.filter(movie=movie).delete()
        
        # Create new similarities
        similarities_created = 0
        for similar_movie in similar_movies:
            # Convert distance to similarity score (0-1, higher is more similar)
            similarity_score = 1.0 - similar_movie.distance
            
            # Determine similarity type
            similarity_type = 'thematic'
            if movie.director == similar_movie.director:
                similarity_type = 'director_filmography'
            elif set(movie.genres or []) & set(similar_movie.genres or []):
                similarity_type = 'same_genre'
            
            MovieSimilarity.objects.create(
                movie=movie,
                similar_movie=similar_movie,
                overall_similarity=similarity_score,
                content_similarity=similarity_score,
                similarity_type=similarity_type,
                model_version='all-MiniLM-L6-v2'
            )
            similarities_created += 1
        
        logger.info(f"Computed {similarities_created} similarities for {movie.title}")
        
        return {
            'movie_id': str(movie_id),
            'similarities_created': similarities_created
        }
    
    except Movie.DoesNotExist:
        return {'error': 'Movie not found'}
    except Exception as e:
        logger.error(f"Error computing similarities: {e}")
        raise self.retry(exc=e, countdown=300)


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
                'embedding_model': 'all-MiniLM-L6-v2',
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