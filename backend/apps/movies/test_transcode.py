"""
Testes da conversão sob demanda.

O que se trava aqui é sobretudo a forma do fluxo, e não o conteúdo: a primeira
versão usava um gerador SÍNCRONO dentro de StreamingHttpResponse e, sob ASGI,
isso não atrasou a resposta — travou o servidor inteiro. Todos os endpoints
passaram a responder nada, e o log dizia "Application instance took too long to
shut down and was killed".
"""

import inspect
import os
import subprocess
import signal

import pytest

from apps.movies.models import Movie, TorrentRelease
from apps.movies import transcode
from apps.movies.transcode import NADA, SO_AUDIO, TUDO, comando, o_que_transcodificar


def copia(**campos) -> TorrentRelease:
    campos.setdefault('size_bytes', 1)
    return TorrentRelease(**campos)


# ── quanto trabalho cada cópia dá ─────────────────────────────────────────

def test_o_que_toca_nao_e_convertido():
    assert o_que_transcodificar(copia(audio_codec='AAC')) == NADA


def test_faixa_que_o_navegador_nao_abre_pede_so_o_audio():
    """
    O achado que dimensiona o módulo: H.264, HEVC, AV1 e VP9 tocam no
    navegador. Só o áudio falha, então o vídeo é COPIADO — 4x a velocidade da
    reprodução a 15% de CPU, medido contra um REMUX HEVC + DTS 5.1.
    """
    assert o_que_transcodificar(
        copia(audio_codec='DTS-HD MA', video_codec='HEVC')) == SO_AUDIO


def test_video_exotico_pede_tudo():
    assert o_que_transcodificar(
        copia(audio_codec='DTS', video_codec='XviD')) == TUDO


def test_video_desconhecido_nao_manda_recodificar_por_precaucao():
    """
    O campo vem vazio em 25 das 63 cópias. Recodificar por via das dúvidas
    custaria o codificador de hardware em todas elas, e o problema real — o
    áudio — já teria sido resolvido de qualquer forma.
    """
    assert o_que_transcodificar(copia(is_remux=True)) == SO_AUDIO


# ── o comando ─────────────────────────────────────────────────────────────

def test_o_video_e_copiado_quando_so_o_audio_atrapalha():
    c = comando('http://x/f.mkv', escopo=SO_AUDIO)
    assert '-c:v' in c and c[c.index('-c:v') + 1] == 'copy'
    assert 'aac_at' in c


def test_o_salto_acontece_antes_da_entrada():
    """
    `-ss` ANTES do `-i` faz o ffmpeg buscar no arquivo em vez de decodificar e
    descartar. Sobre HTTP isso vira uma requisição por faixa, e é a diferença
    entre saltar em um segundo e em um minuto.
    """
    c = comando('http://x/f.mkv', inicio=300)
    assert c.index('-ss') < c.index('-i')


def test_sem_salto_nao_ha_ss():
    assert '-ss' not in comando('http://x/f.mkv', inicio=0)


def test_a_legenda_do_arquivo_fica_de_fora():
    """
    As legendas embutidas viram `bin_data` no MP4 e o navegador não faz nada
    com elas. As da tela chegam por <track>, de outra rota.
    """
    c = comando('http://x/f.mkv')
    assert '-sn' in c


def test_a_saida_e_mp4_fragmentado():
    """Sem `empty_moov` o navegador espera o arquivo inteiro antes de tocar."""
    c = comando('http://x/f.mkv')
    flags = c[c.index('-movflags') + 1]
    assert 'empty_moov' in flags and 'frag_keyframe' in flags


# ── a forma do fluxo, que derrubou o servidor ─────────────────────────────

def test_o_fluxo_e_assincrono():
    """
    A guarda mais importante deste arquivo. Sob ASGI, um gerador síncrono em
    StreamingHttpResponse é consumido inteiro antes de qualquer byte sair — e
    com um filme de 65 GB isso trava o servidor INTEIRO, não só a requisição.
    Verificado: todos os endpoints passaram a responder nada.
    """
    fonte = inspect.getsource(transcode.abre_fluxo)
    assert 'async def pedacos' in fonte, 'gerador síncrono trava o Daphne'
    assert 'run_in_executor' in fonte, 'ler o cano bloqueia o laço de eventos'


def test_o_processo_morre_quando_o_fluxo_acaba():
    """
    Sem isto, cada vídeo abandonado deixaria um ffmpeg baixando o filme
    inteiro do Real-Debrid, para ninguém.
    """
    fonte = inspect.getsource(transcode.abre_fluxo)
    assert 'finally' in fonte and 'kill()' in fonte


