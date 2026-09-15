"""
Jellyfin e Plex passam pela mesma pergunta que o Real-Debrid.

O DEFEITO: `precisa_converter` só era calculado no caminho do Real-Debrid, onde
existe um `TorrentRelease` com codecs lidos do nome. As bibliotecas locais
devolviam a fonte com o padrão `NADA` e o rótulo fixo "JELLYFIN DIRECT" — e um
arquivo com DTS tocava imagem sem som, sob um rótulo que prometia reprodução
direta.

É a forma que este projeto mais repete: uma pergunta que só existe num dos
caminhos, e uma tela afirmando o que não é verdade no outro.

Sem servidor Jellyfin ou Plex nesta instalação, os testes exercitam as FORMAS
REAIS das duas APIs — `MediaSources[].MediaStreams[]` com `Type`/`Codec` no
Jellyfin, `Media@audioCodec`/`@videoCodec` por Part no Plex.
"""

from unittest.mock import AsyncMock, patch

import pytest

from apps.movies.compatibilidade import (audio_principal,
                                         o_que_converter_de_codecs)
from apps.movies.models import Movie
from apps.movies.playback import _from_jellyfin, _from_plex
from apps.movies.transcode import NADA, SO_AUDIO, TUDO


# ── o julgamento por codec de arquivo ─────────────────────────────────────

@pytest.mark.parametrize('audio,video,esperado', [
    # O caso do relato: REMUX com DTS. Toca a imagem e não emite som.
    ('dts', 'hevc', SO_AUDIO),
    ('truehd', 'hevc', SO_AUDIO),
    ('eac3', 'h264', SO_AUDIO),
    ('ac3', 'h264', SO_AUDIO),
    # O que o navegador aceita não custa nada.
    ('aac', 'h264', NADA),
    ('flac', 'av1', NADA),
    ('opus', 'vp9', NADA),
    # Vídeo exótico obriga a recodificar tudo, e isso come a máquina.
    ('aac', 'mpeg4', TUDO),
    ('dts', 'mpeg2video', TUDO),
])
def test_o_codec_decide_quanto_trabalho(audio, video, esperado):
    assert o_que_converter_de_codecs(audio, video) == esperado


def test_desconhecido_nao_vira_conversao():
    """
    Converter por precaução gastaria CPU em toda biblioteca que não declara
    codec, e errar para este lado tem volta: tenta direto, e se vier mudo a
    pessoa tem o player externo ao lado. Converter à toa não tem — ela espera
    o ffmpeg para assistir algo que tocaria sozinho.
    """
    assert o_que_converter_de_codecs('', '') == NADA
    assert o_que_converter_de_codecs(None, None) == NADA


def test_maiusculas_do_servidor_nao_escapam():
    """O Plex devolve 'DTS' e 'HEVC'; o Jellyfin, 'dts'. Os dois são o mesmo."""
    assert o_que_converter_de_codecs('DTS', 'HEVC') == SO_AUDIO
    assert o_que_converter_de_codecs('  AAC  ', 'H264') == NADA


# ── qual faixa é a que toca ───────────────────────────────────────────────

def test_a_faixa_que_vale_e_a_marcada_como_padrao():
    """
    Um .mkv com DTS em inglês e AAC em português é comum. Perguntar "existe
    alguma faixa boa?" responde a pergunta errada: o navegador toca a marcada
    como padrão, e se ela for DTS o filme vem mudo com um AAC intacto ao lado.
    """
    faixas = [
        {'Type': 'Video', 'Codec': 'hevc'},
        {'Type': 'Audio', 'Codec': 'aac', 'IsDefault': False},
        {'Type': 'Audio', 'Codec': 'dts', 'IsDefault': True},
    ]
    assert audio_principal(faixas) == 'dts'
    assert o_que_converter_de_codecs(audio_principal(faixas), 'hevc') == SO_AUDIO


def test_sem_marca_de_padrao_vale_a_primeira():
    faixas = [{'Type': 'Audio', 'Codec': 'dts'}, {'Type': 'Audio', 'Codec': 'aac'}]
    assert audio_principal(faixas) == 'dts'


def test_fluxos_de_video_e_legenda_nao_contam_como_audio():
    faixas = [
        {'Type': 'Video', 'Codec': 'hevc'},
        {'Type': 'Subtitle', 'Codec': 'subrip'},
        {'Type': 'Audio', 'Codec': 'aac'},
    ]
    assert audio_principal(faixas) == 'aac'


def test_arquivo_sem_audio_nenhum_nao_quebra():
    assert audio_principal([{'Type': 'Video', 'Codec': 'hevc'}]) == ''
    assert audio_principal([]) == ''
    assert audio_principal(None) == ''


# ── o caminho inteiro, com a forma real das APIs ──────────────────────────

@pytest.fixture
def filme(db):
    return Movie.objects.create(title='Filme', year=2000)


class UsuarioFalso:
    jellyfin_server_url = 'http://casa:8096'
    jellyfin_token = 'k'
    jellyfin_user_id = 'u'
    plex_server_url = 'http://casa:32400'
    plex_token = 't'


