"""
Testes do monitor de download do Real-Debrid.

O que se trava aqui é o fluxo de exceções, não o caminho feliz. Os três
defeitos que motivaram estes testes só apareciam com o worker ligado, e o pior
deles dobrava a cada 30 segundos.
"""

import pytest
from celery.exceptions import Retry

from apps.movies.models import Movie, TorrentRelease
from apps.tasks import downloads
from apps.tasks.downloads import monitor_realdebrid_download

LINKS_BONS = ['https://rd/arquivo.mkv']


@pytest.fixture
def usuario(db, django_user_model):
    return django_user_model.objects.create_user(
        username='cinefilo', password='x', realdebrid_api_key='chave')


@pytest.fixture
def copia(db):
    filme = Movie.objects.create(title='Stalker', year=1979)
    return TorrentRelease.objects.create(
        movie=filme, title='Stalker.1979.2160p.REMUX', info_hash='a' * 40,
        size_bytes=60 * 1024 ** 3, magnet_link='magnet:?xt=urn:btih:' + 'a' * 40,
        in_realdebrid=True, realdebrid_id='TORRENT1',
        realdebrid_status='downloading', realdebrid_links=LINKS_BONS)


@pytest.fixture
def rd(monkeypatch):
    """Controla o que o Real-Debrid responde às duas chamadas do monitor."""
    def instala(info=None, links=None):
        async def _info(self, torrent_id):
            return {} if info is None else info

        async def _links(self, torrent_id):
            return [] if links is None else links

        monkeypatch.setattr(
            'apps.integrations.realdebrid.RealDebridClient.get_torrent_info', _info)
        monkeypatch.setattr(
            'apps.integrations.realdebrid.RealDebridClient.get_download_links', _links)
        monkeypatch.setattr(
            'apps.integrations.realdebrid.RealDebridClient.close',
            lambda self: _nada())
    return instala


async def _nada():
    return None


@pytest.fixture
def conta_retries(monkeypatch):
    """
    Substitui `self.retry` por um contador.

    O real ENFILEIRA a próxima rodada e só então levanta Retry; contar as
    chamadas é contar quantas cópias cada execução deixa na fila.
    """
    chamadas = []

    def falso(*args, **kwargs):
        chamadas.append(kwargs)
        raise Retry()

    monkeypatch.setattr(monitor_realdebrid_download, 'retry', falso)
    return chamadas


def roda(release_id, user_id, retries=0, **kw):
    monitor_realdebrid_download.push_request(retries=retries)
    try:
        return monitor_realdebrid_download.run(str(release_id), str(user_id), **kw)
    finally:
        monitor_realdebrid_download.pop_request()


# ── a bomba ───────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_cada_rodada_enfileira_uma_unica_copia(copia, usuario, rd, conta_retries):
    """
    O defeito de origem. `celery.exceptions.Retry` herda de Exception, então o
    `except Exception` capturava o retry do caminho normal e chamava retry()
    de novo: duas cópias por rodada, dobrando a cada 30 segundos.

    O lock de check_realdebrid_status não defendia disso — ele só impede que o
    check periódico dispare um monitor a mais, e estas cópias nascem por
    dentro do próprio retry.
    """
    rd(info={'status': 'downloading', 'progress': 42})

    with pytest.raises(Retry):
        roda(copia.id, usuario.id)

    assert len(conta_retries) == 1, (
        f'{len(conta_retries)} cópias enfileiradas numa rodada só')


@pytest.mark.django_db
def test_erro_transitorio_tambem_enfileira_uma_so(copia, usuario, rd, conta_retries):
    rd(info=None)  # get_torrent_info devolvendo {} = falha de chamada

    with pytest.raises(Retry):
        roda(copia.id, usuario.id)

    assert len(conta_retries) == 1


@pytest.mark.django_db
def test_o_progresso_e_gravado_antes_de_reagendar(copia, usuario, rd, conta_retries):
    rd(info={'status': 'downloading', 'progress': 42})

    with pytest.raises(Retry):
        roda(copia.id, usuario.id)

    copia.refresh_from_db()
    assert copia.realdebrid_progress == 42


