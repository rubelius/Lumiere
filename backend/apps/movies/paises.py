"""
Normalização do campo `country` do acervo.

O campo guarda a origem como a fonte registrou, e as fontes discordam entre
si: coprodução vem unida por hífen ('UK-Germany-Sweden-Belgium-USA'), e o
mesmo país aparece ora como código ISO, ora por extenso — 'US' em 8.346
filmes e 'USA' em 702, que são o mesmo lugar contado duas vezes.

Contar `DISTINCT country` devolvia 423 "países", que são combinações de
coprodução, não países. Depois de separar, ainda sobravam 237, inflados pela
duplicação código/nome.
"""

from functools import lru_cache
from typing import Iterable, Set

import pycountry

SEPARADORES = ('-', ',', '/', '|')

# Origens que o pycountry não resolve. A lista não foi imaginada: é o
# resultado de varrer o acervo inteiro e recolher exatamente o que sobrou,
# com a frequência de cada uma ao lado.
#
# Dois grupos. O primeiro são países vivos que o pycountry conhece por outro
# nome — 'UK' é 'GB', 'Turkey' virou 'Türkiye'. Sem eles, 'UK' e 'GB'
# contariam como dois países, que é a duplicação que esta normalização existe
# para acabar.
#
# O segundo são estados que deixaram de existir. Eles aparecem no acervo em
# duas grafias cada — código e nome — e precisam convergir entre si, mas NÃO
# no sucessor: um filme soviético de 1970 não é um filme russo, e tratá-lo
# como tal apagaria da contagem uma cinematografia inteira.
APELIDOS = {
    # países vivos, grafia que o pycountry não reconhece
    'UK': 'GB',                    # 211
    'XI': 'GB',                    # 2 — Irlanda do Norte
    'Russia': 'RU',                # 14
    'Turkey': 'TR',                # 7

    # estados históricos: código e nome convergem para um rótulo legível
    'SU': 'USSR',                  # 387
    'USSR': 'USSR',                # 44
    'YU': 'Yugoslavia',            # 76
    'Yugoslavia': 'Yugoslavia',    # 3
    'XC': 'Czechoslovakia',        # 124
    'CS': 'Czechoslovakia',        # 2
    'Czechoslovakia': 'Czechoslovakia',   # 6
    'XG': 'East Germany',          # 29
    'East Germany': 'East Germany',       # 1
    'West Germany': 'West Germany',       # 19
    'XK': 'XK',                    # 1 — Kosovo, sem código ISO atribuído
}


@lru_cache(maxsize=2048)
def para_codigo(origem: str) -> str:
    """
    Código ISO de uma origem, ou a própria origem quando não há como resolver.

    Estado histórico — USSR, West Germany, Czechoslovakia — não tem código
    ISO vigente, e mapeá-lo para o sucessor seria decisão editorial: um filme
    soviético de 1970 não é um filme russo. Nesses casos a origem fica como
    está e conta como uma origem própria, que é o que ela é.
    """
    limpo = (origem or '').strip()
    if not limpo:
        return ''
    if limpo in APELIDOS:
        return APELIDOS[limpo]
    try:
        return pycountry.countries.lookup(limpo).alpha_2
    except LookupError:
        return limpo


def separa(valor: str) -> Iterable[str]:
    """Quebra uma coprodução nas origens que a compõem."""
    partes = [valor or '']
    for sep in SEPARADORES:
        partes = [p for parte in partes for p in parte.split(sep)]
    return (p.strip() for p in partes if p.strip())


def origens_distintas(valores: Iterable[str]) -> Set[str]:
    """Conjunto de origens distintas, já separadas e normalizadas."""
    return {
        codigo
        # `str(None)` produzia a origem 'None', que entrava na contagem como
        # se fosse um lugar.
        for valor in valores
        if valor
        for origem in separa(str(valor))
        if (codigo := para_codigo(origem))
    }
