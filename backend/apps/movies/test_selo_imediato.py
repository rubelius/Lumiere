"""
Uma sondagem cara que dá negativo precisa ser registrada.

O DEFEITO: `instantly_available` é o que faz a lista de cópias mostrar
"DISPONIBILIDADE IMEDIATA" em dourado, clicável, com o título "o Real-Debrid já
tem este arquivo — importar leva segundos". `_importa_para_a_conta` é
justamente o código que TESTA essa afirmação: adiciona o magnet, seleciona o
arquivo, relê o estado e, quando não volta 'downloaded', apaga o torrent e
devolve False — provando que o arquivo não estava lá.

E jogava a medição fora. O clique falhava, a pessoa voltava à ficha, o mesmo
selo dourado continuava prometendo o mesmo, e o ciclo se repetia: nada mais
abaixa a marca fora do clique manual em [ ATUALIZAR CÓPIAS ]. Uma flag que só
sobe — o formato da casa.
"""

from unittest.mock import AsyncMock, patch

import pytest
from asgiref.sync import async_to_sync

from apps.movies.models import Movie, TorrentRelease
from apps.movies.playback import _importa_para_a_conta


@pytest.fixture
def copia(db):
    filme = Movie.objects.create(title='Filme', year=2000)
    return TorrentRelease.objects.create(
        movie=filme, title='Filme.1080p', info_hash='a' * 40, size_bytes=1,
        magnet_link='magnet:?xt=urn:btih:' + 'a' * 40,
        instantly_available=True)


def cliente_que_responde(status):
    cliente = AsyncMock()
    cliente.add_magnet.return_value = 't1'
    cliente.get_torrent_info.side_effect = [
        {'files': [{'id': 1, 'bytes': 100}]},
        {'status': status, 'links': ['https://rd/l'] if status == 'downloaded' else []},
    ]
    cliente.select_files.return_value = True
    return cliente


@pytest.mark.django_db
def test_sondagem_negativa_abaixa_o_selo(copia):
    """O caso do relato: promete, falha, e continuava prometendo."""
    with patch('apps.movies.playback.RealDebridClient',
               return_value=cliente_que_responde('magnet_error')), \
         patch('apps.movies.realdebrid_cache.guarda'):
        ok = async_to_sync(_importa_para_a_conta)(copia, 'chave')

    assert ok is False
    copia.refresh_from_db()
    assert copia.instantly_available is False, (
        'o selo dourado continuaria prometendo play para sempre')
    assert copia.instant_check_at is not None, 'não registrou QUANDO mediu'


@pytest.mark.django_db
def test_a_resposta_negativa_tambem_vai_para_o_cache(copia):
    """
    Só o banco não basta: a resposta de seis horas de `realdebrid_cache`
    reconstruiria a marca na próxima sondagem.
    """
    with patch('apps.movies.playback.RealDebridClient',
               return_value=cliente_que_responde('magnet_error')), \
         patch('apps.movies.realdebrid_cache.guarda') as guarda:
        async_to_sync(_importa_para_a_conta)(copia, 'chave')

    assert guarda.call_count == 1
    assert guarda.call_args.args[0] == copia.info_hash
    assert guarda.call_args.args[1] == 'nao_cacheado'


@pytest.mark.django_db
def test_cache_indisponivel_nao_desfaz_o_conserto_no_banco(copia):
    """Não ter onde guardar não pode reverter o que a tela lê."""
    with patch('apps.movies.playback.RealDebridClient',
               return_value=cliente_que_responde('magnet_error')), \
         patch('apps.movies.realdebrid_cache.guarda', side_effect=OSError('redis fora')):
        ok = async_to_sync(_importa_para_a_conta)(copia, 'chave')

    assert ok is False
    copia.refresh_from_db()
    assert copia.instantly_available is False


@pytest.mark.django_db
def test_importacao_que_da_certo_nao_abaixa_nada(copia):
    with patch('apps.movies.playback.RealDebridClient',
               return_value=cliente_que_responde('downloaded')), \
         patch('apps.movies.realdebrid_cache.guarda') as guarda:
        ok = async_to_sync(_importa_para_a_conta)(copia, 'chave')

    assert ok is True
    copia.refresh_from_db()
    assert copia.instantly_available is True, 'abaixou a marca de uma cópia que ESTAVA lá'
    assert guarda.call_count == 0
