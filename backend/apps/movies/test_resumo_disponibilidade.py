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
def test_cache_no_acervo_acende_a_marca_do_filme(filme):
    """
    É esta marca que decide se o botão de projeção pulsa. Ficou órfã quando o
    Real-Debrid desativou instantAvailability; hoje vem da sondagem.
    """
    copia(filme, instantly_available=True, quality_score=80, resolution='1080p')

    atualiza_resumo(filme)

    filme.refresh_from_db()
    assert filme.cached_in_realdebrid is True


@pytest.mark.django_db
def test_sem_nenhuma_copia_imediata_a_marca_apaga(filme):
    """Mais uma que precisa poder descer: o acervo do RD não é eterno."""
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
def test_perder_a_copia_na_conta_desliga_a_marca(filme):
    """
    O padrão que já apareceu quatro vezes neste projeto: flag que só sobe.
    Se a cópia sai da conta do Real-Debrid, o card tem que voltar atrás.
    """
    c = copia(filme, in_realdebrid=True, realdebrid_status='downloaded',
              realdebrid_links=['https://rd/x'], quality_score=80)
    atualiza_resumo(filme)
    filme.refresh_from_db()
    assert filme.available_instantly is True

    c.in_realdebrid = False
    c.realdebrid_links = []
    c.save(update_fields=['in_realdebrid', 'realdebrid_links'])
    atualiza_resumo(filme)
    filme.refresh_from_db()
    assert filme.available_instantly is False


@pytest.mark.django_db
def test_filme_sem_copia_nenhuma_nao_e_resumido(filme):
    assert atualiza_resumo(filme) is False
    filme.refresh_from_db()
    assert filme.available_instantly is False
    assert filme.cached_in_realdebrid is False
