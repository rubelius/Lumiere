import logging
import numpy as np
from apps.integrations.models import LetterboxdDiary
from apps.ml.models import MovieSimilarity, Recommendation, UserTasteProfile
from apps.movies.models import Movie
from celery import shared_task
from django.db.models import Q, Count  # <-- BUG 4: Count importado corretamente
from django.db import transaction        # <-- ADICIONADO: Import para a transação segura
from pgvector.django import CosineDistance

logger = logging.getLogger(__name__)


@shared_task(bind=True)
def generate_recommendations(self, user_id: str, count: int = 50):
    """
    Gera recomendações personalizadas para usuário
    
    Algoritmo híbrido:
    - 40% Content-based (baseado em embedding do usuário)
    - 30% Collaborative (baseado em usuários similares)
    - 15% Director follow-up (diretores favoritos)
    - 15% Hidden gems (filmes bem avaliados mas pouco conhecidos)
    
    Args:
        user_id: UUID do usuário
        count: Número de recomendações
    """
    from django.contrib.auth import get_user_model
    User = get_user_model()
    
    try:
        user = User.objects.get(id=user_id)
        
        # Check if user has taste profile
        try:
            profile = user.taste_profile # type: ignore
        except UserTasteProfile.DoesNotExist:
            logger.warning(f"User {user_id} has no taste profile")
            return {'error': 'No taste profile. Sync Letterboxd first.'}
        
        # Get watched movies (to exclude)
        watched_ids = LetterboxdDiary.objects.filter(
            user=user,
            matched=True
        ).values_list('movie_id', flat=True)
        
        recommendations = []
        
        # 1. Content-based (40%)
        content_recs = generate_content_based_recs(user, profile, watched_ids, int(count * 0.4))
        recommendations.extend(content_recs)
        
        # 2. Collaborative (30%)
        collab_recs = generate_collaborative_recs(user, watched_ids, int(count * 0.3))
        recommendations.extend(collab_recs)
        
        # 3. Director follow-up (15%)
        director_recs = generate_director_recs(user, profile, watched_ids, int(count * 0.15))
        recommendations.extend(director_recs)
        
        # 4. Hidden gems (15%)
        hidden_recs = generate_hidden_gems(watched_ids, int(count * 0.15))
        recommendations.extend(hidden_recs)
        
        # Remove duplicates (keep highest score)
        unique_recs = {}
        for rec in recommendations:
            movie_id = rec['movie_id']
            if movie_id not in unique_recs or rec['score'] > unique_recs[movie_id]['score']:
                unique_recs[movie_id] = rec
        
        # Sort by score and take top N
        final_recs = sorted(unique_recs.values(), key=lambda x: x['score'], reverse=True)[:count]
        
        # --- INÍCIO DA CORREÇÃO DA TRANSAÇÃO ATÔMICA ---
        
        # 1. Constrói as recomendações na memória primeiro
        recs_to_create = [
            Recommendation(
                user=user,
                movie_id=rec_data['movie_id'],
                score=rec_data['score'],
                confidence=rec_data.get('confidence', 0.5),
                reason=rec_data['type']
            )
            for rec_data in final_recs
        ]
        
        # 2. Executa o apagamento e a criação em uma transação única e segura
        with transaction.atomic():
            Recommendation.objects.filter(user=user).delete()
            Recommendation.objects.bulk_create(
                recs_to_create,
                ignore_conflicts=True,
                batch_size=100
            )
            
        # --- FIM DA CORREÇÃO ---
        
        logger.info(f"Generated {len(recs_to_create)} recommendations for {user.username}") # type: ignore
        
        return {
            'user_id': str(user_id),
            'recommendations_generated': len(recs_to_create),
            'breakdown': {
                'content_based': len(content_recs),
                'collaborative': len(collab_recs),
                'director': len(director_recs),
                'hidden_gems': len(hidden_recs)
            }
        }
    
    except User.DoesNotExist:
        return {'error': 'User not found'}
    except Exception as e:
        logger.error(f"Error generating recommendations: {e}")
        raise self.retry(exc=e, countdown=300)


def generate_content_based_recs(user, profile, watched_ids, count):
    """Recomendações baseadas no embedding do usuário"""
    recommendations = []
    
    # Find movies similar to user's taste
    similar_movies = Movie.objects.filter(
        embedding__isnull=False
    ).exclude(
        id__in=watched_ids
    ).annotate(
        distance=CosineDistance('embedding', profile.embedding)
    ).order_by('distance')[:count * 2]  # Get 2x for filtering
    
    for movie in similar_movies:
        similarity = 1.0 - movie.distance # type: ignore
        
        # Boost by ranking (TSPDT films get bonus)
        score = similarity
        if movie.ranking_2026 and movie.ranking_2026 <= 100:
            score *= 1.2
        elif movie.ranking_2026 and movie.ranking_2026 <= 1000:
            score *= 1.1
        
        recommendations.append({
            'movie_id': str(movie.id),
            'score': min(score, 1.0),
            'confidence': similarity,
            'type': 'content_based',
            'explanation': f"Based on your taste profile ({int(similarity * 100)}% match)",
            'reasoning': {
                'similarity': float(similarity),
                'ranking': movie.ranking_2026
            }
        })
    
    return recommendations[:count]


