import logging
from typing import Dict, List, Optional

import numpy as np
import torch
from sentence_transformers import SentenceTransformer

from apps.ml.constants import EMBEDDING_DIMENSIONS, EMBEDDING_MODEL, aplica_prefixo

logger = logging.getLogger(__name__)


def monta_texto(dados: Dict) -> str:
    """
    Texto que representa o filme para o modelo.

    Existe uma função só porque os caminhos individual e em lote divergiam: o
    em lote — o que realmente roda no backfill — descartava keywords, que o
    acervo tem em 74% dos filmes. Embeddings gerados por caminhos diferentes
    não são comparáveis entre si.
    """
    partes = []
    if dados.get('title'):
        partes.append(f"Title: {dados['title']}")
    if dados.get('overview'):
        partes.append(f"Overview: {dados['overview']}")
    if dados.get('director'):
        partes.append(f"Director: {dados['director']}")
    for campo, rotulo, limite in (
        ('genres', 'Genres', None),
        ('themes', 'Themes', None),
        ('moods', 'Moods', None),
        ('keywords', 'Keywords', 10),
    ):
        valor = dados.get(campo)
        if not valor:
            continue
        if isinstance(valor, list):
            valor = ', '.join(valor[:limite] if limite else valor)
        partes.append(f'{rotulo}: {valor}')
    return ' '.join(partes)


class MovieEmbeddingGenerator:
    """
    Gera embeddings para filmes

    Usa sentence-transformers (all-MiniLM-L6-v2) para:
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
            numpy array de 384 dimensões
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
            User embedding (384 dims)
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