"""
Conversão de legenda para WebVTT.

A tag <track> do navegador só entende WebVTT, e o OpenSubtitles entrega SRT na
esmagadora maioria. Sem esta conversão a legenda simplesmente não aparece — e
falha em silêncio, sem erro no console.
"""

import re

# SRT usa vírgula no decimal do timestamp; WebVTT exige ponto.
# A hora é opcional: legenda curta às vezes vem só com mm:ss.
_TEMPO = re.compile(
    r'(?P<ini>(?:\d{1,3}:)?\d{1,2}:\d{2})[,.](?P<ms_ini>\d{1,3})\s*-->\s*'
    r'(?P<fim>(?:\d{1,3}:)?\d{1,2}:\d{2})[,.](?P<ms_fim>\d{1,3})'
)

# Tags de posicionamento herdadas do SSA/ASS. O WebVTT não as entende e elas
# apareceriam como texto literal na tela.
_TAGS_SSA = re.compile(r'\{\\[^}]*\}')


def srt_para_vtt(conteudo: str) -> str:
    """
    Converte SRT em WebVTT.

    Tolerante de propósito: legenda vinda da internet chega com BOM, CRLF,
    numeração ausente e milissegundos de tamanho variável. Nada disso deve
    impedir a exibição.
    """
    if conteudo is None:
        return 'WEBVTT\n\n'

    texto = conteudo.lstrip('﻿').replace('\r\n', '\n').replace('\r', '\n')

    # Alguns provedores já entregam WebVTT. Remove o cabeçalho existente para
    # não empilhar um segundo, o que invalidaria o arquivo.
    texto = re.sub(r'^\s*WEBVTT[^\n]*\n?', '', texto)

    def normaliza_tempo(m):
        ini = _completa_hora(m.group('ini'))
        fim = _completa_hora(m.group('fim'))
        return f"{ini}.{m.group('ms_ini').ljust(3, '0')} --> {fim}.{m.group('ms_fim').ljust(3, '0')}"

    texto = _TEMPO.sub(normaliza_tempo, texto)
    texto = _TAGS_SSA.sub('', texto)

    linhas = []
    for linha in texto.split('\n'):
        # A numeração do bloco é opcional no WebVTT; mantê-la é inofensivo,
        # mas removê-la evita que um número solto vire legenda caso o arquivo
        # esteja malformado.
        if linha.strip().isdigit():
            continue
        linhas.append(linha)

    corpo = '\n'.join(linhas).strip('\n')
    return f'WEBVTT\n\n{corpo}\n' if corpo else 'WEBVTT\n\n'


def _completa_hora(t: str) -> str:
    """WebVTT aceita mm:ss, mas hh:mm:ss é sempre válido — normaliza para ele."""
    partes = t.split(':')
    if len(partes) == 3:
        h, m, s = partes
        return f'{int(h):02d}:{m}:{s}'
    m, s = partes
    return f'00:{m}:{s}'
