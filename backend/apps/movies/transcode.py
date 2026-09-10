"""
Fazer tocar no navegador o que o navegador não decodifica.

O `<video>` não abre DTS, DTS-HD, TrueHD, AC-3 nem E-AC-3 — medido com
`canPlayType` — e são exatamente as faixas das cópias de maior nota. Um REMUX
2160p entrega imagem e silêncio.

O achado que dimensiona este módulo: quase nunca é preciso transcodificar
VÍDEO. H.264, HEVC, AV1 e VP9 respondem "probably" no navegador, em MP4 e em
Matroska. O que falha é o áudio. Então o caminho normal é copiar o fluxo de
vídeo intacto e converter só a faixa de som.

Medido contra um REMUX HEVC + DTS 5.1 servido pelo Real-Debrid: 60 segundos de
filme em 14 segundos de trabalho, a 15% de CPU. Quatro vezes mais rápido que a
reprodução, e o que limita é a rede — a fonte tem 51 Mbit/s. Transcodificar o
vídeo junto custaria uma ordem de grandeza mais.

O container de saída é MP4 fragmentado, que o navegador consome enquanto chega.
Ele não aceita requisição por faixa: quem quiser saltar pede de novo, a partir
de outro ponto, com `?inicio=`.
"""

import asyncio
import logging
import shutil
import subprocess

logger = logging.getLogger(__name__)

FFMPEG = shutil.which('ffmpeg') or 'ffmpeg'

# Quanto ler por vez do ffmpeg. 64 KB é grande o bastante para não picar a
# resposta em milhares de pedaços e pequeno o bastante para o vídeo começar
# quase junto com o primeiro fragmento.
PEDACO = 64 * 1024

NADA, SO_AUDIO, TUDO = 'nada', 'audio', 'tudo'


def o_que_transcodificar(release) -> str:
    """
    Quanto trabalho esta cópia dá: 'nada', 'audio' ou 'tudo'.

    Separar os dois casos é o que torna isto barato. Converter só o áudio roda
    a 4x a velocidade da reprodução com 15% de CPU; converter o vídeo junto
    exige o codificador de hardware e come a máquina.
    """
    from apps.movies.compatibilidade import (AUDIO_QUE_TOCA, VIDEO_QUE_TOCA,
                                             NAO_TOCA, compatibilidade_no_navegador)

    if compatibilidade_no_navegador(release) != NAO_TOCA:
        return NADA

    video = (release.video_codec or '').strip()
    # Vídeo desconhecido conta como aproveitável: o campo vem vazio em 25 das
    # 63 cópias do acervo, e recodificar por precaução custaria caro em todas
    # elas. Se estiver errado, o resultado é o mesmo de hoje — e o áudio, que é
    # o problema real, foi resolvido de qualquer forma.
    if not video or video in VIDEO_QUE_TOCA:
        return SO_AUDIO
    return TUDO


def comando(url: str, inicio: float = 0.0, escopo: str = SO_AUDIO) -> list:
    """
    A linha de comando do ffmpeg, montada.

    `-ss` ANTES do `-i` faz o salto por busca no arquivo em vez de decodificar
    e descartar — sobre HTTP isso vira uma requisição por faixa, e é a
    diferença entre saltar em um segundo e em um minuto.
    """
    cmd = [FFMPEG, '-hide_banner', '-loglevel', 'error']

    if inicio > 0:
        cmd += ['-ss', f'{inicio:.3f}']

    cmd += ['-i', url, '-map', '0:v:0', '-map', '0:a:0?']

    if escopo == TUDO:
        # `hevc_videotoolbox` existe nesta máquina, mas H.264 é o que qualquer
        # navegador aceita sem ressalva — e este caminho só roda quando o vídeo
        # original já era exótico.
        cmd += ['-c:v', 'h264_videotoolbox', '-b:v', '8M']
    else:
        cmd += ['-c:v', 'copy']

    cmd += [
        # `aac_at` é o codificador do AudioToolbox: é o que faz a conversão
        # custar 15% de CPU em vez de ocupar um núcleo.
        '-c:a', 'aac_at', '-ac', '2', '-b:a', '192k',
        # Sem legenda no fluxo: as do arquivo viram `bin_data` no MP4 e o
        # navegador não faz nada com elas. As legendas da tela vêm por <track>.
        '-sn', '-dn',
        '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
        '-f', 'mp4', 'pipe:1',
    ]
    return cmd


