"""
Leitura de nomes de release.

O nome de um release é a única pista para ligá-lo a um filme do acervo, e
errar aqui é pior do que não casar: um release ligado ao filme errado faz o
player tocar outra obra. Por isso tudo aqui é conservador — na dúvida, devolve
None e o item fica como "não casado" para inspeção humana.
"""

import re
from typing import Optional, Tuple

# Marcadores que aparecem DEPOIS do ano num nome de release. Servem para
# decidir qual número de 4 dígitos é o ano, e não parte do título.
_MARCADORES_DE_QUALIDADE = (
    '2160P', '1080P', '1080I', '720P', '480P', 'UHD', '4K',
    'BLURAY', 'BLU-RAY', 'BDRIP', 'BRRIP', 'WEB', 'WEBRIP', 'WEB-DL',
    'REMUX', 'HDTV', 'DVDRIP', 'HDR', 'DV', 'X264', 'X265', 'HEVC', 'AVC',
    'DTS', 'TRUEHD', 'ATMOS', 'AAC', 'AC3',
)

_ANO = re.compile(r'\b(19\d{2}|20\d{2})\b')
_IMDB = re.compile(r'\b(tt\d{7,8})\b', re.IGNORECASE)
# Separador em nome de release pode ser espaço, ponto, hífen ou underscore.
_SEP = r'[\s._-]+'
_SERIE = re.compile(
    rf'\b(S\d{{1,2}}E\d{{1,2}}|S\d{{1,2}}|SEASON{_SEP}?\d+|COMPLETE{_SEP}SERIES)\b',
    re.IGNORECASE,
)


def extrai_imdb_id(nome: str) -> Optional[str]:
    """
    Pista mais confiável: alguns grupos embutem `{imdb-tt1234567}` no nome.
    É identificador único, então dispensa heurística de título.
    """
    achado = _IMDB.search(nome or '')
    return achado.group(1).lower() if achado else None


def parece_serie(nome: str) -> bool:
    """
    Episódio ou temporada de série. O acervo é de longas, então tentar casar
    isso só produziria falso positivo.
    """
    return bool(_SERIE.search(nome or ''))


def extrai_titulo_e_ano(nome: str) -> Optional[Tuple[str, int]]:
    """
    Separa título e ano de lançamento.

    O caso difícil é título que contém número de quatro dígitos — "2001: Uma
    Odisseia no Espaço", "Blade Runner 2049". Por isso os candidatos a ano são
    varridos da direita para a esquerda, e só vale o que for seguido de algum
    marcador de qualidade: é o que separa o ano de lançamento do número que
    faz parte do nome da obra.
    """
    if not nome:
        return None

    limpo = re.sub(r'[._]+', ' ', nome)
    limpo = re.sub(r'[\[\](){}]', ' ', limpo)
    limpo = re.sub(r'\s+', ' ', limpo).strip()

    candidatos = [(m.start(), int(m.group())) for m in _ANO.finditer(limpo)]
    if not candidatos:
        return None

    for posicao, ano in reversed(candidatos):
        titulo = limpo[:posicao].strip(' -–')
        resto = limpo[posicao + 4:].upper()
        if titulo and any(marcador in resto for marcador in _MARCADORES_DE_QUALIDADE):
            return titulo, ano

    # Sem marcador nenhum: aceita o último ano, desde que sobre título antes
    # dele. Menos confiável, mas ainda exige casamento exato lá na frente.
    posicao, ano = candidatos[-1]
    titulo = limpo[:posicao].strip(' -–')
    return (titulo, ano) if titulo else None
