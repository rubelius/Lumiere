from django.conf import settings
from django.db import models
from pgvector.django import VectorField


class UserTasteProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='taste_profile'
    )
    
    # Vector Embedding
    taste_profile_embedding = VectorField(dimensions=384, null=True, blank=True)
    # The task attempts to save 'embedding' and 'embedding_model'. 
    # Let's map 'embedding' to taste_profile_embedding for safety, but we MUST add these fields 
    # to avoid the AttributeError:
    embedding = VectorField(dimensions=384, null=True, blank=True) 
    embedding_model = models.CharField(max_length=255, null=True, blank=True)
    
    # Metadata fields exactly as written by tasks/ml.py
    favorite_genres = models.JSONField(default=dict, blank=True, null=True)
    favorite_directors = models.JSONField(default=dict, blank=True, null=True)
    favorite_decades = models.JSONField(default=dict, blank=True, null=True)
    
    total_films_watched = models.IntegerField(default=0)
    total_ratings = models.IntegerField(default=0)
    average_rating = models.FloatField(default=0.0)
    rating_distribution = models.JSONField(default=dict, blank=True, null=True)
    
    training_samples = models.IntegerField(default=0)
    profile_confidence = models.FloatField(default=0.0)
    needs_retraining = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Taste Profile - {self.user.username}"


class MovieSimilarity(models.Model):
    """Similaridade entre filmes para recomendações"""
    
    movie = models.ForeignKey(
        'movies.Movie',
        on_delete=models.CASCADE,
        related_name='similarities'
    )
    similar_movie = models.ForeignKey(
        'movies.Movie',
        on_delete=models.CASCADE,
        related_name='similar_to'
    )
    
    # Campos que a task e os serializers tentam usar
    similarity_score = models.FloatField(default=0.0) # mantive para retrocompatibilidade
    overall_similarity = models.FloatField(default=0.0)
    content_similarity = models.FloatField(default=0.0)
    similarity_type = models.CharField(max_length=50, null=True, blank=True)
    model_version = models.CharField(max_length=100, null=True, blank=True)
    
    class Meta:
        db_table = 'movie_similarities'
        unique_together = ['movie', 'similar_movie']
        ordering = ['-overall_similarity'] # Ajustado para o novo campo principal
    
    def __str__(self):
        return f"{self.movie.title} -> {self.similar_movie.title} ({self.overall_similarity})"


class Recommendation(models.Model):
    """
    O Claude apontou: 'Recommendation model doesn't exist' (FAILURE 4)
    Adicionando o modelo mínimo necessário.
    """
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='recommendations')
    movie = models.ForeignKey('movies.Movie', on_delete=models.CASCADE)
    
    score = models.FloatField(default=0.0)
    reason = models.CharField(max_length=255, null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-score']
        unique_together = ['user', 'movie']

    def __str__(self):
        return f"Rec: {self.movie} to {self.user} ({self.score})"