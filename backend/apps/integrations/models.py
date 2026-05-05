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

    def __str__(self):
        return f"{self.user} - {self.movie} ({self.rating})"


class LetterboxdList(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='letterboxd_lists'
    )
    name = models.CharField(max_length=255, null=True, blank=True)

    sync_enabled = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

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
    movie = models.ForeignKey(
        'movies.Movie',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='in_letterboxd_lists'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.list} - {self.movie}"