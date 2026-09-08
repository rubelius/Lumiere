"""
Testes da importação de uma cópia para o Real-Debrid.

O que interessa aqui não é o caminho feliz. É o que a API grava quando o
Real-Debrid aceita o magnet pela metade: antes, o resultado de `select_files`
era descartado e o banco gravava 'downloading' de qualquer jeito, então a tela
anunciava um download que o Real-Debrid nunca tinha começado.
"""

import pytest
from rest_framework.test import APIClient

from apps.movies.models import Movie, TorrentRelease

MAGNET = 'magnet:?xt=urn:btih:' + 'a' * 40


@pytest.fixture
def usuario(db, django_user_model):
    return django_user_model.objects.create_user(
        username='cinefilo', password='x', realdebrid_api_key='chave-de-teste')


@pytest.fixture
def cliente(usuario):
    c = APIClient()
    c.force_authenticate(user=usuario)
    return c


@pytest.fixture
def copia(db):
    filme = Movie.objects.create(title='Stalker', year=1979)
    return TorrentRelease.objects.create(
        movie=filme, title='Stalker.1979.2160p.BluRay.REMUX', info_hash='a' * 40,
        magnet_link=MAGNET, size_bytes=40 * 1024 ** 3, seeders=12,
        resolution='2160p', is_remux=True, quality_score=95)


class RDFalso:
    """Dublê do RealDebridClient com os pontos de falha controláveis."""

    def __init__(self, *, arquivos=None, aceita_selecao=True, estado_final='downloaded',
                 links=None, explode=False):
        self.arquivos = [{'id': 1, 'bytes': 10}, {'id': 2, 'bytes': 999}] if arquivos is None else arquivos
        self.aceita_selecao = aceita_selecao
        self.estado_final = estado_final
        self.links = links or ['https://rd/link']
        self.explode = explode
        self.selecionados = None
        self.consultas = 0

    def __call__(self, *a, **kw):
        return self

    async def add_magnet(self, magnet):
        if self.explode:
            raise RuntimeError('Real-Debrid fora do ar')
        return 'TORRENT1'

    async def get_torrent_info(self, torrent_id):
        self.consultas += 1
        if self.consultas == 1:
            return {'files': self.arquivos, 'status': 'waiting_files_selection'}
        return {'status': self.estado_final, 'progress': 100, 'links': self.links}

    async def select_files(self, torrent_id, file_ids):
        self.selecionados = file_ids
        return self.aceita_selecao

    async def close(self):
        pass


@pytest.fixture
def rd(monkeypatch):
    def instala(dublê):
        monkeypatch.setattr('apps.movies.views.RealDebridClient', dublê)
        return dublê
    return instala


@pytest.mark.django_db
def test_importa_e_grava_o_estado_que_o_rd_devolveu(cliente, copia, rd):
    """Cacheada no acervo do RD: volta 'downloaded' na hora, e é isso que vale."""
    dublê = rd(RDFalso(estado_final='downloaded'))

    r = cliente.post(f'/api/releases/{copia.id}/add_to_realdebrid/')

    assert r.status_code == 200, r.data
    copia.refresh_from_db()
    assert copia.in_realdebrid is True
    assert copia.realdebrid_status == 'downloaded'
    assert copia.realdebrid_links == ['https://rd/link']
    assert copia.realdebrid_completed_at is not None
    assert copia.disponibilidade == TorrentRelease.PRONTA
    assert r.data['disponibilidade'] == TorrentRelease.PRONTA
    # Escolhe o arquivo maior — o filme, não a amostra nem o .nfo.
    assert dublê.selecionados == [2]


@pytest.mark.django_db
def test_ainda_baixando_nao_vira_pronta(cliente, copia, rd):
    rd(RDFalso(estado_final='downloading'))

    r = cliente.post(f'/api/releases/{copia.id}/add_to_realdebrid/')

    assert r.status_code == 200
    copia.refresh_from_db()
    assert copia.disponibilidade == TorrentRelease.BAIXANDO
    assert copia.realdebrid_completed_at is None
    assert copia.realdebrid_links == []


@pytest.mark.django_db
def test_recusa_de_selecao_nao_vira_download_no_banco(cliente, copia, rd):
    """
    O defeito de origem: `select_files` devolvia False, ninguém olhava, e a
    linha ia para 'downloading'. Do lado do RD o torrent ficava parado.
    """
    rd(RDFalso(aceita_selecao=False))

    r = cliente.post(f'/api/releases/{copia.id}/add_to_realdebrid/')

    assert r.status_code == 502
    copia.refresh_from_db()
    assert copia.in_realdebrid is False
    assert copia.realdebrid_status == ''
    assert copia.disponibilidade == TorrentRelease.AUSENTE


