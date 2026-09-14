"""
Tocar direto do torrent, pelo lado do Lumière.

A guarda que mais importa aqui não é técnica: tocar direto põe o IP da máquina
no enxame, visível a qualquer par. O Real-Debrid não faz isso — baixa em nome
do usuário e entrega por HTTP. Um clique distraído não pode expor a casa de
alguém.
"""

from unittest.mock import patch

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.integrations.torrent import (MotorDeTorrentIndisponivel,
                                       TorrentRecusado)
from apps.movies.models import Movie, TorrentRelease

MAGNET = 'magnet:?xt=urn:btih:' + 'a' * 40
NO_AR = {'info_hash': 'a' * 40, 'arquivo': 'filme.mkv', 'tamanho': 8_000_000_000,
         'pares': 12, 'progresso': 0.01, 'pronto': True, 'erro': None}


@pytest.fixture
def filme(db):
    return Movie.objects.create(title='Filme', year=2000)


@pytest.fixture
def copia(filme):
    return TorrentRelease.objects.create(
        movie=filme, title='Filme.2000.1080p', info_hash='a' * 40,
        size_bytes=8_000_000_000, magnet_link=MAGNET)


def cliente_de(django_user_model, **campos):
    user = django_user_model.objects.create_user(
        username=f'u{django_user_model.objects.count()}', password='x', **campos)
    api = APIClient()
    api.force_authenticate(user=user)
    return api


def toca(api, filme, release_id):
    return api.post(reverse('movie-tocar-do-torrent', args=[filme.pk]),
                    {'release': str(release_id)}, format='json')


# ── o consentimento ───────────────────────────────────────────────────────

@pytest.mark.django_db
def test_desligado_por_padrao_o_pedido_e_recusado(filme, copia, django_user_model):
    """
    O padrão é desligado, e recusar aqui é o que impede um clique distraído de
    pôr o IP de alguém no enxame.
    """
    api = cliente_de(django_user_model)

    with patch('apps.movies.views.poe_no_ar') as motor:
        resposta = toca(api, filme, copia.id)

    assert resposta.status_code == 403
    assert motor.call_count == 0, 'falou com o motor antes de ter permissão'
    assert 'Configurações' in resposta.data['detail']


@pytest.mark.django_db
def test_com_permissao_o_torrent_vai_ao_ar(filme, copia, django_user_model):
    api = cliente_de(django_user_model, torrent_direto_permitido=True)

    with patch('apps.movies.views.poe_no_ar', return_value=NO_AR) as motor:
        resposta = toca(api, filme, copia.id)

    assert resposta.status_code == 200
    assert motor.call_args.args[0] == MAGNET
    assert resposta.data['stream_url'] == f'/api/torrent/{"a" * 40}/stream'
    assert resposta.data['release_id'] == str(copia.id)


@pytest.mark.django_db
def test_a_cota_do_usuario_chega_ao_motor(filme, copia, django_user_model):
    """
    O número é do usuário, não do serviço: quem escolheu quanto disco ceder foi
    ele, na tela de configurações.
    """
    api = cliente_de(django_user_model, torrent_direto_permitido=True,
                     torrent_cache_bytes=3 * 1024 ** 3)

    with patch('apps.movies.views.poe_no_ar', return_value=NO_AR) as motor:
        toca(api, filme, copia.id)

    assert motor.call_args.args[1] == 3 * 1024 ** 3


@pytest.mark.django_db
def test_cota_zero_chega_como_zero_e_nao_some(filme, copia, django_user_model):
    """Zero é "ilimitado", e é uma escolha — não a ausência de uma."""
    api = cliente_de(django_user_model, torrent_direto_permitido=True,
                     torrent_cache_bytes=0)

    with patch('apps.movies.views.poe_no_ar', return_value=NO_AR) as motor:
        toca(api, filme, copia.id)

    assert motor.call_args.args[1] == 0


# ── o que não dá para tocar ───────────────────────────────────────────────

