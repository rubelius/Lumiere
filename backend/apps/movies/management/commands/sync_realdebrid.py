"""
CLI da sincronização com o Real-Debrid.

A lógica vive em apps/movies/realdebrid_sync.py, porque o Celery beat roda a
mesma coisa sem passar por aqui.
"""

from django.core.management.base import BaseCommand

from apps.movies.realdebrid_sync import sincroniza_realdebrid


class Command(BaseCommand):
    help = 'Sincroniza os torrents da conta Real-Debrid com o acervo local.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run', action='store_true',
            help='Mostra o que seria feito sem gravar nada.',
        )
        parser.add_argument(
            '--limit', type=int, default=200,
            help='Quantos torrents buscar na conta (padrão: 200).',
        )

    def handle(self, *args, **opts):
        try:
            r = sincroniza_realdebrid(limite=opts['limit'], dry_run=opts['dry_run'])
        except RuntimeError as e:
            self.stderr.write(self.style.ERROR(str(e)))
            return

        self.stdout.write(f'{r.total_na_conta} torrent(s) na conta Real-Debrid.\n')

        prefixo = '  [seria ligado] ' if opts['dry_run'] else '  + '
        for linha in r.ligacoes:
            self.stdout.write(self.style.SUCCESS(f'{prefixo}{linha}'))

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(
            f'{"seriam ligados" if opts["dry_run"] else "ligados"}: {r.ligados}'))
        if r.atualizados:
            self.stdout.write(f'atualizados: {r.atualizados}')
        self.stdout.write(f'ignorados por serem série: {r.series}')
        if r.incompletos:
            self.stdout.write(f'ignorados por não estarem baixados: {r.incompletos}')
        self.stdout.write(self.style.WARNING(f'sem correspondência no acervo: {r.sem_casamento}'))

        for nome in r.nao_casados[:15]:
            self.stdout.write(f'    ? {nome[:70]}')
        if len(r.nao_casados) > 15:
            self.stdout.write(f'    ... e mais {len(r.nao_casados) - 15}')

        if opts['dry_run']:
            self.stdout.write(self.style.NOTICE('\nNada foi gravado (--dry-run).'))
