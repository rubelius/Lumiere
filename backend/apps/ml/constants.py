"""
Fonte única da dimensão dos embeddings.

O projeto já divergiu aqui: o gerador usa all-MiniLM-L6-v2, que produz 384
dimensões, mas Movie.embedding e User.taste_profile_embedding declaravam 768.
Gravar estourava com "expected 768 dimensions, not 384", e o recomendador
nunca saiu do zero. Trocar de modelo agora exige mexer só neste arquivo — e
gerar a migração correspondente.
"""

EMBEDDING_MODEL = 'all-MiniLM-L6-v2'
EMBEDDING_DIMENSIONS = 384
