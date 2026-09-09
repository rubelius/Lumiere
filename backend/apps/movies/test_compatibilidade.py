"""
Testes da compatibilidade de uma cópia com o navegador.

Existe porque o algoritmo de qualidade e o player otimizam para coisas
opostas: a nota premia REMUX e faixa sem perdas, e é isso que o `<video>`
recusa. No acervo, a melhor cópia de "2001" faz 76 e não toca; a melhor que
toca faz 29.
"""

import pytest

from apps.movies.compatibilidade import (NAO_TOCA, TALVEZ, TOCA,
                                         compatibilidade_no_navegador,
                                         toca_no_navegador)
from apps.movies.models import TorrentRelease


def copia(**campos) -> TorrentRelease:
    campos.setdefault('size_bytes', 1)
    return TorrentRelease(**campos)


# ── o áudio é o que decide ────────────────────────────────────────────────

@pytest.mark.parametrize('faixa', ['DTS', 'DTS-HD MA', 'DTS:X', 'Dolby TrueHD',
                                   'Dolby Atmos', 'DD+'])
def test_faixa_que_o_navegador_nao_decodifica_derruba_a_copia(faixa):
    """
    Medido com `canPlayType`: nenhuma destas emite som. Foi exatamente o
    relato — imagem andando, silêncio.
    """
    assert compatibilidade_no_navegador(copia(audio_codec=faixa)) == NAO_TOCA


@pytest.mark.parametrize('faixa', ['AAC', 'FLAC', 'MP3', 'Opus'])
def test_faixa_confirmada_no_navegador_libera(faixa):
    assert compatibilidade_no_navegador(copia(audio_codec=faixa)) == TOCA


def test_o_declarado_vence_a_inferencia_do_remux():
    """
    Um remux que DIZ trazer AAC toca, por mais raro que seja. Inferir por cima
    do que o release afirma seria trocar informação por palpite.
    """
    assert compatibilidade_no_navegador(
        copia(is_remux=True, audio_codec='AAC')) == TOCA


# ── o silêncio dos 44 ─────────────────────────────────────────────────────

def test_remux_sem_audio_declarado_e_tratado_como_mudo():
    """
    Não é ignorância, é implicação: remux carrega as faixas ORIGINAIS do
    disco, e disco de cinema traz DTS-HD ou TrueHD. Chamar de "talvez" fingiria
    dúvida onde o formato já respondeu.
    """
    assert compatibilidade_no_navegador(copia(is_remux=True)) == NAO_TOCA


def test_sem_audio_e_sem_remux_e_talvez():
    """
    44 das 63 cópias do acervo não declaram áudio. Chutar para qualquer um dos
    lados seria afirmar o que não se sabe.
    """
    assert compatibilidade_no_navegador(copia(video_codec='HEVC')) == TALVEZ


def test_talvez_nao_engole_o_acervo_inteiro():
    """
    A categoria do meio é o que a tela oferece quando não há nenhum 'toca'.
    Enchê-la demais a torna inútil — e o remux é o que a esvazia.
    """
    assert compatibilidade_no_navegador(
        copia(is_remux=True, video_codec='HEVC')) != TALVEZ


# ── o vídeo, que quase nunca é o problema ─────────────────────────────────

@pytest.mark.parametrize('codec', ['AVC', 'HEVC', 'AV1', 'VP9'])
def test_video_medido_como_tocavel_nao_atrapalha(codec):
    """
    Medido com a string de codec COMPLETA: os quatro respondem "probably",
    tanto em MP4 quanto em Matroska. Com `codecs="hvc1"` truncado a resposta
    era "não", e foi assim que cheguei a concluir que o vídeo era o problema.
    """
    assert compatibilidade_no_navegador(
        copia(video_codec=codec, audio_codec='AAC')) == TOCA


def test_container_que_o_navegador_nao_abre_derruba_mesmo_com_audio_bom():
    assert compatibilidade_no_navegador(
        copia(video_codec='XviD', audio_codec='AAC')) == NAO_TOCA


# ── o atalho ──────────────────────────────────────────────────────────────

def test_o_atalho_so_aprova_o_certo():
    assert toca_no_navegador(copia(audio_codec='AAC')) is True
    assert toca_no_navegador(copia(audio_codec='DTS')) is False
    assert toca_no_navegador(copia()) is False, 'talvez não é toca'


# ── a ordem que o player e a sondagem usam ────────────────────────────────

@pytest.mark.django_db
def test_o_player_prefere_a_melhor_ENTRE_AS_QUE_TOCAM():
    """
    "Melhor" muda de sentido na hora de apertar play. Ordenar só pela nota
    mandava para o player o REMUX de 76 — imagem sem som. A melhor cópia que
    toca faz 29, e é ela que serve.
    """
    from apps.movies.playback import _por_utilidade

    remux = copia(quality_score=76, is_remux=True, audio_codec='DTS-HD MA')
    web = copia(quality_score=29, audio_codec='AAC')
    incerta = copia(quality_score=50)

    assert _por_utilidade([remux, incerta, web])[0] is web


@pytest.mark.django_db
def test_sem_nenhuma_que_toca_a_incerta_vem_antes_da_muda():
    from apps.movies.playback import _por_utilidade

    muda = copia(quality_score=76, is_remux=True)
    incerta = copia(quality_score=20)

    assert _por_utilidade([muda, incerta])[0] is incerta


@pytest.mark.django_db
def test_dentro_do_grupo_a_nota_ainda_manda():
    from apps.movies.playback import _por_utilidade

    boa = copia(quality_score=40, audio_codec='AAC')
    fraca = copia(quality_score=10, audio_codec='AAC')

    assert _por_utilidade([fraca, boa])[0] is boa


@pytest.mark.django_db
def test_a_sondagem_alcanca_as_que_tocam(django_user_model):
    """
    O ponto que o usuário levantou: sondar as 5 de maior nota respondia sobre
    cinco cópias que, tocando ou não, não iam para o player. As compatíveis
    vivem no fundo da lista — em "2001", 29 contra 76.
    """
    from apps.movies.models import Movie
    from apps.movies.realdebrid_cache import _em_ordem_de_utilidade

    filme = Movie.objects.create(title='2001', year=1968)
    for i in range(8):
        TorrentRelease.objects.create(
            movie=filme, title=f'remux {i}', info_hash=f'{i:040d}', size_bytes=1,
            magnet_link=f'magnet:?xt=urn:btih:{i:040d}', quality_score=70 + i,
            is_remux=True, audio_codec='DTS-HD MA')
    web = TorrentRelease.objects.create(
        movie=filme, title='web-dl', info_hash='f' * 40, size_bytes=1,
        magnet_link='magnet:?xt=urn:btih:' + 'f' * 40, quality_score=29,
        audio_codec='AAC')

    fila = _em_ordem_de_utilidade(filme, 5)

    assert fila[0] == web, 'a única que toca ficou fora das cinco primeiras'


def test_recusa_do_provedor_nao_e_indeterminado():
    """
    451 "Unavailable For Legal Reasons" é um não permanente: o Real-Debrid se
    recusa a servir aquele hash. Tratá-lo como "não sei" faria a sondagem
    tentar de novo a cada seis horas, para sempre.
    """
    from apps.movies.realdebrid_cache import INDETERMINADO, RECUSADO

    assert RECUSADO != INDETERMINADO
