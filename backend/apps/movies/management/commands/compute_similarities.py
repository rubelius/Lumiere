"""
CLI do cálculo de similaridades. A lógica vive em apps/ml/similarity.py,
porque a task periódica roda a mesma coisa.
"""

from django.core.management.base import BaseCommand

from apps.ml.similarity import calcula_para_filme, filmes_pendentes


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

    def handle(self, *args, **opts):
        pendentes = list(filmes_pendentes(opts['limit']))
        total = len(pendentes)

        if not total:
            self.stdout.write(self.style.SUCCESS(
                'Nenhum filme pendente. Rode generate_embbedings primeiro se '
                'ainda houver filmes sem embedding.'
            ))
            return

        self.stdout.write(f'Calculando similaridades para {total} filme(s)...')
        gravadas = 0
        for i, filme in enumerate(pendentes, 1):
            gravadas += calcula_para_filme(filme, top_n=opts['top_n'])
            if i % 100 == 0 or i == total:
                self.stdout.write(f'  {i}/{total} — {gravadas} relações gravadas')

        self.stdout.write(self.style.SUCCESS(
            f'✓ {gravadas} relações para {total} filme(s)'
        ))