def abre_fluxo(url: str, inicio: float = 0.0, escopo: str = SO_AUDIO):
    """
    Liga o ffmpeg e devolve um iterador ASSÍNCRONO de bytes.

    Assíncrono não é preferência de estilo: o projeto serve por ASGI (Daphne),
    e ali um gerador síncrono dentro de StreamingHttpResponse é consumido
    inteiro antes de qualquer byte sair. Com um filme de 65 GB isso significa
    o navegador esperando para sempre por um cabeçalho que não vem — foi
    exatamente o que aconteceu, enquanto o ffmpeg produzia 585 MB em 20
    segundos do outro lado do cano.

    A leitura do cano é bloqueante, então acontece num executor; o que corre no
    laço de eventos é só a entrega.

    O iterador MATA o processo ao terminar, inclusive quando o navegador fecha
    a conexão no meio. Sem isso cada vídeo abandonado deixaria um ffmpeg
    baixando o filme inteiro do Real-Debrid, para ninguém.
    """
    cmd = comando(url, inicio, escopo)
    logger.info('Transcodificando (%s) a partir de %.1fs', escopo, inicio)

    processo = subprocess.Popen(
        cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, bufsize=0)

    async def pedacos():
        laco = asyncio.get_running_loop()
        try:
            while True:
                dado = await laco.run_in_executor(None, processo.stdout.read, PEDACO)
                if not dado:
                    break
                yield dado
        finally:
            if processo.poll() is None:
                processo.kill()
                try:
                    processo.wait(timeout=5)
                except Exception:
                    pass

            # O stderr só é lido DEPOIS de constatar que o processo morreu, e
            # a diferença não é cosmética: `read()` vai até o fim do cano, e um
            # cano só termina quando quem escreve nele morre. Com o ffmpeg
            # ainda vivo — o `kill` falhou, ou levou mais que os 5 segundos —
            # esta linha bloqueia para sempre, segurando uma thread do executor
            # junto. Sem log de erro se vive; travado é pior.
            if processo.poll() is not None:
                erro = (processo.stderr.read() or b'').decode(errors='replace')[:400]
                if erro.strip():
                    logger.warning('ffmpeg: %s', erro.strip())
            else:
                logger.error('ffmpeg %d sobreviveu ao kill', processo.pid)

    return processo, pedacos()


FFPROBE = shutil.which('ffprobe') or 'ffprobe'

# Quanto esperar pelo ffprobe. Ele não baixa o arquivo: lê o cabeçalho por
# range request e para. Medido contra um REMUX de 65 GB no Real-Debrid, 3,3
# segundos. 20 é folga para uma fonte lenta, e curto o bastante para não
# segurar o clique de tocar indefinidamente.
SEGUNDOS_DE_SONDAGEM = 20


def duracao_do_arquivo(url: str) -> float | None:
    """
    Quantos segundos o arquivo tem de verdade, ou None se não deu para saber.

    Isto existe por causa de uma limitação do MP4 fragmentado: ele não declara
    duração total — só o que já foi escrito. Um navegador tocando o fluxo
    convertido vê `duration` crescer junto com o buffer, e sem esta medida a
    barra de progresso não teria escala nenhuma.

    Devolver None é resposta legítima e o chamador precisa tratá-la: fonte fora
    do ar, formato que o ffprobe não abre, ou sondagem estourando o tempo.
    """
    try:
        saida = subprocess.run(
            [FFPROBE, '-v', 'error', '-show_entries', 'format=duration',
             '-of', 'default=nw=1:nk=1', url],
            capture_output=True, timeout=SEGUNDOS_DE_SONDAGEM)
    except (subprocess.TimeoutExpired, OSError) as erro:
        logger.warning('ffprobe não respondeu: %s', erro)
        return None

    try:
        segundos = float(saida.stdout.decode().strip())
    except (UnicodeDecodeError, ValueError):
        logger.warning('ffprobe: duração ilegível (%s)',
                       (saida.stderr or b'').decode(errors='replace')[:200])
        return None

    # "N/A" já caiu no ValueError acima; 0 e negativo passariam, e uma barra de
    # progresso dividida por zero é pior que uma sem escala.
    return segundos if segundos > 0 else None


# Quanto antes do fim um salto pode chegar. Pedir exatamente o último segundo
# devolve um fluxo vazio, que o navegador lê como falha em vez de fim.
SOBRA_NO_FIM_S = 2.0


def segundo_de_partida(bruto, duracao: float | None = None) -> float:
    """
    O `?inicio=` da requisição virado num segundo que faz sentido.

    A conversão ingênua — `max(0.0, float(bruto))` — deixa passar coisas que o
    ffmpeg aceita e não devolve nada: `inf` e `nan` sobrevivem a `float()` sem
    levantar ValueError, e um salto para além do fim do arquivo produz um
    fluxo vazio. Nos dois casos o navegador recebe 200 e silêncio, que é o
    modo de falhar mais caro de diagnosticar.
    """
    try:
        segundo = float(bruto if bruto not in (None, '') else 0)
    except (TypeError, ValueError):
        return 0.0

    # `nan` falha TODA comparação, inclusive `nan > 0` e `nan < duracao`, então
    # precisa ser barrado por identidade e não por intervalo.
    if segundo != segundo or segundo in (float('inf'), float('-inf')):
        return 0.0

    if segundo < 0:
        return 0.0

    if duracao and duracao > 0:
        return min(segundo, max(0.0, duracao - SOBRA_NO_FIM_S))

    return segundo