@pytest.mark.django_db
def test_o_fluxo_entrega_bytes_e_encerra_o_processo():
    """Comportamental: um ffmpeg de mentira que escreve e sai."""
    from asgiref.sync import async_to_sync

    real = transcode.FFMPEG
    try:
        transcode.FFMPEG = '/bin/echo'
        processo, pedacos = transcode.abre_fluxo('http://x/f.mkv')

        async def junta():
            return b''.join([p async for p in pedacos])

        assert async_to_sync(junta)(), 'nada saiu do cano'
        assert processo.poll() is not None
    finally:
        transcode.FFMPEG = real


@pytest.mark.django_db
def test_abandonar_o_video_no_meio_mata_o_ffmpeg():
    """
    O caso que importa: o navegador fecha a aba com o filme na metade. Sem
    matar o processo, cada vídeo abandonado deixa um ffmpeg baixando 65 GB do
    Real-Debrid para ninguém.

    O `/bin/echo` do teste acima morre sozinho e por isso não prova nada aqui;
    `yes` escreve para sempre, que é o comportamento do ffmpeg real.
    """
    from asgiref.sync import async_to_sync

    real = transcode.FFMPEG
    try:
        transcode.FFMPEG = '/usr/bin/yes'
        processo, pedacos = transcode.abre_fluxo('http://x/f.mkv')

        async def le_um_pedaco_e_desiste():
            async for _ in pedacos:
                break
            await pedacos.aclose()

        async_to_sync(le_um_pedaco_e_desiste)()

        assert processo.poll() is not None, 'o ffmpeg continuou baixando sozinho'
    finally:
        transcode.FFMPEG = real
        if processo.poll() is None:   # o teste falhou; não deixa o `yes` solto
            processo.kill()


@pytest.mark.django_db
def test_um_ffmpeg_imortal_nao_trava_a_thread():
    """
    Se o `kill` não pegar, a limpeza ainda tem que TERMINAR.

    `stderr.read()` vai até o fim do cano, e o cano só acaba quando quem
    escreve morre. Lendo sem checar, um ffmpeg sobrevivente prende para sempre
    a thread do executor que faz a limpeza — e o pool tem tamanho fixo, então
    alguns desses e o servidor inteiro para de transcodificar.
    """
    import threading

    from asgiref.sync import async_to_sync

    real = transcode.FFMPEG
    processo = None
    try:
        transcode.FFMPEG = '/usr/bin/yes'
        processo, pedacos = transcode.abre_fluxo('http://x/f.mkv')
        processo.kill = lambda: None       # um ffmpeg que ignora o kill

        async def le_um_pedaco_e_desiste():
            async for _ in pedacos:
                break
            await pedacos.aclose()

        thread = threading.Thread(target=async_to_sync(le_um_pedaco_e_desiste),
                                  daemon=True)
        thread.start()
        thread.join(timeout=20)
        assert not thread.is_alive(), 'a limpeza ficou presa lendo o stderr'
    finally:
        transcode.FFMPEG = real
        if processo is not None:
            os.kill(processo.pid, signal.SIGKILL)


# ── o valor do -ss, e não só a posição dele ───────────────────────────────

@pytest.mark.parametrize('inicio,esperado', [
    (0, None), (600.0, '600.000'), (3618.573, '3618.573'), (0.5, '0.500'),
])
def test_o_ss_carrega_o_segundo_pedido(inicio, esperado):
    """
    A guarda antiga dizia onde o `-ss` estava, nunca com que valor.

    Um ffmpeg que sempre começa do zero passaria nela enquanto todo salto
    devolvia o começo do filme — e a tela, que soma o deslocamento ao relógio,
    mostraria 1h sobre a primeira cena.
    """
    cmd = comando('http://x/f.mkv', inicio)
    if esperado is None:
        assert '-ss' not in cmd
    else:
        assert cmd[cmd.index('-ss') + 1] == esperado


def test_o_transcode_completo_recodifica_o_video():
    """
    O ramo TUDO existe para o vídeo que o navegador não decodifica. Se ele
    virar `-c:v copy`, a cópia é servida intacta e a tela mostra nada — com
    todos os outros testes passando, porque nenhum exercitava este ramo.
    """
    cmd = comando('http://x/f.mkv', 0, TUDO)
    assert cmd[cmd.index('-c:v') + 1] == 'h264_videotoolbox'
    assert '-b:v' in cmd

    assert comando('http://x/f.mkv', 0, SO_AUDIO)[
        comando('http://x/f.mkv', 0, SO_AUDIO).index('-c:v') + 1] == 'copy'