@pytest.mark.django_db
def test_copia_sem_magnet_e_recusada_com_a_razao(filme, django_user_model):
    """
    As cópias vindas da sincronização com o Real-Debrid nascem sem magnet. Não
    há o que entregar ao motor, e dizer isso é melhor que um erro genérico.
    """
    sem_magnet = TorrentRelease.objects.create(
        movie=filme, title='Filme.mkv', info_hash='b' * 40,
        size_bytes=1, magnet_link='')
    api = cliente_de(django_user_model, torrent_direto_permitido=True)

    with patch('apps.movies.views.poe_no_ar') as motor:
        resposta = toca(api, filme, sem_magnet.id)

    assert resposta.status_code == 400
    assert 'magnet' in resposta.data['detail'].lower()
    assert motor.call_count == 0


@pytest.mark.django_db
def test_cópia_inexistente_nao_vira_erro_de_servidor(filme, django_user_model):
    api = cliente_de(django_user_model, torrent_direto_permitido=True)
    resposta = toca(api, filme, '00000000-0000-0000-0000-000000000000')
    assert resposta.status_code == 404


@pytest.mark.django_db
def test_a_razao_da_recusa_do_motor_chega_inteira_a_tela(filme, copia, django_user_model):
    """
    "Esta cópia tem 65 GB e o limite é 6 GB" é acionável; "erro ao iniciar" não
    é. A frase vem pronta do motor e não pode ser trocada por uma genérica.
    """
    api = cliente_de(django_user_model, torrent_direto_permitido=True)
    razao = 'Esta cópia tem 65.0 GB e o limite de disco é 6 GB.'

    with patch('apps.movies.views.poe_no_ar', side_effect=TorrentRecusado(razao)):
        resposta = toca(api, filme, copia.id)

    assert resposta.status_code == 409
    assert resposta.data['detail'] == razao


@pytest.mark.django_db
def test_motor_fora_do_ar_e_diferente_de_torrent_ruim(filme, copia, django_user_model):
    """
    503 e 409 dizem coisas diferentes: um é "o Lumière está incompleto", o
    outro é "escolha outra cópia". Tratá-los igual manda a pessoa tentar de
    novo a mesma coisa.
    """
    api = cliente_de(django_user_model, torrent_direto_permitido=True)

    with patch('apps.movies.views.poe_no_ar',
               side_effect=MotorDeTorrentIndisponivel('sem resposta')):
        resposta = toca(api, filme, copia.id)

    assert resposta.status_code == 503


@pytest.mark.django_db
def test_precisa_estar_autenticado(filme, copia):
    resposta = APIClient().post(
        reverse('movie-tocar-do-torrent', args=[filme.pk]), {'release': str(copia.id)})
    assert resposta.status_code in (401, 403)


# ── tentar mais de uma cópia ──────────────────────────────────────────────
# O número de semeadores do indexador é uma AFIRMAÇÃO, não uma medida. Medido
# em Pulp Fiction: a cópia que ele dizia ter 104 ficou 30 segundos sem um par,
# e outra do mesmo filme respondeu em 8,5 segundos. Desistir na primeira é
# desistir do filme por causa de um número que já mentiu.

def copia_de(filme, *, nota, semeadores, letra, tamanho=2_000_000_000):
    return TorrentRelease.objects.create(
        movie=filme, title=f'Filme.{nota}p.AAC', info_hash=letra * 40,
        size_bytes=tamanho, magnet_link='magnet:?xt=urn:btih:' + letra * 40,
        quality_score=nota, seeders=semeadores, audio_codec='AAC',
        resolution='1080p')


@pytest.mark.django_db
def test_cópia_sem_semeadores_nao_faz_o_filme_inteiro_desistir(filme, django_user_model):
    """A primeira falhou; a segunda toca. O filme não acabou."""
    morta = copia_de(filme, nota=30, semeadores=104, letra='c')
    viva = copia_de(filme, nota=20, semeadores=1348, letra='d')
    api = cliente_de(django_user_model, torrent_direto_permitido=True)

    tentadas = []

    def motor(magnet, cota):
        tentadas.append(magnet)
        if magnet == morta.magnet_link:
            raise TorrentRecusado('Nenhum semeador respondeu.')
        return {**NO_AR, 'info_hash': viva.info_hash}

    with patch('apps.movies.views.poe_no_ar', side_effect=motor):
        resposta = toca(api, filme, morta.id)

    assert resposta.status_code == 200, 'desistiu na primeira recusa'
    assert len(tentadas) == 2, f'tentou {len(tentadas)} cópia(s)'
    assert resposta.data['release_id'] == str(viva.id)


