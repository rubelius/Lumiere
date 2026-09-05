"""
Testes da sincronização com o Real-Debrid.

O contrato que importa aqui não é o caminho feliz: é o que a sincronização faz
quando a API do Real-Debrid não responde. Ela roda de hora em hora, e um erro
tratado como resposta válida apaga dado bom do acervo.
"""

def test_consulta_falha_nao_apaga_os_links_gravados():
    """
    `get_torrent_info` engole erro de HTTP e devolve {}, então "a API não
    respondeu" chegava aqui idêntico a "não tem links". Gravar [] por cima
    apagava os links bons, e playback.py exclui exatamente as linhas com lista
    vazia — um blip de rede na sincronização horária tirava o filme do ar.

    Em update_or_create, o que não está em defaults não é tocado. Por isso a
    ausência da chave é o conserto, e é o que este teste cobra.
    """
    from apps.movies.realdebrid_sync import monta_campos

    torrent = {'id': 'abc', 'hash': 'DEAD', 'status': 'downloaded',
               'bytes': 1, 'links': []}

    com = monta_campos(None, torrent, 'Alphaville 1965 1080p BluRay', grava_links=True)
    sem = monta_campos(None, torrent, 'Alphaville 1965 1080p BluRay', grava_links=False)

    assert com['realdebrid_links'] == []
    assert 'realdebrid_links' not in sem, (
        'a chave presente sobrescreve os links já gravados')
    # O resto do registro continua sendo atualizado normalmente.
    assert sem['realdebrid_status'] == 'downloaded'
    assert sem['in_realdebrid'] is True


import pytest

from apps.movies.models import Movie, TorrentRelease
from apps.movies.realdebrid_sync import _atualiza_resumo_dos_filmes, toca_agora


def cria_release(filme, **kwargs):
    # Os campos de qualidade são preenchidos pelo parser no caminho real;
    # aqui vão explícitos, para o rótulo da interface também ser exercitado.
    dados = dict(movie=filme, title='X 2160p REMUX', size_bytes=1,
                 info_hash=f'h{filme.id.hex[:12]}', quality_score=95,
                 resolution='2160p', is_remux=True, has_dolby_vision=True,
                 in_realdebrid=True, realdebrid_links=['rd://a'])
    dados.update(kwargs)
    return TorrentRelease.objects.create(**dados)


@pytest.mark.django_db
def test_filme_com_copia_reproduzivel_fica_marcado_como_disponivel():
    """
    `available_instantly` é o que responde "o que dá para ver agora": o
    endpoint /api/movies/available/ e o filtro da biblioteca leem esse campo.
    Nada no projeto o escrevia — ficava no default False para o acervo
    inteiro, e as duas telas devolviam vazio mesmo com filme pronto para tocar.
    """
    filme = Movie.objects.create(title='Mártires', year=2008)
    cria_release(filme)

    _atualiza_resumo_dos_filmes([filme.id])

    filme.refresh_from_db()
    assert filme.available_instantly is True
    assert filme.best_quality_available


@pytest.mark.django_db
def test_copia_sem_link_nao_conta_como_disponivel():
    """
    Mesma regra do resolvedor de reprodução. Prometer por um critério e
    reproduzir por outro produz filme marcado como disponível que falha ao
    dar play — e o usuário culpa o player, não o catálogo.
    """
    filme = Movie.objects.create(title='Sem link', year=2000)
    cria_release(filme, realdebrid_links=[])

    _atualiza_resumo_dos_filmes([filme.id])

    filme.refresh_from_db()
    assert filme.available_instantly is False
    assert toca_agora(filme) is False


@pytest.mark.django_db
def test_disponibilidade_e_retirada_quando_a_copia_some():
    """
    O campo precisa DESCER também: uma cópia que perdeu os links deixa de
    tocar, e continuar anunciando o filme como disponível é pior que nunca
    tê-lo anunciado.
    """
    filme = Movie.objects.create(title='Vai e volta', year=2000)
    release = cria_release(filme)
    _atualiza_resumo_dos_filmes([filme.id])
    filme.refresh_from_db()
    assert filme.available_instantly is True

    release.realdebrid_links = []
    release.save(update_fields=['realdebrid_links'])
    _atualiza_resumo_dos_filmes([filme.id])

    filme.refresh_from_db()
    assert filme.available_instantly is False
