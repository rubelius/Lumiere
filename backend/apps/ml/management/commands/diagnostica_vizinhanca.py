"""
Mede os vícios da vizinhança, que o benchmark de modelos não enxerga.

`benchmark_embeddings` pontua por coleção e por diretor. As duas coisas são
verdade-base convenientes — o acervo já as conhece — mas premiam justamente o
que estraga a curadoria: recuperar a sequência de uma franquia e recuperar a
filmografia do diretor. Um recomendador que devolve 'Cidadão Kane' -> 'RKO
281: A Batalha de Cidadão Kane' pontua bem e não serve para nada.

Este comando mede o contrário: quanto da vizinhança é nome próprio vazando —
palavra do título e nome do diretor — em vez da obra em si.

    manage.py diagnostica_vizinhanca --receita atual
    manage.py diagnostica_vizinhanca --receita sem_titulo

Compare as saídas. Rodar com --exemplos mostra a vizinhança de filmes
canônicos, que é onde o vício aparece a olho nu.
"""

import gc
import re
from collections import Counter, defaultdict

import numpy as np
from django.core.management.base import BaseCommand

from apps.ml.constants import EMBEDDING_MODEL
from apps.ml.embedding import RECEITAS, monta_texto
from apps.movies.models import Movie

# Artigos e preposições casam entre quaisquer dois títulos e inflariam a
# medida sem indicar parentesco nenhum.
PARADAS = {
    'de', 'da', 'do', 'das', 'dos', 'a', 'o', 'os', 'as', 'e', 'em', 'um',
    'uma', 'no', 'na', 'nos', 'nas', 'com', 'por', 'para', 'que',
    'the', 'of', 'and', 'in', 'to', 'at', 'on', 'für', 'und',
    'le', 'la', 'les', 'un', 'une', 'des', 'el', 'los', 'y',
    'der', 'die', 'das', 'il', 'lo', 'gli',
}

EXEMPLOS = ['Cidadão Kane', 'Um Corpo Que Cai', '2001', 'Cidade de Deus',
            'Stalker', 'Blade Runner']


def tokens(titulo: str) -> set:
    return {p for p in re.findall(r'\w+', (titulo or '').lower())
            if len(p) > 2 and p not in PARADAS}


class Command(BaseCommand):
    help = 'Mede quanto da vizinhança é nome próprio vazando, por receita.'

    def add_arguments(self, parser):
        parser.add_argument('--receita', default='atual', choices=sorted(RECEITAS))
        parser.add_argument(
            '--pool', type=int, default=4000,
            help='Quantos filmes, em ordem de ranking TSPDT. O vício aparece '
                 'no cânone, onde os diretores têm filmografia grande.',
        )
        parser.add_argument('--k', type=int, default=10)
        parser.add_argument('--batch', type=int, default=16)
        parser.add_argument('--exemplos', action='store_true',
                            help='Mostra a vizinhança de alguns filmes canônicos.')

    def handle(self, *args, **opts):
        from sentence_transformers import SentenceTransformer

        filmes = list(
            Movie.objects.exclude(director='')
            .order_by('ranking_current')[:opts['pool']]
        )
        self.stdout.write(f'{len(filmes)} filmes | receita: {opts["receita"]} | '
                          f'modelo: {EMBEDDING_MODEL}\n')

        textos = [
            monta_texto({
                'title': f.title, 'overview': f.overview or '',
                'director': f.director or '', 'genres': f.genres or [],
                'themes': f.themes or [], 'moods': f.moods or [],
                'keywords': f.keywords or [], 'year': f.year or '',
                'country': f.country or '', 'cast': f.cast or [],
            }, opts['receita'])
            for f in filmes
        ]

        modelo = SentenceTransformer(EMBEDDING_MODEL)
        vetores = modelo.encode(textos, batch_size=opts['batch'],
                                convert_to_numpy=True, normalize_embeddings=True,
                                show_progress_bar=False)
        del modelo
        gc.collect()

        k = opts['k']
        sim = vetores @ vetores.T
        np.fill_diagonal(sim, -np.inf)          # ninguém é vizinho de si mesmo
        vizinhos = np.argpartition(-sim, k, axis=1)[:, :k]
        # argpartition não ordena dentro da fatia; ordenar importa para os exemplos.
        vizinhos = np.take_along_axis(
            vizinhos, np.argsort(-np.take_along_axis(sim, vizinhos, 1), axis=1), axis=1)

        self._relata(filmes, vizinhos, sim, k, opts['exemplos'])

    def _relata(self, filmes, vizinhos, sim, k, mostrar_exemplos):
        tam_filmografia = Counter(f.director for f in filmes)
        toks = [tokens(f.title) for f in filmes]

        por_faixa = defaultdict(lambda: [0, 0, 0])   # soma, dominadas, n
        titulo = ano5 = 0.0

        for i, f in enumerate(filmes):
            viz = vizinhos[i]
            mesmo_dir = sum(1 for j in viz if filmes[j].director == f.director)
            titulo += sum(1 for j in viz if toks[i] & toks[j]) / k
            if f.year:
                ano5 += sum(1 for j in viz
                            if filmes[j].year and abs(filmes[j].year - f.year) <= 5) / k

            n = tam_filmografia[f.director]
            faixa = ('1-2' if n <= 2 else '3-9' if n <= 9
                     else '10-24' if n <= 24 else '25+')
            por_faixa[faixa][0] += mesmo_dir / k
            por_faixa[faixa][1] += mesmo_dir >= k / 2
            por_faixa[faixa][2] += 1

        total = len(filmes)
        dir_geral = sum(v[0] for v in por_faixa.values()) / total

        self.stdout.write('vício medido (menor é melhor):')
        self.stdout.write(f'  palavra do título compartilhada: {titulo / total:>7.1%}')
        self.stdout.write(f'  mesmo diretor:                   {dir_geral:>7.1%}')
        self.stdout.write(f'  dentro de 5 anos:                {ano5 / total:>7.1%}\n')

        self.stdout.write('mesmo diretor, por tamanho da filmografia no recorte:')
        for faixa in ('1-2', '3-9', '10-24', '25+'):
            soma, dom, n = por_faixa[faixa]
            if n:
                self.stdout.write(
                    f'  {faixa:<6} ({n:>4} filmes): {soma / n:>6.1%}'
                    f'  | listas dominadas: {dom * 100 // n:>3}%')

        if not mostrar_exemplos:
            return

        indice = {}
        for i, f in enumerate(filmes):
            for alvo in EXEMPLOS:
                if alvo.lower() in f.title.lower() and alvo not in indice:
                    indice[alvo] = i

        for alvo, i in indice.items():
            f = filmes[i]
            self.stdout.write(f'\n{f.title} ({f.year}) — {f.director}')
            for j in vizinhos[i][:6]:
                v = filmes[j]
                self.stdout.write(
                    f'   {sim[i, j]:.3f}  {v.title[:44]:<44} {str(v.director)[:20]}')
