"""
Testes do cache da ficha do filme.

A ficha traz campos que dependem de quem pediu, e o cache guarda numa chave
global. Verificado antes do conserto: a posição de 4242s de um usuário chegava
ao player de outro, que nunca tinha assistido nada.
"""

import pytest
from rest_framework.test import APIClient

from apps.core.core_cache import CacheManager
from apps.movies.models import Movie, WatchHistory
from apps.movies.serializers import MovieDetailSerializer


@pytest.fixture
def filme(db):
    return Movie.objects.create(title='Stalker', year=1979, ranking_current=42)


@pytest.fixture
def espectador(db, django_user_model):
    return django_user_model.objects.create_user(username='quem_assistiu', password='x')


@pytest.fixture
def recem_chegado(db, django_user_model):
    return django_user_model.objects.create_user(username='quem_nao_assistiu', password='x')


def cliente_de(usuario):
    c = APIClient()
    c.force_authenticate(user=usuario)
    return c


@pytest.fixture(autouse=True)
def cache_limpo(filme):
    CacheManager.invalidate_movie(str(filme.id))
    yield
    CacheManager.invalidate_movie(str(filme.id))


@pytest.mark.django_db
def test_a_posicao_de_um_usuario_nao_chega_ao_outro(filme, espectador, recem_chegado):
    """O defeito de origem, no caminho exato em que ele acontecia."""
    WatchHistory.objects.create(user=espectador, movie=filme,
                                progress_seconds=4242, runtime_seconds=9060)

    # Quem assistiu pede primeiro e popula o cache.
    primeiro = cliente_de(espectador).get(f'/api/movies/{filme.id}/')
    assert primeiro.data['watch_state']['progress_seconds'] == 4242

    # Quem nunca assistiu pede em seguida e lê o cache quente.
    segundo = cliente_de(recem_chegado).get(f'/api/movies/{filme.id}/')
    assert segundo.data['watch_state'] is None, 'o progresso vazou entre contas'


@pytest.mark.django_db
def test_a_ordem_dos_semelhantes_tambem_e_por_usuario(filme, espectador, recem_chegado):
    """
    `similar_movies` despriorizada o que aquele usuário já viu, então a lista
    inteira depende de quem pede — não só a marca de assistido em cada card.
    """
    assert 'similar_movies' in MovieDetailSerializer.CAMPOS_POR_USUARIO


@pytest.mark.django_db
def test_o_cache_guarda_so_o_que_nao_varia(filme, espectador):
    WatchHistory.objects.create(user=espectador, movie=filme, progress_seconds=99)

    cliente_de(espectador).get(f'/api/movies/{filme.id}/')

    guardado = CacheManager.get_movie(str(filme.id))
    assert guardado is not None, 'nada foi cacheado'
    for campo in MovieDetailSerializer.CAMPOS_POR_USUARIO:
        assert campo not in guardado, f'{campo} não pode ir para uma chave global'
    assert guardado['title'] == 'Stalker'


@pytest.mark.django_db
def test_com_cache_quente_a_ficha_continua_completa(filme, espectador):
    WatchHistory.objects.create(user=espectador, movie=filme, progress_seconds=99)
    cliente = cliente_de(espectador)

    cliente.get(f'/api/movies/{filme.id}/')          # popula
    quente = cliente.get(f'/api/movies/{filme.id}/')  # lê do cache

    assert quente.data['title'] == 'Stalker'
    assert quente.data['watch_state']['progress_seconds'] == 99
    assert 'similar_movies' in quente.data


@pytest.mark.django_db
def test_o_aquecimento_grava_a_mesma_forma_que_a_view_le(filme):
    """
    A task serializa sem requisição no contexto: `watch_state` sairia nulo e
    `similar_movies` sairia sem despriorizar nada. Gravar isso na chave global
    serviria a ficha de ninguém para todo mundo, por 24 horas.
    """
    from apps.tasks.cache import warm_popular_movies_cache

    warm_popular_movies_cache()

    guardado = CacheManager.get_movie(str(filme.id))
    assert guardado is not None
    for campo in MovieDetailSerializer.CAMPOS_POR_USUARIO:
        assert campo not in guardado


@pytest.mark.django_db
def test_ficha_aquecida_pela_task_ainda_responde_com_o_estado_de_quem_pede(
        filme, espectador):
    from apps.tasks.cache import warm_popular_movies_cache

    WatchHistory.objects.create(user=espectador, movie=filme, progress_seconds=77)
    warm_popular_movies_cache()

    resposta = cliente_de(espectador).get(f'/api/movies/{filme.id}/')

    assert resposta.data['watch_state']['progress_seconds'] == 77
