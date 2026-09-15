"""
Esta cópia toca no navegador, ou vai dar tela preta e silêncio?

A pergunta existe porque o algoritmo de qualidade e o player otimizam para
coisas opostas: a nota premia REMUX e faixa sem perdas, e é exatamente isso que
o `<video>` recusa. Quanto melhor a nota, menor a chance de tocar — e nenhum
dos dois lados está errado sozinho.

MEDIDO no navegador do usuário, com `canPlayType` e strings de codec completas:

  vídeo     H.264, HEVC, AV1 e VP9 respondem "probably", tanto em MP4 quanto em
            Matroska. AVI não toca.
  áudio     AAC, FLAC, MP3 e Opus respondem "probably".
            DTS, DTS-HD, TrueHD, AC-3 e E-AC-3 respondem NÃO — sem exceção.

O áudio é o que decide. Uma cópia com DTS toca a imagem e não emite som, que foi
exatamente o relato. E é sorte que seja assim: o áudio é o que os nomes de
release declaram melhor, enquanto o container quase nunca aparece — 5 de 63
títulos do acervo dizem `.mkv`.

Três respostas, e não duas. "Não sei" é frequente aqui (44 das 63 cópias não têm
áudio identificado no nome) e não pode ser confundido com "não toca": a primeira
merece uma tentativa, a segunda não.
"""

# Faixas que o navegador simplesmente não decodifica. Nenhuma delas emite som.
AUDIO_QUE_NAO_TOCA = frozenset({
    'DTS', 'DTS-HD MA', 'DTS:X', 'Dolby TrueHD', 'Dolby Atmos', 'DD+',
})

# Faixas confirmadas no navegador.
AUDIO_QUE_TOCA = frozenset({'AAC', 'FLAC', 'MP3', 'Opus'})

# Vídeo que responde "probably" em qualquer container testado.
VIDEO_QUE_TOCA = frozenset({'AVC', 'HEVC', 'AV1', 'VP9'})

TOCA = 'toca'
NAO_TOCA = 'nao_toca'
TALVEZ = 'talvez'


def compatibilidade_no_navegador(release) -> str:
    """
    Se esta cópia toca num navegador: 'toca', 'nao_toca' ou 'talvez'.

    Lê `audio_codec`, `video_codec` e `is_remux`, que o parser já preenche a
    partir do nome. Não vai à rede e não olha o arquivo — é uma leitura do que
    o release DIZ de si, e por isso "talvez" é uma resposta legítima e comum.
    """
    audio = (release.audio_codec or '').strip()
    video = (release.video_codec or '').strip()

    # O que o release DECLARA vence qualquer inferência: um remux que diz
    # trazer AAC toca, por mais raro que isso seja.
    if audio in AUDIO_QUE_NAO_TOCA:
        return NAO_TOCA

    # Container que o navegador não abre — AVI é o caso que aparece — derruba
    # a cópia mesmo com áudio bom.
    if video and video not in VIDEO_QUE_TOCA:
        return NAO_TOCA

    if audio in AUDIO_QUE_TOCA:
        return TOCA

    # Daqui para baixo, o áudio não foi declarado — o caso de 44 das 63 cópias.
    #
    # Num remux isso não é ignorância, é implicação: remux carrega as faixas
    # ORIGINAIS do disco, e disco de cinema traz DTS-HD ou TrueHD. Chamar de
    # "talvez" seria fingir dúvida onde o próprio formato já respondeu, e
    # encheria a categoria do meio justamente com as cópias que mais
    # certamente calam.
    if release.is_remux:
        return NAO_TOCA

    return TALVEZ


def toca_no_navegador(release) -> bool:
    """Atalho para quem só quer filtrar."""
    return compatibilidade_no_navegador(release) == TOCA