def generate_collaborative_recs(user, watched_ids, count):
    """
    Recomendações colaborativas
    Encontra usuários com gostos similares e recomenda o que eles gostaram
    """
    recommendations = []
    
    # Find users with similar taste (overlap in highly rated movies)
    from django.contrib.auth import get_user_model
    User = get_user_model()
    
    # Get user's highly rated movies
    user_favorites = LetterboxdDiary.objects.filter(
        user=user,
        rating__gte=4.0,
        matched=True
    ).values_list('movie_id', flat=True)[:50]
    
    if not user_favorites:
        return []
    
    # Find users who also loved these movies
    similar_users = LetterboxdDiary.objects.filter(
        movie_id__in=user_favorites,
        rating__gte=4.0,
        matched=True
    ).exclude(
        user=user
    ).values_list('user', flat=True).distinct()[:20]
    
    # Get their favorites that user hasn't watched
    similar_users_favorites = LetterboxdDiary.objects.filter(
        user_id__in=similar_users,
        rating__gte=4.5,
        matched=True
    ).exclude(
        movie_id__in=watched_ids
    ).values('movie_id').annotate(
        count=Count('id')  # <-- BUG 4: Corrigido uso do Count
    ).order_by('-count')[:count]
    
    # Convert queryset to list to process
    favorites_list = list(similar_users_favorites)
    
    if not favorites_list:
        return []
        
    # STUB 5: Normalização Dinâmica
    # Acha qual foi o maior número de usuários em comum neste ciclo
    max_count = favorites_list[0]['count']
    
    for item in favorites_list:
        movie = Movie.objects.get(id=item['movie_id'])
        
        # Agora o score garante que a recomendação possa brigar de 0.6 a 1.0 com o Content-Based
        # ao invés de ficar travada em 0.2 se a sua base de dados for pequena.
        normalized_score = 0.6 + (0.4 * (item['count'] / max_count))
        score = min(normalized_score, 1.0) 
        
        recommendations.append({
            'movie_id': str(movie.id),
            'score': score,
            'confidence': score,
            'type': 'collaborative',
            'explanation': f"Loved by {item['count']} users with similar taste",
            'reasoning': {
                'similar_users_count': item['count']
            }
        })
    
    return recommendations


def generate_director_recs(user, profile, watched_ids, count):
    """Recomendações de diretores favoritos"""
    recommendations = []
    
    # Get favorite directors from profile safely
    if not profile.favorite_directors:
        return []
        
    favorite_directors = list(profile.favorite_directors.keys())[:5]
    
    if not favorite_directors:
        return []
    
    # Find unwatched films by favorite directors
    director_films = Movie.objects.filter(
        director__in=favorite_directors
    ).exclude(
        id__in=watched_ids
    ).order_by('-ranking_2026', '-tmdb_rating')[:count * 2]
    
    for movie in director_films:
        # Score based on director preference
        director_score = profile.favorite_directors.get(movie.director, 0) / 5.0
        
        # Boost by TSPDT ranking
        ranking_score = 0
        if movie.ranking_2026:
            ranking_score = 1.0 - (movie.ranking_2026 / 1000.0)
        
        # STUB 5: Normalização de Pesos Resolvida
        score = (director_score * 0.7) + (ranking_score * 0.3)
        
        recommendations.append({
            'movie_id': str(movie.id),
            'score': min(score, 1.0),
            'confidence': min(director_score, 1.0),
            'type': 'director_follow_up',
            'explanation': f"From {movie.director}, one of your favorite directors",
            'reasoning': {
                'director': movie.director,
                'director_score': float(director_score)
            }
        })
    
    return sorted(recommendations, key=lambda x: x['score'], reverse=True)[:count]


def generate_hidden_gems(watched_ids, count):
    """Hidden gems - filmes bem avaliados mas menos conhecidos"""
    recommendations = []
    
    # Find highly rated films with lower TSPDT rankings (hidden gems)
    hidden_gems = Movie.objects.filter(
        tmdb_rating__gte=7.5,
        ranking_2026__gte=500  # Not in top 500
    ).exclude(
        id__in=watched_ids
    ).order_by('-tmdb_rating', 'ranking_2026')[:count]
    
    for movie in hidden_gems:
        # Score based on rating and obscurity
        rating_score = (movie.tmdb_rating - 7.0) / 3.0  # Normalize from 7-10
        obscurity_score = 1.0 - (movie.ranking_2026 / 2000.0) if movie.ranking_2026 else 0.5
        
        # STUB 5: Normalização
        score = (rating_score * 0.6) + (obscurity_score * 0.4)
        
        recommendations.append({
            'movie_id': str(movie.id),
            'score': min(score, 1.0),
            'confidence': min(rating_score, 1.0),
            'type': 'hidden_gem',
            'explanation': f"Hidden gem: {movie.tmdb_rating}/10 rating but not widely known",
            'reasoning': {
                'tmdb_rating': float(movie.tmdb_rating) if movie.tmdb_rating else 0,
                'ranking': movie.ranking_2026
            }
        })
    
    return recommendations