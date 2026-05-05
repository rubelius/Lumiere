from django.conf import settings
from django.db import models

class LetterboxdDiary(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='letterboxd_diary_entries'
    )
    
    # ISSUE 1: Campos obrigatórios do Letterboxd e restrição de unicidade
    letterboxd_entry_id = models.CharField(max_length=255, null=True, blank=True)
    film_name = models.CharField(max_length=255, null=True, blank=True)
    film_year = models.IntegerField(null=True, blank=True)
    watched_date = models.DateField(null=True, blank=True)
    review = models.TextField(blank=True, null=True)
    rewatch = models.BooleanField(default=False)
    like = models.BooleanField(default=False)
    letterboxd_uri = models.URLField(max_length=500, null=True, blank=True)

    movie = models.ForeignKey(
        'movies.Movie',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='letterboxd_diary_entries'
    )

    matched = models.BooleanField(default=False)
    rating = models.DecimalField(max_digits=3, decimal_places=1, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # Blinda o banco contra entradas duplicadas por concorrência
        unique_together = [['user', 'letterboxd_entry_id']]

    def __str__(self):
        return f"{self.user} - {self.film_name} ({self.rating})"


class LetterboxdList(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='letterboxd_lists'
    )
    
    # Campos que as rotas/tasks tentam acessar
    letterboxd_list_id = models.CharField(max_length=255, null=True, blank=True)
    name = models.CharField(max_length=255, null=True, blank=True)
    description = models.TextField(blank=True, null=True)
    letterboxd_url = models.URLField(max_length=500, null=True, blank=True)
    film_count = models.IntegerField(default=0)

    sync_enabled = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [['user', 'letterboxd_list_id']]

    def __str__(self):
        return self.name or f"List {self.pk}"


class LetterboxdListItem(models.Model):
    list = models.ForeignKey(
        LetterboxdList,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='items'
    )
    
    # Campos que as rotas/tasks tentam acessar
    position = models.IntegerField(null=True, blank=True)
    film_name = models.CharField(max_length=255, null=True, blank=True)
    film_year = models.IntegerField(null=True, blank=True)
    letterboxd_film_id = models.CharField(max_length=255, null=True, blank=True)

    movie = models.ForeignKey(
        'movies.Movie',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='in_letterboxd_lists'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['position']

    def __str__(self):
        return f"{self.list} - {self.film_name}"