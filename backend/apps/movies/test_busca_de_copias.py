"""
Testes da busca de cópias, agora fora do caminho da requisição.

A busca leva de 40 a 100 segundos — medido contra o Prowlarr real, cujo
gargalo é um indexador que agrega os do Jackett. O endpoint deixou de esperar
por ela; o que estes testes cobram é que a tela consiga dizer a verdade sobre
o que está acontecendo em cada um dos desfechos.
"""

import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from apps.integrations.prowlarr import ProwlarrIndisponivel
from apps.movies import release_search
from apps.movies.models import Movie, TorrentRelease
from apps.movies.release_search import (BUSCANDO, CONCLUIDA, ENFILEIRADA, ERRO,
                                        OCIOSA, estado_da_busca)

CAMPOS = ('movie_id', 'estado', 'iniciada_em', 'concluida_em', 'erro',
          'new_releases_found', 'total_releases', 'cache_check_failed',
          'consultas_falhas')


@pytest.fixture
def usuario(db, django_user_model):
    return django_user_model.objects.create_user(
        username='cinefilo', password='x',
        prowlarr_url='http://prowlarr:9696', prowlarr_api_key='chave')


@pytest.fixture
def filme(db):
    return Movie.objects.create(title='Stalker', original_title='Сталкер', year=1979)


@pytest.fixture
def cliente(usuario):
    c = APIClient()
    c.force_authenticate(user=usuario)
    return c


@pytest.fixture(autouse=True)
def cache_limpo(filme):
    for molde in (release_search.CHAVE_ANDAMENTO, release_search.CHAVE_RESULTADO):
        cache.delete(molde.format(filme.id))
    yield
    for molde in (release_search.CHAVE_ANDAMENTO, release_search.CHAVE_RESULTADO):
        cache.delete(molde.format(filme.id))


@pytest.fixture
def enfileiramentos(monkeypatch):
    """Conta os despachos sem precisar de worker."""
    chamadas = []
    monkeypatch.setattr('apps.movies.views.search_torrents_for_movie.delay',
                        lambda *a, **kw: chamadas.append(a))
    return chamadas


# ── o endpoint ────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_o_post_devolve_na_hora_e_diz_que_enfileirou(cliente, filme, enfileiramentos):
    r = cliente.post(f'/api/movies/{filme.id}/search_torrents/')

    assert r.status_code == 202
    assert r.data['estado'] == ENFILEIRADA
    assert len(enfileiramentos) == 1


@pytest.mark.django_db
def test_dois_cliques_nao_viram_duas_idas_ao_prowlarr(cliente, filme, enfileiramentos):
    """
    `cache.add` é SETNX: atômico, e portanto o cadeado e o estado ao mesmo
    tempo. As duas telas passam a acompanhar a mesma busca.
    """
    primeiro = cliente.post(f'/api/movies/{filme.id}/search_torrents/')
    segundo = cliente.post(f'/api/movies/{filme.id}/search_torrents/')

    assert segundo.status_code == 202
    assert len(enfileiramentos) == 1, 'a segunda tela disparou uma busca própria'
    assert segundo.data['iniciada_em'] == primeiro.data['iniciada_em']


@pytest.mark.django_db
def test_sem_prowlarr_configurado_o_motivo_chega_inteiro(filme, django_user_model,
                                                          enfileiramentos):
    sem_prowlarr = django_user_model.objects.create_user(username='novato', password='x')
    c = APIClient()
    c.force_authenticate(user=sem_prowlarr)

    r = c.post(f'/api/movies/{filme.id}/search_torrents/')

    assert r.status_code == 400
    assert 'Prowlarr' in r.data['error']
    assert enfileiramentos == []


