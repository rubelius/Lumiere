"""
Testes do monitoramento de downloads no Real-Debrid.

O que importa aqui é o lock: ele é o que impede a task periódica de acumular
monitores em cima da mesma release, e só o monitor o devolve. Um lock tomado
por um caminho que não dispara monitor fica preso até expirar.
"""

from unittest.mock import patch

import pytest
from django.core.cache import cache

from apps.movies.models import Movie, TorrentRelease
from apps.tasks.downloads import check_realdebrid_status


def release_baixando(titulo='X 1080p'):
    filme = Movie.objects.create(title=titulo, year=2000)
    return TorrentRelease.objects.create(
        movie=filme, title=titulo, info_hash=f'h{filme.id.hex[:12]}',
        size_bytes=1, in_realdebrid=True, realdebrid_status='downloading')


@pytest.fixture(autouse=True)
def limpa_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.mark.django_db
def test_release_fora_de_sessao_nao_prende_o_lock():
    """
    A maioria das releases não está em sessão nenhuma. Travar a chave delas
    por 26 minutos bloqueava as que passassem a estar dentro desse intervalo,
    e nada devolvia o lock, porque o monitor nunca era disparado.
    """
    release = release_baixando()

    with patch('apps.tasks.downloads.monitor_realdebrid_download.apply_async') as monitor:
        check_realdebrid_status()

    assert monitor.call_count == 0
    assert cache.get(f'rd_monitor_lock_{release.id}') is None, (
        'lock preso por uma release que nem chegou a ser monitorada')


@pytest.mark.django_db
def test_release_em_sessao_dispara_monitor_e_toma_o_lock():
    from django.utils import timezone
    from apps.user_sessions.models import CinemaSession, SessionMovie
    from django.contrib.auth import get_user_model

    user = get_user_model().objects.create_user(username='z', password='x')
    release = release_baixando()
    sessao = CinemaSession.objects.create(
        user=user, name='Noite', status='preparing',
        scheduled_date=timezone.now() + timezone.timedelta(days=1))
    SessionMovie.objects.create(
        session=sessao, movie=release.movie, order=1, selected_release=release)

    with patch('apps.tasks.downloads.monitor_realdebrid_download.apply_async') as monitor:
        check_realdebrid_status()

    assert monitor.call_count == 1
    assert cache.get(f'rd_monitor_lock_{release.id}') == '1'


@pytest.mark.django_db
def test_lock_ja_tomado_nao_dispara_um_segundo_monitor():
    from django.utils import timezone
    from apps.user_sessions.models import CinemaSession, SessionMovie
    from django.contrib.auth import get_user_model

    user = get_user_model().objects.create_user(username='w', password='x')
    release = release_baixando()
    sessao = CinemaSession.objects.create(
        user=user, name='Noite', status='preparing',
        scheduled_date=timezone.now() + timezone.timedelta(days=1))
    SessionMovie.objects.create(
        session=sessao, movie=release.movie, order=1, selected_release=release)
    cache.add(f'rd_monitor_lock_{release.id}', '1', timeout=60)

    with patch('apps.tasks.downloads.monitor_realdebrid_download.apply_async') as monitor:
        check_realdebrid_status()

    assert monitor.call_count == 0


@pytest.mark.django_db
def test_api_muda_nao_marca_o_download_como_falho():
    """
    `get_torrent_info` engole erro de HTTP e devolve {}. Seguir daqui gravava
    status=None num campo NOT NULL, o IntegrityError caía no except genérico,
    os retries se esgotavam e a release terminava marcada 'error' — um
    download possivelmente concluído, condenado por instabilidade de rede.
    """
    from apps.tasks.downloads import monitor_realdebrid_download

    release = release_baixando()
    release.realdebrid_id = 'rd123'
    release.realdebrid_progress = 90
    release.save(update_fields=['realdebrid_id', 'realdebrid_progress'])

    user = _usuario('monitor')

    with patch('apps.integrations.realdebrid.RealDebridClient.get_torrent_info',
               new=_devolve({})), \
         patch('apps.integrations.realdebrid.RealDebridClient.close', new=_nada()):
        r = monitor_realdebrid_download.apply(
            args=[str(release.id), str(user.id)], kwargs={'lock_key': 'k'}).get()

    release.refresh_from_db()
    assert r['status'] == 'unknown'
    assert release.realdebrid_status == 'downloading', 'estado real foi sobrescrito'
    assert release.realdebrid_progress == 90, 'progresso foi zerado'


def _usuario(nome):
    from django.contrib.auth import get_user_model
    return get_user_model().objects.create_user(
        username=nome, password='x', realdebrid_api_key='chave')


def _devolve(valor):
    async def falso(self, *a, **k):
        return valor
    return falso


def _nada():
    async def falso(self, *a, **k):
        return None
    return falso
