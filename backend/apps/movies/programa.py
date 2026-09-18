"""
O programa do dia: o que a home mostra, e por que muda.

O DEFEITO QUE ISTO RESOLVE, medido: a home inteira se alimentava de UMA
requisição — a primeira página de `/api/movies/`, 20 filmes, ordenada por
`ranking_current`, que está preenchido em 100% do acervo. Hero, Obras-Primas,
Próximas Projeções e Admit One eram recortes desses mesmos 20. O hero sorteava
10 de 20: 0,077% das 25.908 obras. "Próximas Projeções" tinha uma linha escrita
à mão e outra que sempre dava "Orson Welles", porque nos 20 todos os diretores
são distintos e o desempate pega o primeiro colocado.

POR QUE UM PROGRAMA, E NÃO SORTEIO A CADA CARGA. Um F5 que troca tudo não é
"vivo", é instável: a pessoa perde o filme que tinha acabado de ver de canto de
olho, e nada do que ela viu ontem dá para reencontrar. Uma cinemateca não
sorteia a sessão a cada visitante — ela programa. Aqui o programa é
DETERMINÍSTICO POR DATA: estável do primeiro ao último acesso do dia, e outro
amanhã. A tela pode dizer a data, e dizê-la é o que torna a estabilidade
honesta em vez de suspeita.

E é testável, que é a outra metade do motivo: mesma data, mesmo programa.
"""

import hashlib
import random
from datetime import date

from django.core.cache import cache
from django.db.models import Count, Q

from apps.movies.models import Movie

# Quantos recortes o programa do dia tem.
#
# Seis porque a home já tem hero e "em projeção agora" acima deles: mais que
# isso e a página vira rolagem infinita, que é exatamente o que uma cinemateca
# não é.
QUANTOS_RECORTES = 6

# Quantos filmes por recorte.
POR_RECORTE = 8

# De onde sortear.
#
# Um filme sorteado uniformemente entre 25.908 é quase sempre obscuro — o
# acervo tem cauda longa de curtas experimentais e registros. Restringir ao topo
# do ranking é o que faz o sorteio produzir uma PROGRAMAÇÃO em vez de uma
# amostra estatística. O número é generoso: 4.000 filmes dão variedade de sobra
# para seis recortes de oito.
TETO_DO_SORTEIO = 4000

# Mínimo de obra NO TOPO para uma retrospectiva fazer sentido.
#
# O "no topo" é a parte que importa, e foi aprendida errando: contar sobre o
# acervo inteiro dá 389 diretores e sorteia Ernest R. Dickerson; contar só entre
# os 4.000 primeiros do ranking dá 95 e sorteia Godard, Hitchcock, Ford, Hawks,
# Lang, Truffaut, Wilder, Renoir. Mesmo código, candidatos completamente
# diferentes — e uma retrospectiva é um convite, não uma amostra.
MINIMO_PARA_RETROSPECTIVA = 8

# OS ASSUNTOS QUE VALE PROGRAMAR, e o nome que eles ganham na tela.
#
# Esta lista é CURADA de propósito, e não deduzida. Tentei três heurísticas
# antes — mínimo de ocorrências, tamanho da palavra, "tem espaço no meio" — e
# todas deixavam passar coisas que não são assunto nenhum: a home chegou a
# abrir uma seção chamada "Callous", outra "Artist" e outra "California". As
# 21.439 keywords do acervo vêm do TMDB e misturam tema, lugar, década, adjetivo
# e metadado de catálogo; nenhuma regra automática separa "film noir" de
# "aggressive".
#
# Programar é escolher. Uma cinemateca não gera sua programação por regra, e a
# lista ficar aqui — legível, revisável, com o número medido ao lado — é mais
# honesto que uma heurística que finge decidir sozinha.
#
# A contagem é de filmes NO TOPO do ranking (os 4.000 primeiros), medida em
# 2026-09-18. Serve para saber quais dão oito filmes com folga.
TEMAS_PROGRAMAVEIS = {
    'film noir': 'Film Noir',                          # 88
    'neo-noir': 'Neo-Noir',                            # 72
    'screwball comedy': 'Comédia Maluca',              # 45
    'psychological thriller': 'Suspense Psicológico',  # 47
    'period drama': 'Drama de Época',                  # 48
    'coming of age': 'Passagem para a Vida Adulta',    # 97
    'world war ii': 'A Segunda Guerra',                # 116
    'new york city': 'Nova York',                      # 148
    'paris, france': 'Paris',                          # 123
    'tokyo, japan': 'Tóquio',                          # 60
    'london, england': 'Londres',                      # 84
    '19th century': 'O Século XIX',                    # 58
    'murder': 'Assassinato',                           # 176
    'revenge': 'Vingança',                             # 96
    'musical': 'Musical',                              # 112
    'lgbt': 'Cinema LGBT',                             # 98
    'gay theme': 'Desejo entre Homens',                # 92
    'surrealism': 'Surrealismo',                       # 80
    'gangster': 'Gângsteres',                          # 68
    'satire': 'Sátira',                                # 67
    'prison': 'Prisão',                                # 63
    'adultery': 'Adultério',                           # 57
    'suicide': 'Suicídio',                             # 77
    'friendship': 'Amizade',                           # 76
    'family relationships': 'Laços de Família',        # 52
    'husband wife relationship': 'Marido e Mulher',    # 45
    'loss of loved one': 'A Perda de Alguém',          # 46
    'rural area': 'O Campo',                           # 44
    'love': 'Amor',                                    # 120
}



