"""
Leitura de nomes de release.

O nome de um release é a única pista para ligá-lo a um filme do acervo, e
errar aqui é pior do que não casar: um release ligado ao filme errado faz o
player tocar outra obra. Por isso tudo aqui é conservador — na dúvida, devolve
None e o item fica como "não casado" para inspeção humana.
"""

import html
import re
import unicodedata
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


def normaliza_titulo(titulo: str) -> str:
    """
    Forma comparável de um título: sem acento, sem pontuação, caixa baixa.

    O nome de um release perde a pontuação no caminho — os pontos separadores
    viram espaços, e "Avatar.The.Way.of.Water" não tem como saber que o acervo
    guarda "Avatar: The Way of Water". Comparar as duas formas cruas falha por
    causa de um dois-pontos.

    Normalizar não afrouxa o casamento: a comparação segue sendo igualdade
    exata, e continua exigindo o ano bater. O que muda é só deixar de tratar
    pontuação e acento como diferença de conteúdo.
    """
    if not titulo:
        return ''
    sem_acento = ''.join(
        c for c in unicodedata.normalize('NFKD', titulo)
        if not unicodedata.combining(c)
    )
    # Apóstrofo some, o resto da pontuação vira espaço. Se o apóstrofo também
    # virasse espaço, "Toro's" daria "toro s" e não alcançaria "Toros"; se a
    # pontuação toda sumisse, "Spider-Man" daria "spiderman" e deixaria de
    # alcançar "Spider Man".
    sem_apostrofo = re.sub(r"['\u2019\u02bc`]", '', sem_acento.lower())
    return re.sub(r'\s+', ' ', re.sub(r'[^\w\s]', ' ', sem_apostrofo)).strip()


# Os países cujo título alternativo os indexadores costumam usar. O inglês é o
# que aparece em praticamente todo tracker; os outros entram porque um release
# europeu às vezes cataloga pelo nome local.
PAISES_UTEIS = ('US', 'GB', 'XX')


def nomes_conhecidos(movie) -> set:
    """
    Todo nome pelo qual este filme é catalogado, em forma comparável.

    O acervo guarda o título localizado e o original, e o TMDB traz os
    alternativos — é lá que mora "Tokyo Story" para um filme cujo original é
    "東京物語" e cujo título local é "Era Uma Vez em Tóquio". Nenhum dos dois
    que temos aparece num tracker; o alternativo aparece em todos.

    16.934 dos 25.908 filmes do acervo têm essa lista.
    """
    nomes = {movie.title, movie.original_title}
    for alt in (getattr(movie, 'alternative_titles', None) or []):
        if isinstance(alt, dict) and alt.get('title'):
            nomes.add(alt['title'])
        elif isinstance(alt, str):
            nomes.add(alt)
    return {n for n in (normaliza_titulo(x) for x in nomes if x) if n}


def titulos_para_buscar(movie) -> list:
    """
    Os nomes que vale usar numa busca em indexador.

    Buscar por todos os alternativos seria caro demais — cada consulta ao
    Prowlarr leva de 40 a 100 segundos. Vale o original, o localizado, e o
    alternativo em inglês, que é o que os trackers usam.
    """
    escolhidos, vistos = [], set()
    for nome in (movie.original_title, movie.title):
        if nome and normaliza_titulo(nome) not in vistos:
            escolhidos.append(nome)
            vistos.add(normaliza_titulo(nome))

    for alt in (getattr(movie, 'alternative_titles', None) or []):
        if not isinstance(alt, dict):
            continue
        if alt.get('country') not in PAISES_UTEIS:
            continue
        nome = (alt.get('title') or '').strip()
        chave = normaliza_titulo(nome)
        if nome and chave not in vistos:
            escolhidos.append(nome)
            vistos.add(chave)
            break  # um alternativo basta; cada consulta custa 40s

    return escolhidos


def _partes_do_titulo(titulo: str) -> set:
    """
    As leituras possíveis de um título de release, normalizadas.

    Trackers russos e italianos empilham nomes: "Отступники / The Departed",
    "2001 год: Космическая одиссея / 2001: A Space Odyssey". Comparar a linha
    inteira recusava cópias legítimas — 12 das 105 do acervo, todas do filme
    certo. A barra é o separador convencional, e cada lado é um nome válido.
    """
    partes = {normaliza_titulo(titulo)}
    for pedaco in re.split(r'\s*/\s*', titulo):
        limpo = normaliza_titulo(pedaco)
        if limpo:
            partes.add(limpo)
    return {p for p in partes if p}


def _bate(parte: str, conhecidos: set) -> bool:
    """
    Igualdade, ou nome conhecido no COMEÇO seguido de espaço.

    O prefixo existe porque releases acrescentam coisa depois do nome: o
    italiano cola o subtítulo local ("The Departed Il bene e il male"), e o
    brasileiro às vezes cola a resolução antes do ano ("2001 - Uma Odisséia no
    Espaço 1080p"). São 3 das 105 cópias do acervo, todas do filme certo.

    A fronteira de espaço é o que impede o prefixo de virar substring solto:
    "Alien" não alcança "Aliens", porque exige "alien " com espaço. E o ano
    continua sendo exigido antes de chegar aqui.
    """
    if parte in conhecidos:
        return True
    return any(parte.startswith(nome + ' ') for nome in conhecidos if nome)


def e_do_filme(nome_do_release: str, movie) -> bool:
    """
    Se esta cópia é deste filme.

    Sem esta pergunta, a busca guardava tudo que o indexador devolvesse. Para
    "東京物語", que nenhum tracker cataloga, os indexadores não acharam o
    título, casaram só o ANO, e a ficha ficou com 44 cópias de "From Here to
    Eternity", "Shane" e "Peter Pan" — todas de 1953, nenhuma do filme.

    O IMDb no nome é prova. Sem ele, exige título conhecido E ano batendo:
    igualdade exata sobre a forma normalizada, nunca substring. Num acervo de
    26 mil filmes, casar por substring casaria qualquer coisa — e ligar a cópia
    de um filme na ficha de outro é pior que não achar cópia nenhuma.
    """
    imdb = extrai_imdb_id(nome_do_release)
    if imdb and getattr(movie, 'imdb_id', ''):
        return imdb.lower().lstrip('t').lstrip('0') == \
            movie.imdb_id.lower().lstrip('t').lstrip('0')

    extraido = extrai_titulo_e_ano(html.unescape(nome_do_release))
    if not extraido:
        # Sem ano no nome não dá para separar um remake do original, e é
        # justamente aí que casar errado dói mais.
        return False

    titulo, ano = extraido
    if movie.year and ano and int(ano) != int(movie.year):
        return False

    conhecidos = nomes_conhecidos(movie)
    return any(_bate(parte, conhecidos) for parte in _partes_do_titulo(titulo))
