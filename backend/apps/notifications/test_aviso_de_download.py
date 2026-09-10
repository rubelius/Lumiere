"""
O aviso de que uma cópia terminou de baixar.

Este app existia inteiro e desligado: modelo, serviço, consumer e viewset
escritos, migrados, e nada chamando nada. Ligá-lo revelou dois defeitos que
ninguém tinha como notar — o texto em inglês numa tela em português, e um
`action_url` apontando para `/movies/`, que não é rota do cliente.
"""

from unittest.mock import AsyncMock, patch

import pytest
from django.contrib.auth import get_user_model

from apps.movies.models import Movie, TorrentRelease
from apps.notifications.models import Notification
from apps.notifications.service import NotificationService
from apps.tasks.downloads import _avisa_que_ficou_pronto


@pytest.fixture
def dono(db):
    return get_user_model().objects.create_user(username='dono', password='x')


@pytest.fixture
def copia(db):
    filme = Movie.objects.create(title='O Sétimo Selo', year=1957)
    return TorrentRelease.objects.create(
        movie=filme, title='O.Setimo.Selo.1957.1080p', info_hash='a' * 40,
        size_bytes=1, in_realdebrid=True, realdebrid_status='downloaded')


def test_o_aviso_chega_a_quem_pediu(dono, copia):
    with patch.object(NotificationService, '_send_websocket'):
        _avisa_que_ficou_pronto(dono, copia)

    aviso = Notification.objects.get(user=dono)
    assert aviso.type == 'download_complete'
    assert copia.movie.title in aviso.message
    assert not aviso.read


def test_o_aviso_leva_a_uma_rota_que_existe(dono, copia):
    """
    Estava `/movies/{id}`. A rota do cliente é `/movie/{id}`, no singular —
    o aviso levaria a um 404 no primeiro clique, e ninguém tinha reparado
    porque nada chamava este método.
    """
    with patch.object(NotificationService, '_send_websocket'):
        NotificationService.notify_download_complete(dono, copia.movie)

    aviso = Notification.objects.get(user=dono)
    assert aviso.action_url == f'/movie/{copia.movie.id}'
    assert not aviso.action_url.startswith('/movies/')


def test_o_aviso_fala_a_lingua_da_tela(dono, copia):
    with patch.object(NotificationService, '_send_websocket'):
        NotificationService.notify_download_complete(dono, copia.movie)

    aviso = Notification.objects.get(user=dono)
    assert aviso.title == 'Cópia pronta'
    assert aviso.action_text == 'Assistir'
    assert 'Download Complete' not in aviso.title


def test_o_aviso_sai_pelo_canal_do_usuario(dono, copia):
    """
    O grupo é derivado do id de quem recebe. Sem isso o aviso de um usuário
    apareceria na tela de outro.
    """
    # Duas sutilezas: `get_channel_layer` é importado DENTRO do método, então
    # quem se substitui é o original em channels.layers; e `group_send` é
    # aguardado por `async_to_sync`, então precisa ser assíncrono — um
    # MagicMock comum estoura com "can't be used in 'await' expression".
    with patch('channels.layers.get_channel_layer') as camada:
        camada.return_value.group_send = AsyncMock()
        NotificationService.notify_download_complete(dono, copia.movie)

    chamada = camada.return_value.group_send.call_args
    assert chamada is not None, 'nada foi transmitido'
    grupo, mensagem = chamada.args
    assert grupo == f'notifications_{dono.id}'
    assert mensagem['type'] == 'notification_message'
    assert mensagem['notification']['type'] == 'download_complete'


def test_falhar_o_aviso_nao_derruba_o_download(dono, copia):
    """
    Perder o aviso é ruim; perder a conclusão do download é pior.

    Uma exceção aqui subiria pelo monitor e faria o Celery repetir a task
    inteira — refazendo as chamadas ao Real-Debrid de um download que já
    terminou.
    """
    with patch.object(NotificationService, 'notify_download_complete',
                      side_effect=RuntimeError('canal fora do ar')):
        _avisa_que_ficou_pronto(dono, copia)   # não levanta

    assert Notification.objects.count() == 0


def test_o_aviso_de_sessao_diz_de_qual_sessao(dono, copia):
    from django.utils import timezone

    from apps.user_sessions.models import CinemaSession

    sessao = CinemaSession.objects.create(
        user=dono, name='Noite de Bergman', status='preparing',
        scheduled_date=timezone.now() + timezone.timedelta(days=1))

    with patch.object(NotificationService, '_send_websocket'):
        NotificationService.notify_download_complete(dono, copia.movie, sessao)

    aviso = Notification.objects.get(user=dono)
    assert 'Noite de Bergman' in aviso.message
    assert aviso.related_session_id == sessao.id


def test_nao_pede_push(dono, copia):
    """
    `_send_push` tem todo o código do Firebase comentado e apenas marca
    `sent_push=True`. Pedir push é gravar que se enviou algo que não foi.

    A asserção olha o PEDIDO e não o efeito de propósito: hoje as preferências
    do usuário filtram o envio, então `sent_push` continuaria False mesmo com
    `send_push=True` — a guarda passaria sem guardar nada. Verificado por
    mutação.
    """
    with patch.object(NotificationService, 'create_notification') as cria:
        NotificationService.notify_download_complete(dono, copia.movie)

    assert cria.call_args.kwargs['send_push'] is False
    assert cria.call_args.kwargs['send_email'] is False