# ── o segundo de partida ──────────────────────────────────────────────────

@pytest.mark.parametrize('bruto,esperado', [
    (None, 0.0), ('', 0.0), ('abc', 0.0), ('-5', 0.0), ('0', 0.0),
    ('600', 600.0), ('600.5', 600.5),
    # `float()` aceita os três sem levantar nada, e o ffmpeg aceita depois:
    # devolve um fluxo vazio, que o navegador lê como falha.
    ('inf', 0.0), ('-inf', 0.0), ('nan', 0.0),
])
def test_o_segundo_de_partida_recusa_o_que_o_float_aceita(bruto, esperado):
    assert transcode.segundo_de_partida(bruto) == esperado


def test_saltar_para_depois_do_fim_para_antes_do_fim():
    """Pedir o último segundo devolve fluxo vazio; o clamp deixa sobra."""
    assert transcode.segundo_de_partida('9999', 9078.741) == pytest.approx(9076.741)
    assert transcode.segundo_de_partida('5000', 9078.741) == 5000.0
    # Sem duração conhecida não há como clampar, e inventar um teto seria pior.
    assert transcode.segundo_de_partida('99999', None) == 99999.0


def test_duracao_ilegivel_vira_none_e_nao_zero():
    """
    None é 'não sei'; 0 seria 'o filme tem zero segundos' — e a tela divide
    pela duração para desenhar a barra.
    """
    assert transcode.duracao_do_arquivo('/tmp/nao-existe-mesmo.mkv') is None


def ffprobe_devolve(dados):
    """Substitui o ffprobe pelo JSON que ele devolveria."""
    import json as _json
    saida = _json.dumps(dados).encode()
    return lambda *a, **k: subprocess.CompletedProcess(a[0] if a else [], 0, saida, b'')


@pytest.mark.parametrize('formato,esperado', [
    ({'duration': '9078.741'}, 9078.741),
    ({'duration': '0.000000'}, None),      # sem duração: 'não sei', não 'zero'
    ({'duration': '-1'}, None),
    ({'duration': 'N/A'}, None),
    ({}, None),
])
def test_a_duracao_so_vale_se_for_positiva(monkeypatch, formato, esperado):
    """
    Zero não é uma duração, é a ausência de uma.

    A tela divide por este número para desenhar a barra e para decidir se o
    filme acabou. Um 0 devolvido como se fosse medida faria `totalTime` cair
    no ramo do buffer e marcar como assistido um filme de duas horas.
    """
    monkeypatch.setattr(transcode.subprocess, 'run',
                        ffprobe_devolve({'format': formato, 'streams': []}))
    assert transcode.duracao_do_arquivo('http://x/f.mkv') == esperado


def test_uma_sondagem_responde_as_duas_perguntas(monkeypatch):
    """
    Duração e faixas vêm do MESMO ffprobe. Cada ida ao Real-Debrid custa ~4,6
    segundos medidos; perguntar duas vezes pagaria isso em dobro por uma
    resposta que um comando só já traz inteira.
    """
    chamadas = []

    def espia(*a, **k):
        chamadas.append(a)
        return ffprobe_devolve({
            'format': {'duration': '5973.968'},
            'streams': [{'index': 0, 'codec_type': 'video'},
                        {'index': 1, 'codec_type': 'audio', 'codec_name': 'dts'}],
        })(*a, **k)

    monkeypatch.setattr(transcode.subprocess, 'run', espia)
    resultado = transcode.sonda_o_arquivo('http://x/f.mkv')

    assert len(chamadas) == 1
    assert resultado['duracao'] == 5973.968
    assert len(resultado['faixas']) == 1


