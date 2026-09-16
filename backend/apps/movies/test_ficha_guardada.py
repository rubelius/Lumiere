"""
A ficha guardada não pode sobreviver a quem reescreve o que ela mostra.

O DEFEITO: `retrieve` guarda a parte estável do filme por uma HORA na chave
`movie:<id>`, e é de lá que saem os selos de disponibilidade da lista de cópias
— "TOCA AGORA", "BAIXANDO", "PRECISA BAIXAR". Abrir a ficha dispara a
sincronização com o Real-Debrid, que reescreve essas colunas no banco; ninguém
derrubava o cache. O cliente refazia o GET e recebia o retrato de até uma hora
atrás: um filme recém-baixado seguia dizendo "PRECISA BAIXAR", e um removido da
conta seguia oferecendo play.
"""

import pytest
from django.core.cache import cache

from apps.core.core_cache import CacheManager
from apps.movies.models import Movie, TorrentRelease
from apps.movies.realdebrid_sync import atualiza_resumo


@pytest.fixture
def filme(db):
    f = Movie.objects.create(title='Filme', year=2000)
    TorrentRelease.objects.create(
        movie=f, title='Filme.1080p', info_hash='a' * 40, size_bytes=1,
        quality_score=50, resolution='1080p')
    return f


@pytest.mark.django_db
def test_atualizar_o_resumo_derruba_a_ficha_guardada(filme):
    CacheManager.set_movie(str(filme.id), {'best_quality_available': 'ANTIGO'})
    assert CacheManager.get_movie(str(filme.id)) is not None

    atualiza_resumo(filme)

    assert CacheManager.get_movie(str(filme.id)) is None, (
        'a ficha de até uma hora atrás continuaria sendo servida')


@pytest.mark.django_db
def test_filme_sem_copia_nao_derruba_nada(filme):
    """
    Sem cópia não há o que resumir, e `atualiza_resumo` sai antes de escrever.
    Derrubar o cache aí seria jogar fora uma ficha válida por nada.
    """
    sem_copias = Movie.objects.create(title='Outro', year=2001)
    CacheManager.set_movie(str(sem_copias.id), {'x': 1})

    assert atualiza_resumo(sem_copias) is False
    assert CacheManager.get_movie(str(sem_copias.id)) is not None


@pytest.mark.django_db
def test_derruba_a_ficha_CERTA(filme):
    """Invalidar o filme errado deixaria os dois mentindo."""
    vizinho = Movie.objects.create(title='Vizinho', year=2002)
    CacheManager.set_movie(str(vizinho.id), {'x': 1})
    CacheManager.set_movie(str(filme.id), {'x': 1})

    atualiza_resumo(filme)

    assert CacheManager.get_movie(str(filme.id)) is None
    assert CacheManager.get_movie(str(vizinho.id)) is not None