@pytest.mark.django_db
def test_fila_fora_do_ar_nao_deixa_o_botao_travado(cliente, filme, monkeypatch):
    """
    Sem soltar a reivindicação, o botão ficaria cinco minutos preso por causa
    de um broker que nem chegou a aceitar o trabalho.
    """
    def recusa(*a, **kw):
        raise OSError('broker fora do ar')

    monkeypatch.setattr('apps.movies.views.search_torrents_for_movie.delay', recusa)

    r = cliente.post(f'/api/movies/{filme.id}/search_torrents/')

    assert r.status_code == 503
    assert estado_da_busca(str(filme.id))['estado'] == OCIOSA, 'a chave ficou presa'


# ── a consulta de estado ──────────────────────────────────────────────────

@pytest.mark.django_db
def test_sem_busca_nenhuma_o_documento_vem_completo(cliente, filme):
    """
    Todo documento tem todas as chaves, sempre: o cliente nunca precisa
    checar se um campo existe.
    """
    r = cliente.get(f'/api/movies/{filme.id}/search_status/')

    assert r.status_code == 200
    assert r.data['estado'] == OCIOSA
    for campo in CAMPOS:
        assert campo in r.data, campo
    for contador in ('new_releases_found', 'total_releases', 'cache_check_failed'):
        assert r.data[contador] is None, f'{contador} nasceu com valor'


@pytest.mark.django_db
def test_o_estado_de_leitura_nao_e_estrangulado(cliente, filme, enfileiramentos):
    """
    O POST tem ExpensiveOperationThrottle a 10/hora. Se a leitura dividisse a
    action, a consulta de 2 em 2 segundos tomaria 429 em meio minuto — e um
    429 no polling não aparece na tela.
    """
    cliente.post(f'/api/movies/{filme.id}/search_torrents/')

    for _ in range(30):
        r = cliente.get(f'/api/movies/{filme.id}/search_status/')
        assert r.status_code == 200


@pytest.mark.django_db
def test_uma_busca_em_curso_ganha_de_um_resultado_antigo(filme):
    release_search.grava_conclusao(str(filme.id), {'new_releases_found': 3,
                                                   'total_releases': 3})
    release_search.marca_buscando(str(filme.id))

    assert estado_da_busca(str(filme.id))['estado'] == BUSCANDO


# ── os desfechos ──────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_nao_achar_nada_nao_e_erro(filme):
    """
    A distinção que o 200-contra-502 carregava, e que não pode se perder:
    "os indexadores responderam e não havia nada" é diferente de "a busca
    quebrou".
    """
    release_search.grava_conclusao(str(filme.id), {'new_releases_found': 0,
                                                   'total_releases': 0})

    doc = estado_da_busca(str(filme.id))
    assert doc['estado'] == CONCLUIDA
    assert doc['erro'] is None
    assert doc['new_releases_found'] == 0


@pytest.mark.django_db
def test_prowlarr_fora_vira_erro_legivel_e_nada_e_gravado(filme, usuario, monkeypatch):
    from apps.tasks.torrents import search_torrents_for_movie

    def explode(*a, **kw):
        raise ProwlarrIndisponivel('O Prowlarr devolveu algo que não é JSON.')

    monkeypatch.setattr('apps.movies.release_search.executa_busca', explode)
    antes = TorrentRelease.objects.count()

    search_torrents_for_movie(str(filme.id), str(usuario.id), None)

    doc = estado_da_busca(str(filme.id))
    assert doc['estado'] == ERRO
    assert 'não é JSON' in doc['erro']
    assert TorrentRelease.objects.count() == antes


@pytest.mark.django_db
def test_falha_parcial_do_prowlarr_chega_a_tela(filme, usuario, monkeypatch):
    """
    `search_movie` só levanta quando TODAS as consultas caem. A parcial virava
    um logger.warning e o acervo encolhia em silêncio.
    """
    from apps.tasks.torrents import search_torrents_for_movie

    monkeypatch.setattr('apps.movies.release_search.executa_busca',
                        lambda *a, **kw: {'new_releases_found': 2, 'total_releases': 2,
                                          'cache_check_failed': False,
                                          'consultas_falhas': ['Stalker 1979: caiu']})

    search_torrents_for_movie(str(filme.id), str(usuario.id), None)

    doc = estado_da_busca(str(filme.id))
    assert doc['estado'] == CONCLUIDA
    assert doc['consultas_falhas'] == ['Stalker 1979: caiu']


