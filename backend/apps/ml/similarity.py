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

from django.db import connection, transaction
from pgvector.django import CosineDistance

from apps.ml.constants import EMBEDDING_MODEL
from apps.ml.models import MovieSimilarity
from apps.movies.models import Movie

logger = logging.getLogger(__name__)

# Quantos candidatos o índice HNSW percorre antes de responder. O padrão do
# pgvector é 40, e com ele uma busca por 50 vizinhos devolvia 39 — o índice
# esgotava o feixe antes de completar a lista. Medido sobre 40 filmes do
# acervo, comparando com a busca exata:
#
#     ef_search   vizinhos   recall@50   recall@10
#            40       39.0       76.8%       95.2%
#           100       50.0       92.2%       97.5%
#           200       50.0      100.0%      100.0%
#           400       50.0      100.0%      100.0%
#
# Ou seja, no padrão um quarto da lista não era só curta, era errada. Em 200 a
# aproximação empata com a busca exata e 400 não acrescenta nada.
FATOR_EF_SEARCH = 4
EF_SEARCH_MINIMO = 200


def ef_search_para(top_n: int) -> int:
    """
    Largura do feixe de busca para uma lista de `top_n` vizinhos.

    O piso de 200 é o valor medido; o fator multiplicativo existe para o caso
    de alguém pedir listas maiores. Um ef_search menor que top_n devolve menos
    resultados do que o pedido — sem erro, só uma lista curta e pior.
    """
    return max(EF_SEARCH_MINIMO, top_n * FATOR_EF_SEARCH)


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

    consulta = (
        Movie.objects.filter(embedding__isnull=False)
        .exclude(id=filme.id)
        .annotate(distancia=CosineDistance('embedding', filme.embedding))
        .order_by('distancia')[:top_n]
    )

    # Leitura e escrita na mesma transação: o ef_search é ajustado com
    # set_config local, que vale só até o fim dela e por isso não vaza para
    # outras consultas da conexão.
    with transaction.atomic():
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT set_config('hnsw.ef_search', %s, true)",
                [str(ef_search_para(top_n))],
            )
        vizinhos = list(consulta)

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
        MovieSimilarity.objects.filter(movie=filme).delete()
        MovieSimilarity.objects.bulk_create(novas, ignore_conflicts=True)

    # Lista curta significa que o índice desistiu antes da hora, e foi assim
    # que o acervo inteiro quase ficou com 39 vizinhos por filme sem que nada
    # reclamasse.
    if len(novas) < top_n:
        logger.warning(
            'Só %s vizinhos para %s (pedidos %s): o índice pode estar '
            'devolvendo menos que o pedido.', len(novas), filme.title, top_n)

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
