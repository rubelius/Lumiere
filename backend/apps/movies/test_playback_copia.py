"""
Testes da escolha de cópia na hora de tocar.

O defeito de origem: o player respondia "nenhuma fonte disponível" enquanto a
tela mostrava cinco cópias com disponibilidade imediata. O resolvedor exigia
`realdebrid_links`, e uma cópia que está no ACERVO do Real-Debrid mas não na
CONTA não tem link nenhum — são coisas diferentes, e só a segunda impedia tocar.
"""

import pytest
from asgiref.sync import async_to_sync

from apps.movies import playback
from apps.movies.models import Movie, TorrentRelease


@pytest.fixture
def usuario(db, django_user_model):
    return django_user_model.objects.create_user(
        username='cinefilo', password='x', realdebrid_api_key='chave')


@pytest.fixture
def filme(db):
    return Movie.objects.create(title='2001', year=1968)


def copia(filme, nota, **campos):
    campos.setdefault('magnet_link', f'magnet:?xt=urn:btih:{nota:040d}')
    return TorrentRelease.objects.create(
        movie=filme, title=f'copia {nota}', info_hash=f'{nota:040d}',
        size_bytes=1, quality_score=nota, **campos)


@pytest.fixture
def rd(monkeypatch):
    """Dublê do Real-Debrid, com o cenário controlável."""
    def instala(cacheado=True):
        registro = {'adicionados': [], 'apagados': []}

        class RDFalso:
            def __init__(self, chave):
                pass

            async def add_magnet(self, magnet):
                registro['adicionados'].append(magnet)
                return f'T{len(registro["adicionados"])}'

            async def get_torrent_info(self, tid):
                if cacheado:
                    return {'status': 'downloaded', 'files': [{'id': 1, 'bytes': 9}],
                            'links': ['rd://pronto']}
                return {'status': 'downloading', 'files': [{'id': 1, 'bytes': 9}],
                        'links': []}

            async def select_files(self, tid, ids):
                return True

            async def delete_torrent(self, tid):
                registro['apagados'].append(tid)
                return True

            async def unrestrict_link(self, link):
                return {'download': 'https://rd/stream.mkv', 'filename': 'x.mkv'}

            async def close(self):
                pass

        monkeypatch.setattr(playback, 'RealDebridClient', RDFalso)
        return registro
    return instala


@pytest.mark.django_db
def test_toca_a_melhor_imediata_mesmo_sem_link(filme, usuario, rd):
    """
    O caso exato da queixa: cinco cópias com disponibilidade imediata, nenhuma
    na conta, e o player dizendo que não havia fonte.
    """
    rd(cacheado=True)
    copia(filme, 40, instantly_available=True)
    melhor = copia(filme, 90, instantly_available=True)

    fonte = async_to_sync(playback.resolve_playback)(filme, usuario)

    assert fonte is not None, 'o player continuaria dizendo "nenhuma fonte"'
    assert fonte.release_id == str(melhor.id), 'importou uma cópia pior'
    assert fonte.stream_url


@pytest.mark.django_db
def test_quem_ja_tem_link_nao_e_reimportada(filme, usuario, rd):
    registro = rd(cacheado=True)
    pronta = copia(filme, 50, in_realdebrid=True, realdebrid_status='downloaded',
                   realdebrid_links=['rd://ja'])
    copia(filme, 90, instantly_available=True)

    fonte = async_to_sync(playback.resolve_playback)(filme, usuario)

    assert fonte.release_id == str(pronta.id)
    assert registro['adicionados'] == [], 'importou algo que já estava pronto'


@pytest.mark.django_db
def test_a_tela_pode_apontar_a_copia(filme, usuario, rd):
    """
    O selo de disponibilidade imediata é um botão, e ele precisa tocar AQUELA
    cópia — não a de maior nota.
    """
    rd(cacheado=True)
    copia(filme, 90, instantly_available=True)
    escolhida = copia(filme, 30, instantly_available=True)

    fonte = async_to_sync(playback.resolve_playback)(
        filme, usuario, release_id=str(escolhida.id))

    assert fonte.release_id == str(escolhida.id)


@pytest.mark.django_db
def test_copia_que_nao_estava_cacheada_e_removida_da_conta(filme, usuario, rd):
    """
    Sondar dentro de um clique de play não pode virar download que ninguém
    pediu: se o Real-Debrid não devolve `downloaded`, o torrent sai.
    """
    registro = rd(cacheado=False)
    copia(filme, 90, instantly_available=True)

    fonte = async_to_sync(playback.resolve_playback)(filme, usuario)

    assert fonte is None
    assert registro['apagados'], 'ficou um download começado na conta do usuário'


@pytest.mark.django_db
def test_sem_copia_imediata_nao_ha_fonte(filme, usuario, rd):
    """
    E aqui a tela tem que oferecer a escolha — baixar antes, ou tocar direto —
    em vez de levar ao player e falhar lá.
    """
    rd(cacheado=True)
    copia(filme, 90)  # nem na conta, nem no acervo

    assert async_to_sync(playback.resolve_playback)(filme, usuario) is None


@pytest.mark.django_db
def test_copia_apontada_que_nao_existe_nao_cai_para_outra(filme, usuario, rd):
    """
    Pedir uma cópia e receber outra seria pior que receber erro: a pessoa
    escolheu por um motivo.
    """
    import uuid

    rd(cacheado=True)
    copia(filme, 90, instantly_available=True)

    assert async_to_sync(playback.resolve_playback)(
        filme, usuario, release_id=str(uuid.uuid4())) is None