@pytest.mark.django_db
def test_sem_lista_de_arquivos_tambem_falha_alto(cliente, copia, rd):
    """`get_torrent_info` devolve {} quando a chamada falha — não é 'sem arquivos'."""
    rd(RDFalso(arquivos=[]))

    r = cliente.post(f'/api/releases/{copia.id}/add_to_realdebrid/')

    assert r.status_code == 502
    copia.refresh_from_db()
    assert copia.in_realdebrid is False


@pytest.mark.django_db
def test_falha_de_rede_explica_o_motivo(cliente, copia, rd):
    rd(RDFalso(explode=True))

    r = cliente.post(f'/api/releases/{copia.id}/add_to_realdebrid/')

    assert r.status_code == 502
    assert 'Real-Debrid fora do ar' in r.data['error']
    copia.refresh_from_db()
    assert copia.in_realdebrid is False


@pytest.mark.django_db
def test_copia_sem_magnet_nao_chega_a_chamar_o_rd(cliente, copia, rd):
    dublê = rd(RDFalso())
    copia.magnet_link = ''
    copia.save(update_fields=['magnet_link'])

    r = cliente.post(f'/api/releases/{copia.id}/add_to_realdebrid/')

    assert r.status_code == 400
    assert dublê.consultas == 0


@pytest.mark.django_db
def test_sem_chave_configurada_pede_configuracao(cliente, copia, usuario, rd, settings):
    rd(RDFalso())
    settings.REAL_DEBRID_API_KEY = ''
    usuario.realdebrid_api_key = ''
    usuario.save(update_fields=['realdebrid_api_key'])

    r = cliente.post(f'/api/releases/{copia.id}/add_to_realdebrid/')

    assert r.status_code == 400
    assert 'Real-Debrid' in r.data['error']


@pytest.mark.django_db
def test_nao_reenvia_o_que_ja_esta_ativo(cliente, copia, rd):
    dublê = rd(RDFalso())
    copia.in_realdebrid = True
    copia.realdebrid_id = 'JATEM'
    copia.realdebrid_status = 'downloaded'
    copia.save()

    r = cliente.post(f'/api/releases/{copia.id}/add_to_realdebrid/')

    assert r.status_code == 200
    assert dublê.consultas == 0


@pytest.mark.django_db
def test_reenvia_o_que_deu_erro_antes(cliente, copia, rd):
    """'error' e 'dead' são estados de recomeçar, não de deixar como está."""
    dublê = rd(RDFalso())
    copia.in_realdebrid = True
    copia.realdebrid_id = 'MORTO'
    copia.realdebrid_status = 'error'
    copia.save()

    r = cliente.post(f'/api/releases/{copia.id}/add_to_realdebrid/')

    assert r.status_code == 200
    assert dublê.consultas > 0
    copia.refresh_from_db()
    assert copia.realdebrid_id == 'TORRENT1'


@pytest.mark.django_db
def test_importar_invalida_o_cache_da_ficha(cliente, copia, rd, monkeypatch):
    """
    A ficha do filme fica em cache por uma hora. Sem invalidar, a tela mostrava
    o estado anterior por até uma hora depois da importação, e o botão parecia
    não ter feito nada.
    """
    invalidados = []
    monkeypatch.setattr('apps.movies.views.CacheManager.invalidate_movie',
                        lambda movie_id: invalidados.append(movie_id))
    rd(RDFalso())

    cliente.post(f'/api/releases/{copia.id}/add_to_realdebrid/')

    assert invalidados == [str(copia.movie_id)]


@pytest.mark.django_db
def test_importar_atualiza_o_resumo_que_o_card_le(cliente, copia, rd):
    """O card do acervo lê campos do filme, não das cópias."""
    rd(RDFalso(estado_final='downloaded'))
    filme = copia.movie
    assert filme.available_instantly is False

    cliente.post(f'/api/releases/{copia.id}/add_to_realdebrid/')

    filme.refresh_from_db()
    assert filme.available_instantly is True
    assert filme.best_quality_available


@pytest.mark.django_db
def test_cache_desativado_no_rd_nao_derruba_a_busca(cliente, copia, monkeypatch):
    """
    O Real-Debrid desativou instantAvailability. A busca precisa terminar
    assim mesmo, avisando que o estado de cache está sem resposta — e não
    estourar 500 em cima de uma busca que funcionou.
    """
    from apps.integrations.realdebrid import ConsultaDeCacheDesativada
    from apps.movies import release_search

    async def recusa(self, hashes):
        raise ConsultaDeCacheDesativada('o provedor removeu a rota')

    monkeypatch.setattr(
        'apps.integrations.realdebrid.RealDebridClient.check_instant_availability', recusa)

    falhou = __import__('asgiref.sync', fromlist=['async_to_sync']).async_to_sync(
        release_search._marca_cacheadas)([copia], cliente.handler._force_user)

    assert falhou is True, 'a tela precisa saber que a coluna está sem resposta'