# ── esgotar tentativas não é condenar ─────────────────────────────────────

@pytest.mark.django_db
def test_esgotar_tentativas_nao_marca_download_saudavel_como_erro(copia, usuario, rd):
    """
    50 tentativas de 30s dão 25 minutos, e um REMUX 4K não cacheado leva mais
    que isso. Esgotar é desfecho normal de download grande, não falha.
    """
    rd(info=None)

    r = roda(copia.id, usuario.id, retries=monitor_realdebrid_download.max_retries)

    copia.refresh_from_db()
    assert copia.realdebrid_status == 'downloading', 'condenou um download vivo'
    assert r['status'] == 'unknown'


@pytest.mark.django_db
def test_release_esgotada_continua_visivel_para_o_check_periodico(copia, usuario, rd):
    """
    O agravante. 'error' não é só impreciso: o filtro de
    check_realdebrid_status procura por downloading/queued/
    waiting_files_selection, então marcar assim tira a release do alcance do
    único mecanismo que retomaria o monitoramento. Ficaria órfã para sempre.
    """
    rd(info=None)

    roda(copia.id, usuario.id, retries=monitor_realdebrid_download.max_retries)

    ativas = TorrentRelease.objects.filter(
        in_realdebrid=True,
        realdebrid_status__in=['downloading', 'queued', 'waiting_files_selection'])
    assert copia in ativas, 'o check periódico nunca mais olharia para ela'


@pytest.mark.django_db
def test_esgotar_devolve_o_lock(copia, usuario, rd):
    from django.core.cache import cache

    chave = f'rd_monitor_lock_{copia.id}'
    cache.set(chave, '1', timeout=600)
    rd(info=None)

    roda(copia.id, usuario.id, retries=monitor_realdebrid_download.max_retries,
         lock_key=chave)

    assert cache.get(chave) is None, 'lock preso trava o check periódico por 26 min'


# ── registro apagado é fim de linha ───────────────────────────────────────

@pytest.mark.django_db
def test_release_apagada_nao_vira_cinquenta_tentativas(usuario, rd, conta_retries):
    """Linha que não existe não volta a existir; repetir é só barulho."""
    import uuid
    rd(info=None)

    r = roda(uuid.uuid4(), usuario.id)

    assert conta_retries == []
    assert r['status'] == 'gone'


@pytest.mark.django_db
def test_usuario_apagado_tambem(copia, rd, conta_retries):
    import uuid
    rd(info=None)

    r = roda(copia.id, uuid.uuid4())

    assert conta_retries == []
    assert r['status'] == 'gone'


# ── a conclusão não pode apagar o que já vale ─────────────────────────────

@pytest.mark.django_db
def test_falha_ao_buscar_links_nao_apaga_os_que_ja_existiam(copia, usuario, rd,
                                                            conta_retries):
    """
    `get_download_links` refaz um get_torrent_info por dentro, e esse engole
    erro de HTTP e devolve {} — um blip de rede no exato momento da conclusão
    virava []. Gravar isso por cima apagava os links bons, e playback.py e
    tasks/sessions.py excluem justamente as linhas com lista vazia: o filme
    saía do ar por causa do blip.
    """
    rd(info={'status': 'downloaded', 'progress': 100}, links=[])

    with pytest.raises(Retry):
        roda(copia.id, usuario.id)

    copia.refresh_from_db()
    assert copia.realdebrid_links == LINKS_BONS
    assert copia.realdebrid_completed_at is None


@pytest.mark.django_db
def test_esgotar_no_meio_da_conclusao_tambem_preserva(copia, usuario, rd):
    rd(info={'status': 'downloaded', 'progress': 100}, links=[])

    roda(copia.id, usuario.id, retries=monitor_realdebrid_download.max_retries)

    copia.refresh_from_db()
    assert copia.realdebrid_links == LINKS_BONS


