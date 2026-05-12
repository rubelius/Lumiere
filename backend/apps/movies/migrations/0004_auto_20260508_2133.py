from django.db import migrations
from django.contrib.postgres.operations import TrigramExtension # <-- IMPORTA A EXTENSÃO

class Migration(migrations.Migration):

    dependencies = [
        # O Django vai ter colocado a dependência anterior aqui. NÃO APAGUE!
        ('movies', '0003_movie_alternative_titles_movie_cinematographer_and_more'), 
    ]

    operations = [
        TrigramExtension(), # <-- LIGA O MOTOR DE TRIGRAMAS
    ]