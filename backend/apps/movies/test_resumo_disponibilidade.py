"""
Testes do resumo de disponibilidade que o card do acervo lê.

O card não olha as cópias — olha campos do próprio filme. Quando esses campos
não são atualizados, ou nem chegam à listagem, a biblioteca inteira mente sobre
o que dá para assistir.
"""

import pytest

from apps.movies.models import Movie, TorrentRelease
from apps.movies.realdebrid_sync import atualiza_resumo
from apps.movies.serializers import MovieListSerializer, campos_da_listagem


@pytest.fixture
def filme(db):
    return Movie.objects.create(title='Stalker', year=1979)


def copia(filme, **campos):
    campos.setdefault('info_hash', 'f' * 40)
    campos.setdefault('size_bytes', 8 * 1024 ** 3)
    campos.setdefault('title', 'Stalker.1979.2160p.BluRay.REMUX')
    return TorrentRelease.objects.create(movie=filme, **campos)


@pytest.mark.django_db
def test_listagem_manda_a_disponibilidade_e_nao_so_o_plex():
    """
    O defeito de origem: MovieListSerializer expunha só `in_plex`, então o
    helper do cliente caía sempre em PLEX ou OFFLINE. Filme que tocava pelo
    Real-Debrid aparecia indisponível no acervo inteiro.
    """
    campos = MovieListSerializer().fields
    for campo in ('available_instantly', 'cached_in_realdebrid', 'best_quality_available'):
        assert campo in campos, f'{campo} não chega ao card'


@pytest.mark.django_db
def test_os_campos_novos_entram_no_only_da_listagem():
    """Campo lido pelo serializer e ausente do `.only()` vira N+1 silencioso."""
    colunas = campos_da_listagem()
    for campo in ('available_instantly', 'cached_in_realdebrid', 'best_quality_available'):
        assert campo in colunas


@pytest.mark.django_db
def test_copia_na_conta_com_link_deixa_o_filme_disponivel(filme):
    copia(filme, in_realdebrid=True, realdebrid_status='downloaded',
          realdebrid_links=['https://rd/x'], quality_score=90, resolution='2160p')

    assert atualiza_resumo(filme) is True
    filme.refresh_from_db()
    assert filme.available_instantly is True
    assert filme.best_quality_available


@pytest.mark.django_db
def test_copia_cacheada_mas_nao_importada_e_o_estado_do_meio(filme):
    """
    Não dá play ainda — falta importar — mas chamar isso de OFFLINE esconde
    justamente a cópia mais fácil de conseguir.
    """
    copia(filme, instantly_available=True, quality_score=80, resolution='1080p')

    atualiza_resumo(filme)
    filme.refresh_from_db()
    assert filme.available_instantly is False
    assert filme.cached_in_realdebrid is True


@pytest.mark.django_db
def test_copia_na_conta_sem_link_ainda_nao_toca(filme):
    """
    Mesma regra do playback.py: sem link não há o que reproduzir. Prometer
    disponibilidade por um critério e reproduzir por outro dá play que falha.
    """
    copia(filme, in_realdebrid=True, realdebrid_status='downloading',
          realdebrid_links=[], quality_score=70)

    atualiza_resumo(filme)
    filme.refresh_from_db()
    assert filme.available_instantly is False


@pytest.mark.django_db
def test_perder_a_copia_cacheada_desliga_a_marca(filme):
    """
    O padrão que já apareceu três vezes neste projeto: flag que só sobe.
    Se o Real-Debrid deixa de ter o arquivo, o card tem que voltar atrás.
    """
    c = copia(filme, instantly_available=True, quality_score=80)
    atualiza_resumo(filme)
    filme.refresh_from_db()
    assert filme.cached_in_realdebrid is True

    c.instantly_available = False
    c.save(update_fields=['instantly_available'])
    atualiza_resumo(filme)
    filme.refresh_from_db()
    assert filme.cached_in_realdebrid is False


@pytest.mark.django_db
def test_filme_sem_copia_nenhuma_nao_e_resumido(filme):
    assert atualiza_resumo(filme) is False
    filme.refresh_from_db()
    assert filme.available_instantly is False
    assert filme.cached_in_realdebrid is False
