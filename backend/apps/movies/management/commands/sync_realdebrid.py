"""
Traz o conteúdo já presente na conta Real-Debrid para o acervo.

O pipeline existente só corre numa direção — Prowlarr acha, cria o release,
envia para o Real-Debrid. O que já estava na conta, adicionado por fora, era
invisível para o Lumière, e por isso o primeiro degrau da cadeia de reprodução
nunca disparava.

Casamento é conservador de propósito: só IMDb ID ou título exato + ano. Nada
de substring — ligar um release ao filme errado faria o player tocar outra
obra, o que é pior do que não ligar. O que não casar é listado para inspeção.
"""

import asyncio

from asgiref.sync import async_to_sync
from django.conf import settings
from django.core.management.base import BaseCommand
from django.db.models import Q

from apps.integrations.realdebrid import RealDebridClient
from apps.movies.models import Movie, TorrentRelease
from apps.movies.release_naming import extrai_imdb_id, extrai_titulo_e_ano, parece_serie
from apps.movies.utils import calculate_quality_score, parse_quality_from_title


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
        chave = settings.REAL_DEBRID_API_KEY
        if not chave:
            self.stderr.write(self.style.ERROR('REAL_DEBRID_API_KEY não configurada.'))
            return

        torrents = async_to_sync(self._buscar)(chave, opts['limit'])
        self.stdout.write(f'{len(torrents)} torrent(s) na conta Real-Debrid.\n')

        criados = atualizados = series = sem_casamento = incompletos = 0
        nao_casados = []
        casados = []

        for t in torrents:
            nome = t.get('filename') or ''

            if t.get('status') != 'downloaded':
                incompletos += 1
                continue

            if parece_serie(nome):
                series += 1
                continue

            filme = self._casar(nome)
            if not filme:
                sem_casamento += 1
                nao_casados.append(nome)
                continue

            if opts['dry_run']:
                self.stdout.write(f'  [seria ligado] {nome[:58]} -> {filme.title} ({filme.year})')
                criados += 1
                continue

            casados.append((filme, t, nome))

        if casados:
            # A listagem devolve `links` vazio: só GET /torrents/info/{id} os
            # traz. Uma chamada por item casado — e não pelos 200 da conta.
            links_por_id = async_to_sync(self._links)(chave, [t['id'] for _, t, _ in casados])
            for filme, t, nome in casados:
                t['links'] = links_por_id.get(t['id'], [])
                _, foi_criado = self._gravar(filme, t, nome)
                if foi_criado:
                    criados += 1
                    self.stdout.write(self.style.SUCCESS(
                        f'  + {filme.title} ({filme.year}) — {len(t["links"])} link(s)'))
                else:
                    atualizados += 1

            self._atualiza_resumo_dos_filmes({f.id for f, _, _ in casados})

        self._resumo(criados, atualizados, series, incompletos, sem_casamento, nao_casados, opts['dry_run'])

    async def _buscar(self, chave, limite):
        cliente = RealDebridClient(chave)
        try:
            return await cliente.list_torrents(limit=limite)
        finally:
            await cliente.close()

    async def _links(self, chave, ids):
        """Links de download por torrent. Vazios na listagem; só o info os traz."""
        cliente = RealDebridClient(chave)
        try:
            resultado = {}
            for torrent_id in ids:
                info = await cliente.get_torrent_info(torrent_id)
                resultado[torrent_id] = info.get('links') or []
            return resultado
        finally:
            await cliente.close()

    def _casar(self, nome):
        """IMDb ID primeiro; depois título exato + ano. Nunca substring."""
        imdb = extrai_imdb_id(nome)
        if imdb:
            filme = Movie.objects.filter(imdb_id__iexact=imdb).first()
            if filme:
                return filme

        extraido = extrai_titulo_e_ano(nome)
        if not extraido:
            return None

        titulo, ano = extraido
        return Movie.objects.filter(
            Q(title__iexact=titulo) | Q(original_title__iexact=titulo),
            year=ano,
        ).first()

    def _gravar(self, filme, torrent, nome):
        qualidade = parse_quality_from_title(nome)
        dados = {
            'movie': filme,
            'title': nome[:500],
            'size_bytes': torrent.get('bytes') or 0,
            'in_realdebrid': True,
            'realdebrid_id': torrent.get('id', ''),
            'realdebrid_status': torrent.get('status', ''),
            'realdebrid_progress': torrent.get('progress', 0),
            'realdebrid_links': torrent.get('links') or [],
            # Já baixado na conta: reproduz na hora, sem espera.
            'instantly_available': True,
            **qualidade,
        }
        dados.update(calculate_quality_score(dados))

        return TorrentRelease.objects.update_or_create(
            info_hash=torrent['hash'].lower(), defaults=dados,
        )

    def _atualiza_resumo_dos_filmes(self, ids):
        """
        Reflete no filme a melhor cópia que ele passou a ter.

        Sem isto o player mostra "SEM MÍDIA" enquanto toca um REMUX 2160p:
        best_quality_available é o que a interface lê, e ficava vazio.
        """
        for filme in Movie.objects.filter(id__in=ids):
            melhor = filme.torrent_releases.order_by('-quality_score').first()
            if not melhor:
                continue

            partes = []
            if melhor.is_remux:
                partes.append('REMUX')
            if melhor.resolution:
                partes.append(melhor.resolution)
            if melhor.has_dolby_vision:
                partes.append('DV')
            elif melhor.has_hdr:
                partes.append('HDR')
            if melhor.has_atmos:
                partes.append('ATMOS')

            filme.best_quality_available = ' '.join(partes)[:100]
            filme.current_quality_score = melhor.quality_score
            filme.save(update_fields=['best_quality_available', 'current_quality_score'])

    def _resumo(self, criados, atualizados, series, incompletos, sem_casamento, nao_casados, dry_run):
        self.stdout.write('')
        rotulo = 'seriam ligados' if dry_run else 'ligados'
        self.stdout.write(self.style.SUCCESS(f'{rotulo}: {criados}'))
        if atualizados:
            self.stdout.write(f'atualizados: {atualizados}')
        self.stdout.write(f'ignorados por serem série: {series}')
        if incompletos:
            self.stdout.write(f'ignorados por não estarem baixados: {incompletos}')
        self.stdout.write(self.style.WARNING(f'sem correspondência no acervo: {sem_casamento}'))

        for nome in nao_casados[:15]:
            self.stdout.write(f'    ? {nome[:70]}')
        if len(nao_casados) > 15:
            self.stdout.write(f'    ... e mais {len(nao_casados) - 15}')

        if dry_run:
            self.stdout.write(self.style.NOTICE('\nNada foi gravado (--dry-run).'))
