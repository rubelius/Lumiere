# Create your models here.
from apps.movies.models import Movie
from django.db import models
from pgvector.django import VectorField


class UserTasteProfile(models.Model):
    # Relacionamento com o seu usuário customizado
    user = models.OneToOneField(
        'users.User', 
        on_delete=models.CASCADE, 
        related_name='taste_profile'
    )
    
    # Onde vamos guardar o "gosto" do usuário em formato vetorial
    # Usei 384 dimensões pois é o padrão do modelo 'all-MiniLM-L6-v2' 
    # que configuramos no MLService. Se usar um maior, ajuste aqui.
    taste_profile_embedding = VectorField(dimensions=384, null=True, blank=True)
    
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Taste Profile - {self.user.username}"


class MovieSimilarity(models.Model):
    """Similaridade entre filmes para recomendações"""
    
    movie = models.ForeignKey(
        Movie,
        on_delete=models.CASCADE,
        related_name='similarities'
    )
    similar_movie = models.ForeignKey(
        Movie,
        on_delete=models.CASCADE,
        related_name='similar_to'
    )
    similarity_score = models.FloatField(
        help_text='Score de 0-1 indicando similaridade'
    )
    
    class Meta:
        db_table = 'movie_similarities'
        unique_together = ['movie', 'similar_movie']
        ordering = ['-similarity_score']
    
    def __str__(self):
        return f"{self.movie.title} -> {self.similar_movie.title} ({self.similarity_score})"