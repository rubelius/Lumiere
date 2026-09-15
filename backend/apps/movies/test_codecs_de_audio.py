"""
O áudio é o que decide se a projeção vem muda, e o nome do release é onde ele
está escrito.

O DEFEITO: o parser não conhecia AC-3 nem Dolby Digital. MEDIDO no acervo — 200
das 1629 cópias declaram AC3, DD ou DDP no nome e saíam com `audio_codec`
VAZIO. Vazio vira "TALVEZ", e "talvez" o diálogo oferece em dourado, em
primeiro lugar, como "[ TOCAR SEM CONVERTER ]". Duzentas promessas de filme
mudo, sobre faixas que o projeto JÁ SABIA que não tocam: o dialeto do ffmpeg
listava 'ac3' desde sempre.

Duas listas que precisam andar juntas, divergindo — o formato que este projeto
mais repete. Por isso a guarda mais importante deste arquivo não é sobre AC-3:
é a que exige que todo codec reconhecido por qualquer dialeto exista na tabela
canônica.
"""

import pytest

from apps.movies.compatibilidade import (AUDIO_FFMPEG_QUE_NAO_TOCA,
                                         AUDIO_FFMPEG_QUE_TOCA,
                                         CANONICOS_QUE_NAO_TOCAM,
                                         CANONICOS_QUE_TOCAM,
                                         FFMPEG_PARA_CANONICO,
                                         o_que_converter_de_codecs)
from apps.movies.transcode import NADA, SO_AUDIO
from apps.movies.utils import parse_quality_from_title


def codec(titulo):
    return parse_quality_from_title(titulo)['audio_codec']


# ── o que faltava ─────────────────────────────────────────────────────────

@pytest.mark.parametrize('titulo', [
    'Filme 1980 1080p BluRay x264 AC3-GRUPO',
    'Filme 1980 1080p BluRay x264 AC-3',
    'The Wild Bunch 1969 BluRay 1080p DD 5 1 VC-1 REMUX-FraMeSToR',
    'Filme 1080p Dolby Digital 5.1',
])
def test_dolby_digital_deixa_de_sair_como_desconhecido(titulo):
    assert codec(titulo) == 'AC-3', f'{titulo!r} ainda vira "talvez"'


@pytest.mark.parametrize('titulo', [
    'Its a Wonderful Life 1946 UHD BluRay 1080p DDP 1 0 DoVi HDR10 x265',
    'Filme 1080p DDP5.1 x265',
    'Filme 1080p EAC3 5.1',
    'Filme 1080p E-AC-3',
    'Filme 1080p Dolby Digital Plus',
])
def test_dolby_digital_plus_nao_e_confundido_com_o_simples(titulo):
    """
    'DDP5.1' contém 'DD'. Testar o mais curto primeiro classificaria todo
    E-AC-3 como AC-3 — erro sem consequência prática hoje (nenhum dos dois
    toca), mas que mente sobre o arquivo e quebraria no dia em que um deles
    passar a tocar.
    """
    assert codec(titulo) == 'DD+'


def test_o_que_ja_funcionava_continua():
    assert codec('Filme 1080p DTS-HD MA 5.1') == 'DTS-HD MA'
    assert codec('Filme 2160p TrueHD Atmos') == 'Dolby Atmos'
    assert codec('Filme 1080p AAC 2.0') == 'AAC'
    assert codec('Filme 1080p DTS 5.1') == 'DTS'


def test_sem_audio_declarado_continua_sendo_desconhecido():
    """
    "Não sei" precisa continuar existindo: é diferente de "não toca", e uma
    cópia sem áudio no nome merece uma tentativa.
    """
    assert codec('Filme 1980 1080p BluRay x264-GRUPO') == ''


def test_flac_nao_vira_Flac():
    """
    `.title()` devolvia 'Flac', que não está na tabela canônica — e fora da
    tabela é "talvez" de novo. O mesmo defeito com outra roupa.
    """
    assert codec('Filme 1080p FLAC 2.0') == 'FLAC'
    assert codec('Filme 1080p MP3') == 'MP3'
    assert codec('Filme 1080p Opus') == 'Opus'


# ── a guarda que importa: os dialetos não podem divergir ──────────────────

def test_todo_codec_que_o_parser_produz_existe_na_tabela():
    """
    A guarda estrutural. Um codec reconhecido pelo nome e ausente da tabela
    canônica é exatamente o defeito original: ele some no julgamento e a cópia
    vira "talvez".
    """
    conhecidos = CANONICOS_QUE_TOCAM | CANONICOS_QUE_NAO_TOCAM
    titulos = [
        'Filme AC3', 'Filme DD 5 1', 'Filme DDP 5 1', 'Filme EAC3',
        'Filme DTS', 'Filme DTS-HD MA', 'Filme DTS-X', 'Filme TrueHD',
        'Filme Atmos', 'Filme AAC', 'Filme FLAC', 'Filme MP3', 'Filme Opus',
        'Filme LPCM', 'Filme Dolby Digital', 'Filme Dolby Digital Plus',
    ]
    fora = {t: codec(t) for t in titulos
            if codec(t) and codec(t) not in conhecidos}
    assert not fora, f'codecs produzidos e não julgáveis: {fora}'


def test_todo_nome_de_ffmpeg_traduz_para_um_canonico_conhecido():
    conhecidos = CANONICOS_QUE_TOCAM | CANONICOS_QUE_NAO_TOCAM
    fora = {n: c for n, c in FFMPEG_PARA_CANONICO.items() if c not in conhecidos}
    assert not fora, f'traduções para canônico inexistente: {fora}'


def test_nenhum_canonico_toca_e_nao_toca_ao_mesmo_tempo():
    assert not (CANONICOS_QUE_TOCAM & CANONICOS_QUE_NAO_TOCAM)


def test_os_dois_dialetos_dao_o_MESMO_veredito():
    """
    O coração do conserto. O mesmo áudio, dito nos dois vocabulários, não pode
    dar respostas diferentes — foi assim que AC-3 não tocava do lado do ffmpeg
    e era "talvez" do lado do nome de release.
    """
    from apps.movies.compatibilidade import compatibilidade_no_navegador, NAO_TOCA

    class Falsa:
        video_codec = 'HEVC'
        is_remux = False

        def __init__(self, audio):
            self.audio_codec = audio

    for ffmpeg, canonico in FFMPEG_PARA_CANONICO.items():
        pelo_ffmpeg = o_que_converter_de_codecs(ffmpeg, 'hevc')
        pelo_nome = compatibilidade_no_navegador(Falsa(canonico))
        assert (pelo_ffmpeg != NADA) == (pelo_nome == NAO_TOCA), (
            f'{ffmpeg!r} e {canonico!r} são o mesmo áudio e deram vereditos '
            f'diferentes: {pelo_ffmpeg} vs {pelo_nome}')


def test_ac3_agora_pede_conversao_pelos_dois_caminhos():
    assert o_que_converter_de_codecs('ac3', 'hevc') == SO_AUDIO
    assert 'ac3' in AUDIO_FFMPEG_QUE_NAO_TOCA
    assert 'aac' in AUDIO_FFMPEG_QUE_TOCA
    assert o_que_converter_de_codecs('aac', 'hevc') == NADA