@pytest.mark.django_db
def test_a_cópia_pedida_e_sempre_a_primeira_tentativa(filme, django_user_model):
    """
    Quem clicou viu uma cópia descrita na tela. Tentar outra antes dela seria
    tocar algo diferente do que foi oferecido, sem dizer.
    """
    fraca = copia_de(filme, nota=5, semeadores=2, letra='e')
    copia_de(filme, nota=99, semeadores=9999, letra='f')
    api = cliente_de(django_user_model, torrent_direto_permitido=True)

    with patch('apps.movies.views.poe_no_ar', return_value=NO_AR) as motor:
        toca(api, filme, fraca.id)

    assert motor.call_args_list[0].args[0] == fraca.magnet_link


@pytest.mark.django_db
def test_cópias_sem_semeador_nenhum_nao_entram_na_fila(filme, django_user_model):
    """Zero é a única afirmação do indexador que não vale os 30 segundos."""
    pedida = copia_de(filme, nota=30, semeadores=5, letra='g')
    copia_de(filme, nota=40, semeadores=0, letra='h')
    api = cliente_de(django_user_model, torrent_direto_permitido=True)

    with patch('apps.movies.views.poe_no_ar',
               side_effect=TorrentRecusado('sem ninguém')) as motor:
        resposta = toca(api, filme, pedida.id)

    assert resposta.status_code == 409
    assert motor.call_count == 1, 'gastou 30s numa cópia que ninguém semeia'


@pytest.mark.django_db
def test_a_espera_tem_fim(filme, django_user_model):
    """
    Dez cópias vivas seriam cinco minutos de "procurando semeadores". Uma tela
    que nunca responde é pior que uma que diz não.
    """
    pedida = copia_de(filme, nota=50, semeadores=10, letra='i')
    for n, letra in enumerate('jklmnopq'):
        copia_de(filme, nota=40 - n, semeadores=10, letra=letra)
    api = cliente_de(django_user_model, torrent_direto_permitido=True)

    with patch('apps.movies.views.poe_no_ar',
               side_effect=TorrentRecusado('nada')) as motor:
        toca(api, filme, pedida.id)

    assert motor.call_count <= 3, f'tentou {motor.call_count} vezes'


@pytest.mark.django_db
def test_motor_fora_do_ar_nao_vira_uma_fila_de_esperas(filme, django_user_model):
    """
    503 não é "esta cópia não serve": é "o Lumière está incompleto". Tentar a
    seguinte é esperar o mesmo silêncio de novo.
    """
    pedida = copia_de(filme, nota=30, semeadores=10, letra='r')
    copia_de(filme, nota=20, semeadores=10, letra='s')
    api = cliente_de(django_user_model, torrent_direto_permitido=True)

    with patch('apps.movies.views.poe_no_ar',
               side_effect=MotorDeTorrentIndisponivel('sem resposta')) as motor:
        resposta = toca(api, filme, pedida.id)

    assert resposta.status_code == 503
    assert motor.call_count == 1


@pytest.mark.django_db
def test_a_tela_fica_sabendo_que_foi_mais_de_uma(filme, django_user_model):
    """Sem isso a pessoa escolhe a mesma cópia de novo, achando que teve azar."""
    pedida = copia_de(filme, nota=30, semeadores=10, letra='t')
    copia_de(filme, nota=20, semeadores=10, letra='u')
    api = cliente_de(django_user_model, torrent_direto_permitido=True)

    with patch('apps.movies.views.poe_no_ar',
               side_effect=TorrentRecusado('Nenhum semeador respondeu.')):
        resposta = toca(api, filme, pedida.id)

    assert 'Tentei 2 cópias' in resposta.data['detail']
    assert 'Nenhum semeador respondeu.' in resposta.data['detail']