def _semente(dia: date, sal: str = '') -> random.Random:
    """
    O acaso do dia, reprodutível.

    `hash()` do Python NÃO serve aqui: ele é aleatorizado por processo desde o
    3.3, então dois workers Django dariam programas diferentes para o mesmo dia
    — e a home mudaria conforme quem atendesse a requisição.
    """
    bruto = f'{dia.isoformat()}:{sal}'.encode()
    return random.Random(int(hashlib.sha256(bruto).hexdigest()[:16], 16))


# De quantos candidatos cada recorte sorteia os seus oito.
#
# O queryset já vem ordenado por ranking, então isto é "sorteie entre os N
# melhores DESTE recorte". Aprendido errando: sorteando entre 4.000, "Os anos
# 1980" abria com um filme que ninguém conhece. Com 120, sobra variedade
# (120 escolhe 8 são bilhões de combinações) e o que entra é defensável.
BANDA_DO_RECORTE = 120


def _sorteia(queryset, sorteio: random.Random, quantos: int = POR_RECORTE,
             banda: int = BANDA_DO_RECORTE) -> list:
    """
    Alguns filmes do recorte, sem `ORDER BY ?`.

    `order_by('?')` no Postgres ordena a tabela inteira para devolver oito
    linhas. Aqui só os IDs viajam, o embaralhamento é em memória com a semente
    do dia, e a segunda consulta busca oito linhas por chave primária.
    """
    ids = list(queryset.values_list('id', flat=True)[:banda])
    if not ids:
        return []
    sorteio.shuffle(ids)
    escolhidos = ids[:quantos]

    # A ordem do `IN` não é a do shuffle, e reordenar em memória preserva o
    # sorteio — senão o Postgres devolve na ordem que quiser e dois recortes
    # com os mesmos filmes sairiam iguais.
    por_id = {m.id: m for m in Movie.objects.filter(id__in=escolhidos)}
    return [por_id[i] for i in escolhidos if i in por_id]


def _bons(**filtros):
    """Os candidatos de um recorte: o topo do ranking que satisfaz o filtro."""
    return (Movie.objects
            .filter(ranking_current__isnull=False, **filtros)
            .order_by('ranking_current'))


# ── os recortes ───────────────────────────────────────────────────────────
#
# Cada um devolve `{titulo, subtitulo, filmes}` ou None quando não há material.
# Devolver None é a resposta certa: um recorte vazio na tela é pior que um
# recorte a menos, e já aconteceu neste projeto.


def _obras_primas(sorteio):
    filmes = _sorteia(_bons(ranking_current__lte=300), sorteio)
    if not filmes:
        return None
    return {'chave': 'obras-primas', 'titulo': 'Obras-Primas do Acervo',
            'subtitulo': 'AS TREZENTAS PRIMEIRAS DO RANKING',
            'filmes': filmes}


def _retrospectiva(sorteio, campo, titulo_fmt, subtitulo):
    """
    Um autor com obra o bastante — NO TOPO DO RANKING — para uma retrospectiva.

    O recorte do `ranking_current__lte` aqui não é otimização: é o que separa
    "quem fez muitos filmes" de "quem fez filmes que importam". Ver o comentário
    de MINIMO_PARA_RETROSPECTIVA.
    """
    nomes = list(
        Movie.objects
        .filter(ranking_current__lte=TETO_DO_SORTEIO)
        .exclude(**{f'{campo}__isnull': True}).exclude(**{campo: ''})
        .values_list(campo, flat=True)
        .annotate(n=Count('id')).filter(n__gte=MINIMO_PARA_RETROSPECTIVA))
    if not nomes:
        return None
    # `sorted` antes do sorteio: a ordem que o Postgres devolve não é estável
    # entre execuções, e sem isto o "mesmo dia, mesmo programa" deixaria de
    # valer — o mesmo defeito da consulta fatiada sem ORDER BY.
    nome = sorteio.choice(sorted(nomes))
    # Aqui a banda é larga de propósito: o autor já é o recorte, e limitar
    # aos 120 melhores dele esconderia justamente a obra menos óbvia.
    filmes = _sorteia(_bons(**{campo: nome}), sorteio, banda=TETO_DO_SORTEIO)
    if not filmes:
        return None
    return {'chave': f'retrospectiva-{campo}', 'titulo': titulo_fmt.format(nome),
            'subtitulo': subtitulo, 'filmes': filmes}