# ── quando quem responde é o SERVIDOR, e não o nome do arquivo ────────────
#
# Jellyfin e Plex leem o arquivo de verdade e dizem os codecs em vocabulário de
# ffmpeg: 'dts', 'truehd', 'eac3', 'aac', 'hevc'. O parser de nome de release
# fala outro dialeto — 'DTS-HD MA', 'Dolby TrueHD', 'DD+', 'AVC' — porque lê o
# que o grupo de release escreveu, não o arquivo.
#
# Os dois dialetos precisam existir. Traduzir um para o outro seria escolher um
# vencedor e perder informação nos dois sentidos: o nome de release distingue
# 'DTS-HD MA' de 'DTS' (que o ffmpeg chama de 'dts' nos dois casos), e o
# servidor sabe o que REALMENTE está no arquivo, que é mais do que o nome
# promete.
#
# O que não pode acontecer é a pergunta só existir de um lado — foi o defeito:
# `precisa_converter` só era calculado no caminho do Real-Debrid, e um DTS
# vindo da biblioteca local tocava mudo sob o rótulo "JELLYFIN DIRECT".

# Nomes de ffmpeg para o que o navegador não decodifica. Medido com
# canPlayType; ver a tabela no topo deste arquivo.
AUDIO_FFMPEG_QUE_NAO_TOCA = frozenset({
    'dts', 'dca', 'truehd', 'mlp', 'ac3', 'eac3', 'ac-3', 'e-ac-3',
    'dtshd', 'dts-hd', 'pcm_bluray', 'pcm_dvd',
})

AUDIO_FFMPEG_QUE_TOCA = frozenset({
    'aac', 'flac', 'mp3', 'opus', 'vorbis', 'mp2',
})

VIDEO_FFMPEG_QUE_TOCA = frozenset({
    'h264', 'avc', 'avc1', 'hevc', 'h265', 'hvc1', 'av1', 'vp9', 'vp09',
})


def _limpa(codec) -> str:
    return str(codec or '').strip().lower()


def o_que_converter_de_codecs(audio_codec, video_codec) -> str:
    """
    Quanto trabalho dá um arquivo cujos codecs o SERVIDOR informou.

    Devolve o mesmo vocabulário de `o_que_transcodificar`: 'nada', 'audio' ou
    'tudo' — a tela e o conversor não precisam saber de onde veio o julgamento.

    DESCONHECIDO É 'NADA', e é uma escolha: converter por precaução gastaria
    CPU em toda biblioteca local que não declara codec, e o resultado de errar
    aqui é o comportamento de hoje (tenta direto e, se vier mudo, a pessoa tem
    o player externo ao lado). Converter à toa não tem volta — ela espera o
    ffmpeg para assistir algo que tocaria sozinho.
    """
    from apps.movies.transcode import NADA, SO_AUDIO, TUDO

    audio = _limpa(audio_codec)
    video = _limpa(video_codec)

    audio_falha = audio in AUDIO_FFMPEG_QUE_NAO_TOCA
    # Vídeo desconhecido conta como aproveitável, pelo mesmo motivo de
    # `o_que_transcodificar`: recodificar vídeo exige o codificador de hardware
    # e come a máquina, e o áudio é o problema real em quase todos os casos.
    video_falha = bool(video) and video not in VIDEO_FFMPEG_QUE_TOCA

    if not audio_falha and not video_falha:
        return NADA
    if video_falha:
        return TUDO
    return SO_AUDIO


def audio_principal(faixas) -> str:
    """
    O codec da faixa que vai TOCAR — não de uma faixa qualquer do arquivo.

    Um .mkv com DTS em inglês e AAC em português é comum, e perguntar "existe
    alguma faixa boa?" responde a pergunta errada: o navegador toca a faixa
    marcada como padrão, e se ela for DTS o filme vem mudo com um AAC intacto
    ao lado.

    Sem nenhuma marca de padrão, vale a primeira — que é o que os tocadores
    fazem.
    """
    de_audio = [f for f in (faixas or [])
                if str(f.get('tipo') or f.get('Type') or '').lower() == 'audio']
    if not de_audio:
        return ''

    padrao = next(
        (f for f in de_audio
         if f.get('padrao') or f.get('IsDefault') or f.get('default')),
        de_audio[0])
    return _limpa(padrao.get('codec') or padrao.get('Codec'))
