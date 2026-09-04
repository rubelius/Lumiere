import logging
from typing import Dict, List, Optional

import numpy as np
import torch
from sentence_transformers import SentenceTransformer

from apps.ml.constants import EMBEDDING_DIMENSIONS, EMBEDDING_MODEL, aplica_prefixo

logger = logging.getLogger(__name__)


# Receitas do texto que representa o filme, na ordem em que os campos entram.
# Cada item é (campo, rótulo, limite de itens da lista).
#
# 'atual' é o que o acervo tem embeddado. As outras existem para o benchmark
# responder por medição uma pergunta que hoje só tem palpite: quais campos
# ajudam a recuperar o filme certo. Medir o acervo mostrou que `themes` e
# `moods` estão em 0% dos filmes — ocupam lugar na receita e nunca contribuem
# — enquanto `year` (99%), `country` (100%) e `cast` (91%) ficam de fora.
RECEITAS: Dict[str, tuple] = {
    'atual': (
        ('title', 'Title', None),
        ('overview', 'Overview', None),
        ('director', 'Director', None),
        ('genres', 'Genres', None),
        ('themes', 'Themes', None),
        ('moods', 'Moods', None),
        ('keywords', 'Keywords', 10),
    ),
    # A atual sem os dois campos vazios. Deve empatar; serve de controle, para
    # mostrar que a diferença das outras vem do campo novo e não do ruído.
    'enxuta': (
        ('title', 'Title', None),
        ('overview', 'Overview', None),
        ('director', 'Director', None),
        ('genres', 'Genres', None),
        ('keywords', 'Keywords', 10),
    ),
    'com_ano_e_pais': (
        ('title', 'Title', None),
        ('year', 'Year', None),
        ('country', 'Country', None),
        ('overview', 'Overview', None),
        ('director', 'Director', None),
        ('genres', 'Genres', None),
        ('keywords', 'Keywords', 10),
    ),
    'com_elenco': (
        ('title', 'Title', None),
        ('overview', 'Overview', None),
        ('director', 'Director', None),
        ('cast', 'Cast', 5),
        ('genres', 'Genres', None),
        ('keywords', 'Keywords', 10),
    ),
    'completa': (
        ('title', 'Title', None),
        ('year', 'Year', None),
        ('country', 'Country', None),
        ('overview', 'Overview', None),
        ('director', 'Director', None),
        ('cast', 'Cast', 5),
        ('genres', 'Genres', None),
        ('keywords', 'Keywords', 10),
    ),
}


def monta_texto(dados: Dict, receita: str = 'atual') -> str:
    """
    Texto que representa o filme para o modelo.

    Existe uma função só porque os caminhos individual e em lote divergiam: o
    em lote — o que realmente roda no backfill — descartava keywords, que o
    acervo tem em 74% dos filmes. Embeddings gerados por caminhos diferentes
    não são comparáveis entre si, e é pela mesma razão que a receita é um
    parâmetro com padrão fixo: trocá-la exige re-embeddar o acervo inteiro.
    """
    partes = []
    for campo, rotulo, limite in RECEITAS[receita]:
        valor = dados.get(campo)
        if not valor:
            continue
        if isinstance(valor, list):
            # O elenco vem como lista de dicts do TMDB; ao modelo interessa o
            # nome, não a estrutura.
            itens = [i.get('name', '') if isinstance(i, dict) else str(i) for i in valor]
            valor = ', '.join(i for i in itens[:limite] if i) if limite else ', '.join(
                i for i in itens if i)
            if not valor:
                continue
        partes.append(f'{rotulo}: {valor}')
    return ' '.join(partes)


class MovieEmbeddingGenerator:
    """
    Gera embeddings para filmes

    Usa sentence-transformers, com o modelo definido em apps/ml/constants.py,
    sobre:
    - Overview do filme
    - Gêneros e temas
    - Diretor e elenco principal
    """

    def __init__(self, model_name: str = EMBEDDING_MODEL):
        self.model_name = model_name
        self.model: Optional[SentenceTransformer] = None
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        logger.info(f"Using device: {self.device}")

    def load_model(self):
        """Carrega modelo (lazy loading)"""
        if self.model is None:
            logger.info(f"Loading model: {self.model_name}")
            self.model = SentenceTransformer(self.model_name)
            self.model.to(self.device)

    def generate_movie_embedding(self, movie_data: Dict) -> np.ndarray:
        """
        Gera embedding para um filme

        Args:
            movie_data: Dict com title, overview, director, genres, themes, etc.

        Returns:
            numpy array com EMBEDDING_DIMENSIONS posições
        """
        self.load_model()

        text = aplica_prefixo(monta_texto(movie_data), self.model_name)

        embedding = self.model.encode(  # type: ignore
            text,
            convert_to_numpy=True,
            show_progress_bar=False
        )

        return embedding  # type: ignore

    def generate_batch_embeddings(self, movies_data: List[Dict], batch_size: int = 32) -> List[np.ndarray]:
        """
        Gera embeddings para múltiplos filmes (mais eficiente)

        Args:
            movies_data: Lista de dicts com dados dos filmes
            batch_size: Tamanho do batch para processamento

        Returns:
            Lista de embeddings
        """
        self.load_model()

        texts = [aplica_prefixo(monta_texto(d), self.model_name) for d in movies_data]

        embeddings = self.model.encode(  # type: ignore
            texts,
            batch_size=batch_size,
            convert_to_numpy=True,
            show_progress_bar=True
        )

        return embeddings  # type: ignore


class UserTasteEmbeddingGenerator:
    """
    Gera embedding de gosto do usuário baseado em histórico
    """

    def __init__(self):
        self.movie_generator = MovieEmbeddingGenerator()

    @property
    def model_name(self) -> str:
        """
        Modelo que originou os vetores. O perfil é a média dos embeddings dos
        filmes, então quem responde é o gerador embrulhado — e quem grava o
        perfil precisa carimbar este nome, não um literal que envelhece.
        """
        return self.movie_generator.model_name

    def generate_user_embedding(
        self,
        watched_movies_embeddings: List[np.ndarray],
        ratings: Optional[List[float]] = None
    ) -> np.ndarray:
        """
        Gera embedding do usuário como média ponderada dos filmes assistidos

        Args:
            watched_movies_embeddings: Lista de embeddings dos filmes assistidos
            ratings: Lista de ratings (0.5 a 5.0). Se None, peso igual para todos

        Returns:
            Embedding do usuário, com EMBEDDING_DIMENSIONS posições
        """
        if not watched_movies_embeddings:
            return np.zeros(EMBEDDING_DIMENSIONS)

        embeddings_array = np.array(watched_movies_embeddings)

        if ratings is None:
            user_embedding = np.mean(embeddings_array, axis=0)
        else:
            weights = np.array(ratings) / 5.0
            weights = weights.reshape(-1, 1)

            weighted_embeddings = embeddings_array * weights
            user_embedding = np.sum(weighted_embeddings, axis=0) / np.sum(weights)

        norm = np.linalg.norm(user_embedding)
        if norm > 0:
            user_embedding = user_embedding / norm

        return user_embedding