def item_do_jellyfin(codec_de_audio, codec_de_video='hevc'):
    """A forma que o Jellyfin devolve com `Fields=MediaSources`."""
    return {
        'id': 'abc123', 'name': 'Filme', 'year': 2000, 'container': 'mkv',
        'size_bytes': 30_000_000_000,
        'video_codec': codec_de_video,
        'faixas': [
            {'Type': 'Video', 'Codec': codec_de_video, 'Index': 0},
            {'Type': 'Audio', 'Codec': codec_de_audio, 'Index': 1, 'IsDefault': True},
        ],
    }


@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
async def test_jellyfin_com_dts_deixa_de_prometer_reproducao_direta(filme):
    """O relato exato: 'JELLYFIN DIRECT' sobre um arquivo que vai tocar mudo."""
    cliente = AsyncMock()
    cliente.search_movie.return_value = item_do_jellyfin('dts')
    cliente.build_stream_url = lambda i: f'http://casa:8096/Items/{i}/stream'

    with patch('apps.movies.playback.JellyfinClient', return_value=cliente), \
         patch('apps.movies.playback.sonda_o_arquivo',
               return_value={'duracao': 9270.0, 'faixas': [{'posicao': 0, 'codec': 'dts'}]}):
        fonte = await _from_jellyfin(filme, UsuarioFalso())

    assert fonte.precisa_converter == SO_AUDIO, 'seguiria tocando mudo'
    assert 'DIRECT' not in fonte.label, f'rótulo ainda promete direto: {fonte.label}'
    assert 'JELLYFIN' in fonte.label, 'a origem sumiu do rótulo'
    # Sem duração o conversor não sabe validar um salto: o MP4 fragmentado
    # declara só o que já chegou.
    assert fonte.duracao_segundos == 9270.0


@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
async def test_jellyfin_com_aac_nao_paga_sondagem(filme):
    """
    O caminho comum não pode ficar mais caro: sem conversão, o navegador lê a
    duração sozinho e o ffprobe seriam segundos jogados fora em cada play.
    """
    cliente = AsyncMock()
    cliente.search_movie.return_value = item_do_jellyfin('aac')
    cliente.build_stream_url = lambda i: f'http://casa:8096/Items/{i}/stream'

    with patch('apps.movies.playback.JellyfinClient', return_value=cliente), \
         patch('apps.movies.playback.sonda_o_arquivo') as sonda:
        fonte = await _from_jellyfin(filme, UsuarioFalso())

    assert fonte.precisa_converter == NADA
    assert sonda.call_count == 0, 'sondou sem precisar'
    assert fonte.label == 'JELLYFIN'


@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
async def test_sondagem_que_falha_nao_cancela_o_filme(filme):
    """
    Sem duração o player ainda toca — só não salta com precisão. Desistir aqui
    trocaria um filme com ressalva por filme nenhum.
    """
    cliente = AsyncMock()
    cliente.search_movie.return_value = item_do_jellyfin('dts')
    cliente.build_stream_url = lambda i: 'http://casa:8096/x'

    with patch('apps.movies.playback.JellyfinClient', return_value=cliente), \
         patch('apps.movies.playback.sonda_o_arquivo', side_effect=OSError('ffprobe sumiu')):
        fonte = await _from_jellyfin(filme, UsuarioFalso())

    assert fonte is not None, 'perdeu o filme por causa da sondagem'
    assert fonte.precisa_converter == SO_AUDIO
    assert fonte.duracao_segundos is None


@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
async def test_plex_com_dts_tambem_passa_pela_pergunta(filme):
    """O Plex já devolvia os codecs por Part; eram descartados."""
    cliente = AsyncMock()
    cliente.search_movie.return_value = [{'rating_key': '42'}]
    cliente.get_movie_metadata.return_value = {
        'parts': [{'key': '/library/parts/1/file.mkv', 'container': 'mkv',
                   'audio_codec': 'dca', 'video_codec': 'hevc'}],
    }

    with patch('apps.movies.playback.PlexClient', return_value=cliente), \
         patch('apps.movies.playback.sonda_o_arquivo',
               return_value={'duracao': 100.0, 'faixas': []}):
        fonte = await _from_plex(filme, UsuarioFalso())

    assert fonte.precisa_converter == SO_AUDIO
    assert 'DIRECT' not in fonte.label
    assert 'PLEX' in fonte.label


@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
async def test_plex_le_a_part_que_vai_tocar(filme):
    """
    Com mais de uma Part, os codecs precisam vir da que virou URL. Ler sempre
    a primeira julga um arquivo e toca outro.
    """
    cliente = AsyncMock()
    cliente.search_movie.return_value = [{'rating_key': '42'}]
    cliente.get_movie_metadata.return_value = {
        'parts': [
            {'key': None, 'container': 'avi', 'audio_codec': 'dts', 'video_codec': 'mpeg4'},
            {'key': '/library/parts/2/f.mkv', 'container': 'mkv',
             'audio_codec': 'aac', 'video_codec': 'hevc'},
        ],
    }

    with patch('apps.movies.playback.PlexClient', return_value=cliente), \
         patch('apps.movies.playback.sonda_o_arquivo') as sonda:
        fonte = await _from_plex(filme, UsuarioFalso())

    assert '/library/parts/2/' in fonte.stream_url
    assert fonte.precisa_converter == NADA, 'julgou a Part que não vai tocar'
    assert sonda.call_count == 0