def _direcao(sorteio):
    return _retrospectiva(sorteio, 'director', 'Retrospectiva {}',
                          'A OBRA DE UM DIRETOR')


def _fotografia(sorteio):
    return _retrospectiva(sorteio, 'cinematographer', 'O olhar de {}',
                          'DIREÇÃO DE FOTOGRAFIA')


def _trilha(sorteio):
    return _retrospectiva(sorteio, 'composer', 'A música de {}',
                          'TRILHA ORIGINAL')


def _preto_e_branco(sorteio):
    filmes = _sorteia(_bons(color='BW'), sorteio)
    if not filmes:
        return None
    return {'chave': 'preto-e-branco', 'titulo': 'Em Preto e Branco',
            'subtitulo': 'SEIS MIL E QUATROCENTOS FILMES SEM COR',
            'filmes': filmes}


def _curtas(sorteio):
    filmes = _sorteia(_bons(length_minutes__lt=40, length_minutes__gt=0), sorteio)
    if not filmes:
        return None
    return {'chave': 'curtas', 'titulo': 'Curtas', 'subtitulo': 'MENOS DE QUARENTA MINUTOS',
            'filmes': filmes}


def _uma_decada(sorteio):
    decada = sorteio.choice([1920, 1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010])
    filmes = _sorteia(_bons(year__gte=decada, year__lt=decada + 10), sorteio)
    if not filmes:
        return None
    return {'chave': f'decada-{decada}', 'titulo': f'Os anos {decada}',
            'subtitulo': 'UMA DÉCADA', 'filmes': filmes}


def _um_tema(sorteio):
    """
    Um assunto, vindo das keywords.

    Medido: 19.298 filmes (74,5%) têm keywords, 454 delas com ≥50 filmes. É o
    campo mais fértil do acervo para recortes — e o único que produz agrupamentos
    que não são nem gênero nem época.
    """
    tema = sorteio.choice(sorted(TEMAS_PROGRAMAVEIS))
    filmes = _sorteia(_bons(keywords__contains=[tema]), sorteio)
    if not filmes:
        return None
    return {'chave': f'tema-{tema}', 'titulo': TEMAS_PROGRAMAVEIS[tema],
            'subtitulo': 'UM ASSUNTO', 'filmes': filmes}


def _laureados(sorteio):
    """Filmes com ao menos uma vitória em festival. Medido: 3.575."""
    filmes = _sorteia(_bons(festivals__icontains='Vencedor'), sorteio)
    if not filmes:
        return None
    return {'chave': 'laureados', 'titulo': 'Laureados',
            'subtitulo': 'VENCERAM EM ALGUM FESTIVAL', 'filmes': filmes}


RECORTES = [
    _obras_primas, _direcao, _fotografia, _trilha,
    _preto_e_branco, _curtas, _uma_decada, _um_tema, _laureados,
]

# Este vem sempre, e primeiro: é a âncora do programa.
SEMPRE = _obras_primas


def ordem_dos_recortes(dia: date) -> list:
    """
    Em que ordem os recortes são tentados neste dia.

    Tem nome próprio para poder ser testada: um teste que olhasse só o
    programa final não alcança esta função, porque um recorte sem material
    é pulado e o conjunto final varia mesmo com a ordem congelada.
    """
    sorteio = _semente(dia, 'programa')
    ordem = [r for r in RECORTES if r is not SEMPRE]
    sorteio.shuffle(ordem)
    return ordem


def monta_programa(dia: date | None = None) -> dict:
    """
    O programa de um dia. Mesma data, mesmo programa.

    Os recortes que falharem por falta de material são simplesmente omitidos —
    um recorte vazio na tela é pior que um recorte a menos.
    """
    dia = dia or date.today()
    ordem = ordem_dos_recortes(dia)

    secoes = []
    for recorte in [SEMPRE] + ordem:
        if len(secoes) >= QUANTOS_RECORTES:
            break
        try:
            secao = recorte(_semente(dia, recorte.__name__))
        except Exception:  # noqa: BLE001 — um recorte quebrado não derruba a home
            secao = None
        if secao and secao['filmes']:
            secoes.append(secao)

    return {'dia': dia.isoformat(), 'secoes': secoes}


# O programa é o mesmo o dia inteiro, então calculá-lo a cada carga da home é
# trabalho repetido. Uma hora de cache é folgado e sobrevive a um deploy.
SEGUNDOS_DE_CACHE = 3600


def programa_do_dia(dia: date | None = None) -> dict:
    dia = dia or date.today()
    chave = f'programa:{dia.isoformat()}'
    guardado = cache.get(chave)
    if guardado is not None:
        return guardado
    montado = monta_programa(dia)
    cache.set(chave, montado, SEGUNDOS_DE_CACHE)
    return montado