@pytest.mark.django_db
def test_registro_apagado_entre_o_clique_e_a_execucao(usuario):
    """
    Sem gravar o erro, a chave de andamento ficaria cinco minutos e a tela
    diria "na fila" para uma busca que nunca vai acontecer.
    """
    import uuid
    from apps.tasks.torrents import search_torrents_for_movie

    inexistente = str(uuid.uuid4())
    search_torrents_for_movie(inexistente, str(usuario.id), None)

    doc = estado_da_busca(inexistente)
    assert doc['estado'] == ERRO
    assert 'não pôde começar' in doc['erro']


# ── a ordem que importa ───────────────────────────────────────────────────

@pytest.mark.django_db
def test_a_ficha_e_invalidada_depois_de_o_resumo_ser_recalculado(filme, usuario,
                                                                  monkeypatch):
    """
    A view invalidava a ficha ANTES da busca e recalculava o resumo 40 a 100
    segundos depois. `retrieve` repopula a chave com TTL de uma hora, e
    best_releases está na parte estável: qualquer GET nessa janela congelava
    dados velhos por uma hora.
    """
    ordem = []
    monkeypatch.setattr('apps.movies.release_search.atualiza_resumo',
                        lambda m: ordem.append('resumo'))
    monkeypatch.setattr('apps.movies.release_search.CacheManager.invalidate_movie',
                        lambda mid: ordem.append('invalida'))

    async def sem_copias(self, **kw):
        return []

    monkeypatch.setattr('apps.integrations.prowlarr.ProwlarrClient.search_movie',
                        sem_copias)

    release_search.executa_busca(filme, usuario, None)

    assert ordem == ['resumo', 'invalida'], f'ordem errada: {ordem}'


# ── os filtros, que estavam escritos duas vezes ───────────────────────────

def test_os_filtros_padrao_valem_para_os_dois_caminhos():
    from apps.movies.release_search import FILTROS_PADRAO, normaliza_filtros

    assert normaliza_filtros(None) == FILTROS_PADRAO
    assert normaliza_filtros({})['min_seeders'] == 5


def test_min_seeders_de_texto_vira_numero():
    from apps.movies.release_search import normaliza_filtros

    assert normaliza_filtros({'min_seeders': '12'})['min_seeders'] == 12
    assert normaliza_filtros({'min_seeders': 'lixo'})['min_seeders'] == 5


@pytest.mark.django_db
def test_o_cliente_do_prowlarr_vive_e_morre_no_mesmo_loop(filme, usuario, monkeypatch):
    """
    Cada `async_to_sync` abre e FECHA o próprio event loop. Com a busca numa
    chamada e o `close()` em outra, o cliente httpx nascia num loop e era
    fechado a partir de outro: "Event loop is closed", verificado ao vivo
    contra o Prowlarr real — a busca inteira falhava depois de 100 segundos.
    """
    import asyncio

    loops = {}

    async def anota_busca(self, **kw):
        loops['busca'] = id(asyncio.get_running_loop())
        return []

    async def anota_fechamento(self):
        loops['fechamento'] = id(asyncio.get_running_loop())

    monkeypatch.setattr('apps.integrations.prowlarr.ProwlarrClient.search_movie', anota_busca)
    monkeypatch.setattr('apps.integrations.prowlarr.ProwlarrClient.close', anota_fechamento)

    release_search.executa_busca(filme, usuario, None)

    assert loops['busca'] == loops['fechamento'], 'o cliente foi fechado de outro loop'
