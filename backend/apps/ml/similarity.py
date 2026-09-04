"""
Cálculo das similaridades entre filmes.

Alimenta a seção de obras relacionadas na tela de detalhe. A lógica vive aqui
porque roda de três lugares: o comando de backfill, a task periódica e o
cálculo sob demanda de um filme.

O trabalho é pesado por natureza — cada filme faz uma busca de vizinhos entre
25 mil vetores — e por isso depende do índice HNSW em Movie.embedding.
"""

import logging
from typing import Optional

from django.db import transaction
from pgvector.django import CosineDistance

from apps.ml.constants import EMBEDDING_MODEL
from apps.ml.models import MovieSimilarity
from apps.movies.models import Movie

logger = logging.getLogger(__name__)


def classifica(filme: Movie, parecido: Movie) -> str:
    """Rótulo do porquê da aproximação, para a interface poder explicá-la."""
    if filme.director and filme.director == parecido.director:
        return 'director_filmography'
    if set(filme.genres or []) & set(parecido.genres or []):
        return 'same_genre'
    return 'thematic'


def calcula_para_filme(filme: Movie, top_n: int = 50) -> int:
    """
    Recalcula as similaridades de um filme. Devolve quantas foram gravadas.

    Zero quando o filme ainda não tem embedding — sem vetor não há vizinhança.
    """
    if filme.embedding is None:
        return 0

    vizinhos = (
        Movie.objects.filter(embedding__isnull=False)
        .exclude(id=filme.id)
        .annotate(distancia=CosineDistance('embedding', filme.embedding))
        .order_by('distancia')[:top_n]
    )

    novas = [
        MovieSimilarity(
            movie=filme,
            similar_movie=vizinho,
            # Distância de cosseno vai de 0 (idêntico) a 2; o complemento
            # devolve algo que cresce com a semelhança, como a UI espera.
            overall_similarity=1.0 - vizinho.distancia,
            content_similarity=1.0 - vizinho.distancia,
            similarity_type=classifica(filme, vizinho),
            model_version=EMBEDDING_MODEL,
        )
        for vizinho in vizinhos
    ]

    # Substituição atômica: apagar fora da transação deixaria o filme sem
    # nenhuma relação caso a gravação falhasse no meio.
    with transaction.atomic():
        MovieSimilarity.objects.filter(movie=filme).delete()
        MovieSimilarity.objects.bulk_create(novas, ignore_conflicts=True)

    return len(novas)


def filmes_pendentes(limite: Optional[int] = None):
    """
    Filmes com embedding e ainda sem nenhuma similaridade gravada.

    Ordena pelo ranking do TSPDT: se o processamento for interrompido, o que
    ficou pronto é o que o acervo considera mais importante.
    """
    qs = (
        Movie.objects.filter(embedding__isnull=False, similarities__isnull=True)
        .order_by('ranking_current')
    )
    return qs[:limite] if limite else qs


def ids_para_calcular(refazer: bool = False, limite: Optional[int] = None):
    """
    IDs dos filmes a processar, em ordem de ranking do TSPDT.

    Devolve IDs, não objetos: o acervo tem ~26 mil filmes e carregar todos de
    uma vez traria junto os vetores de 1024 dimensões e os JSON de elenco,
    centenas de MB que a máquina não precisa segurar para calcular um por vez.

    A lista é materializada de propósito. Sem `refazer` o filtro é justamente
    "ainda não tem similaridade", condição que cada gravação desfaz — um
    queryset preguiçoso encolheria debaixo do laço e o backfill pularia parte
    do acervo em silêncio.
    """
    qs = Movie.objects.filter(embedding__isnull=False)
    if not refazer:
        qs = qs.filter(similarities__isnull=True)

    qs = qs.order_by('ranking_current').values_list('id', flat=True)
    return list(qs[:limite] if limite else qs)