def test_a_posicao_da_faixa_conta_so_entre_audios(monkeypatch):
    """
    A armadilha, com os números reais de Mártires: o ffprobe numera os fluxos
    globalmente — o primeiro áudio é o índice 1, porque o 0 é o vídeo. Já
    `-map 0:a:N` conta apenas entre os áudios, do zero.

    Passar o índice global para o `-map` seleciona a faixa errada, ou nenhuma.
    """
    monkeypatch.setattr(transcode.subprocess, 'run', ffprobe_devolve({
        'format': {'duration': '5973.968'},
        'streams': [
            {'index': 0, 'codec_type': 'video', 'codec_name': 'hevc'},
            {'index': 1, 'codec_type': 'audio', 'codec_name': 'dts', 'channels': 6,
             'channel_layout': '5.1(side)',
             'tags': {'language': 'fre', 'title': '5.1 Surround Mix'}},
            {'index': 2, 'codec_type': 'audio', 'codec_name': 'ac3', 'channels': 6,
             'tags': {'language': 'eng', 'title': 'English Dub / 5.1 Surround Mix'}},
            {'index': 5, 'codec_type': 'subtitle'},
            {'index': 6, 'codec_type': 'audio', 'codec_name': 'ac3', 'channels': 1,
             'tags': {'language': 'eng', 'title': 'Commentary by Nia Edwards-Behi'}},
        ],
    }))
    faixas = transcode.sonda_o_arquivo('http://x/f.mkv')['faixas']

    assert [f['posicao'] for f in faixas] == [0, 1, 2], 'posição não é contígua'
    assert [f['index'] for f in faixas] == [1, 2, 6], 'perdeu o índice global'
    assert faixas[0]['idioma'] == 'fre'
    assert faixas[2]['titulo'].startswith('Commentary')


def test_faixa_sem_etiquetas_nao_derruba_a_sondagem(monkeypatch):
    """A maioria das cópias não etiqueta idioma nem título."""
    monkeypatch.setattr(transcode.subprocess, 'run', ffprobe_devolve({
        'format': {'duration': '100'},
        'streams': [{'index': 1, 'codec_type': 'audio', 'codec_name': 'aac'}],
    }))
    faixa = transcode.sonda_o_arquivo('http://x/f.mkv')['faixas'][0]

    assert faixa['idioma'] == ''
    assert faixa['titulo'] == ''
    assert faixa['canais'] == 0


def test_ffprobe_ilegivel_nao_inventa_faixas(monkeypatch):
    monkeypatch.setattr(
        transcode.subprocess, 'run',
        lambda *a, **k: subprocess.CompletedProcess([], 1, b'isto nao e json', b'erro'))
    assert transcode.sonda_o_arquivo('http://x/f.mkv') == {'duracao': None, 'faixas': []}


# ── a faixa pedida pela URL ───────────────────────────────────────────────

QUATRO_FAIXAS = [{'posicao': i} for i in range(4)]


@pytest.mark.parametrize('bruto,esperado', [
    (None, 0), ('', 0), ('0', 0), ('1', 1), ('3', 3),
    # Fora do que o arquivo tem. `-map 0:a:99?` NÃO falha: a interrogação faz
    # o ffmpeg simplesmente não selecionar faixa nenhuma, e sai um filme mudo
    # com status 200. Silêncio servido como sucesso.
    ('4', 0), ('99', 0),
    ('-1', 0), ('abc', 0), ('1.5', 0), ('inf', 0),
])
def test_a_faixa_pedida_precisa_existir_no_arquivo(bruto, esperado):
    assert transcode.faixa_de_audio(bruto, QUATRO_FAIXAS) == esperado


def test_sem_lista_de_faixas_so_o_negativo_e_barrado():
    """
    É o caso de uma cópia que ainda não foi sondada: não há contra o que
    validar, e recusar tudo impediria tocar. O que não pode passar é índice
    negativo, que o ffmpeg interpreta de outro jeito.
    """
    assert transcode.faixa_de_audio('7', None) == 7
    assert transcode.faixa_de_audio('-2', None) == 0


def test_a_faixa_escolhida_chega_ao_ffmpeg():
    """
    A ponta que faltava: validar o índice não adianta se ele não for parar no
    `-map`. Verificado por mutação — trocar `0:a:{faixa}?` por `0:a:0?` fixo
    deixava todos os outros testes passando, com a troca de idioma morta.
    """
    for faixa in (0, 1, 3):
        cmd = comando('http://x/f.mkv', 0, SO_AUDIO, faixa)
        assert f'0:a:{faixa}?' in cmd, f'faixa {faixa} não chegou ao -map'


def test_o_map_da_faixa_mantem_a_interrogacao():
    """
    Sem a `?`, uma cópia sem a faixa pedida faz o ffmpeg recusar o arquivo
    INTEIRO — em vez de tocar vídeo sem som, não toca nada.
    """
    cmd = comando('http://x/f.mkv', 0, SO_AUDIO, 2)
    assert cmd[cmd.index('-map', cmd.index('-map') + 1) + 1].endswith('?')
