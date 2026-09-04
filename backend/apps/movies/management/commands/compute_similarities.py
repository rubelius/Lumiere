"""
CLI do cálculo de similaridades. A lógica vive em apps/ml/similarity.py,
porque a task periódica roda a mesma coisa.

A task avança 500 filmes por hora, ritmo pensado para um acervo que cresce aos
poucos. Depois de trocar o modelo de embedding os ~26 mil filmes ficam
pendentes de uma vez, e nesse ritmo seriam mais de dois dias — daí este
comando, que faz o acervo inteiro numa execução.
"""

import time

from django.core.management.base import BaseCommand

from apps.ml.constants import EMBEDDING_MODEL
from apps.ml.similarity import calcula_para_filme, ids_para_calcular
from apps.movies.models import Movie


class Command(BaseCommand):
    help = 'Calcula as similaridades entre filmes a partir dos embeddings.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--limit', type=int, default=None,
            help='Quantos filmes processar (padrão: todos os pendentes).',
        )
        parser.add_argument(
            '--top-n', type=int, default=50,
            help='Quantos vizinhos guardar por filme (padrão: 50).',
        )
        parser.add_argument(
            '--refazer', action='store_true',
            help='Recalcula também quem já tem similaridades, necessário '
                 'depois de trocar o modelo de embedding.',
        )

    def handle(self, *args, **opts):
        ids = ids_para_calcular(refazer=opts['refazer'], limite=opts['limit'])
        total = len(ids)

        if not total:
            self.stdout.write(self.style.SUCCESS(
                'Nenhum filme pendente. Rode generate_embbedings primeiro se '
                'ainda houver filmes sem embedding.'
            ))
            return

        self.stdout.write(
            f'Calculando similaridades para {total} filme(s) com {EMBEDDING_MODEL}...')

        inicio = time.monotonic()
        gravadas = falhas = 0

        for i, movie_id in enumerate(ids, 1):
            try:
                gravadas += calcula_para_filme(
                    Movie.objects.get(id=movie_id), top_n=opts['top_n'])
            except Exception as e:
                # Um filme problemático não pode derrubar o acervo inteiro no
                # meio de um backfill de horas.
                falhas += 1
                self.stderr.write(self.style.ERROR(f'  ! {movie_id}: {e}'))

            if i % 100 == 0 or i == total:
                ritmo = i / (time.monotonic() - inicio)
                self.stdout.write(
                    f'  {i}/{total} — {gravadas} relações '
                    f'({ritmo:.1f}/s, ~{(total - i) / ritmo / 60:.0f} min restantes)')

        self.stdout.write(self.style.SUCCESS(
            f'✓ {gravadas} relações para {total - falhas} filme(s) '
            f'em {(time.monotonic() - inicio) / 60:.1f} min'
        ))
        if falhas:
            self.stdout.write(self.style.WARNING(f'{falhas} falha(s).'))