@pytest.mark.django_db
def test_links_de_verdade_sao_gravados(copia, usuario, rd, conta_retries):
    novos = ['https://rd/novo.mkv']
    rd(info={'status': 'downloaded', 'progress': 100}, links=novos)

    r = roda(copia.id, usuario.id)

    copia.refresh_from_db()
    assert copia.realdebrid_links == novos
    assert copia.realdebrid_completed_at is not None
    assert r['status'] == 'completed'
    assert conta_retries == [], 'estado terminal não reagenda'


# ── quem dispara o monitor ────────────────────────────────────────────────

@pytest.fixture
def rd_envio(monkeypatch):
    """Dublê do envio: add_magnet, get_torrent_info e select_files."""
    async def _add(self, magnet):
        return 'TORRENT-NOVO'

    async def _info(self, torrent_id):
        return {'files': [{'id': 1, 'bytes': 10}, {'id': 2, 'bytes': 999}]}

    async def _sel(self, torrent_id, file_ids=None):
        return True

    for nome, fn in [('add_magnet', _add), ('get_torrent_info', _info),
                     ('select_files', _sel)]:
        monkeypatch.setattr(
            f'apps.integrations.realdebrid.RealDebridClient.{nome}', fn)
    monkeypatch.setattr(
        'apps.integrations.realdebrid.RealDebridClient.close', lambda self: _nada())


@pytest.mark.django_db
def test_o_monitor_nasce_segurando_o_lock(copia, usuario, rd_envio, monkeypatch):
    """
    Sem o lock_key, `check_realdebrid_status` não enxergava monitor nenhum e
    disparava um segundo em até cinco minutos — dois monitores na mesma
    release, cada um consultando o Real-Debrid a cada 30 segundos.
    """
    from django.core.cache import cache
    disparos = []
    monkeypatch.setattr(downloads.monitor_realdebrid_download, 'apply_async',
                        lambda *a, **kw: disparos.append(kw))

    downloads.add_to_realdebrid.push_request(retries=0)
    try:
        downloads.add_to_realdebrid.run(str(copia.id), str(usuario.id))
    finally:
        downloads.add_to_realdebrid.pop_request()

    chave = f'rd_monitor_lock_{copia.id}'
    assert len(disparos) == 1
    assert disparos[0]['kwargs']['lock_key'] == chave
    assert cache.get(chave) is not None, 'o check periódico dispararia um segundo'


@pytest.mark.django_db
def test_o_lock_criado_no_envio_bloqueia_o_check_periodico(copia, usuario,
                                                            rd_envio, monkeypatch):
    """A prova do que o lock serve: a mesma chamada que o check faz falha."""
    from django.core.cache import cache
    monkeypatch.setattr(downloads.monitor_realdebrid_download, 'apply_async',
                        lambda *a, **kw: None)

    downloads.add_to_realdebrid.push_request(retries=0)
    try:
        downloads.add_to_realdebrid.run(str(copia.id), str(usuario.id))
    finally:
        downloads.add_to_realdebrid.pop_request()

    # `cache.add` é o que check_realdebrid_status usa para decidir se dispara.
    assert cache.add(f'rd_monitor_lock_{copia.id}', '1', timeout=60) is False


@pytest.mark.django_db
def test_envio_para_release_apagada_nao_retenta(usuario, rd_envio, conta_retries_envio):
    import uuid

    downloads.add_to_realdebrid.push_request(retries=0)
    try:
        r = downloads.add_to_realdebrid.run(str(uuid.uuid4()), str(usuario.id))
    finally:
        downloads.add_to_realdebrid.pop_request()

    assert conta_retries_envio == []
    assert r['status'] == 'gone'


@pytest.fixture
def conta_retries_envio(monkeypatch):
    chamadas = []

    def falso(*args, **kwargs):
        chamadas.append(kwargs)
        raise Retry()

    monkeypatch.setattr(downloads.add_to_realdebrid, 'retry', falso)
    return chamadas
