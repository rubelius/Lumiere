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
