import logging
from typing import Dict, List, Optional

import numpy as np
import torch
from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)


class MovieEmbeddingGenerator:
    """
    Gera embeddings para filmes

    Usa sentence-transformers (all-MiniLM-L6-v2) para:
    - Overview do filme
    - Gêneros e temas
    - Diretor e elenco principal
    """

    def __init__(self, model_name: str = 'all-MiniLM-L6-v2'):
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

        text_parts = []

        if movie_data.get('title'):
            text_parts.append(f"Title: {movie_data['title']}")

        if movie_data.get('overview'):
            text_parts.append(f"Overview: {movie_data['overview']}")

        if movie_data.get('director'):
            text_parts.append(f"Director: {movie_data['director']}")

        if movie_data.get('genres'):
            genres = ', '.join(movie_data['genres']) if isinstance(movie_data['genres'], list) else movie_data['genres']
            text_parts.append(f"Genres: {genres}")

        if movie_data.get('themes'):
            themes = ', '.join(movie_data['themes']) if isinstance(movie_data['themes'], list) else movie_data['themes']
            text_parts.append(f"Themes: {themes}")

        if movie_data.get('moods'):
            moods = ', '.join(movie_data['moods']) if isinstance(movie_data['moods'], list) else movie_data['moods']
            text_parts.append(f"Moods: {moods}")

        if movie_data.get('keywords'):
            keywords = ', '.join(movie_data['keywords'][:10]) if isinstance(movie_data['keywords'], list) else movie_data['keywords']
            text_parts.append(f"Keywords: {keywords}")

        text = ' '.join(text_parts)

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

        texts = []
        for movie_data in movies_data:
            text_parts = []

            if movie_data.get('title'):
                text_parts.append(f"Title: {movie_data['title']}")
            if movie_data.get('overview'):
                text_parts.append(f"Overview: {movie_data['overview']}")
            if movie_data.get('director'):
                text_parts.append(f"Director: {movie_data['director']}")
            if movie_data.get('genres'):
                genres = ', '.join(movie_data['genres']) if isinstance(movie_data['genres'], list) else movie_data['genres']
                text_parts.append(f"Genres: {genres}")

            texts.append(' '.join(text_parts))

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
            return np.zeros(384)

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