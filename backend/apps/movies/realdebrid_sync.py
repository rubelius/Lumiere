"""
Traz o conteúdo já presente na conta Real-Debrid para o acervo.

O pipeline existente só corre numa direção — Prowlarr acha, cria o release,
envia para o Real-Debrid. O que já estava na conta, adicionado por fora, era
invisível para o Lumière, e por isso o primeiro degrau da cadeia de reprodução
nunca disparava.

Casamento é conservador de propósito: só IMDb ID ou título exato + ano. Nada
de substring — ligar um release ao filme errado faria o player tocar outra
obra, o que é pior do que não ligar.

A lógica vive aqui, e não no comando, porque roda dos dois lados: pelo CLI
(`manage.py sync_realdebrid`) e pelo Celery beat.
"""

import logging
from dataclasses import dataclass, field
from typing import List, Optional

from asgiref.sync import async_to_sync
from django.conf import settings
from django.db.models import Q

from apps.integrations.realdebrid import RealDebridClient
from apps.movies.models import Movie, TorrentRelease
from apps.movies.release_naming import extrai_imdb_id, extrai_titulo_e_ano, parece_serie
from apps.movies.utils import calculate_quality_score, parse_quality_from_title

logger = logging.getLogger(__name__)


@dataclass
class ResultadoDaSincronizacao:
    total_na_conta: int = 0
    ligados: int = 0
    atualizados: int = 0
    series: int = 0
    incompletos: int = 0
    sem_casamento: int = 0
    # Consultas de link que a API não respondeu. Esses registros foram
    # atualizados sem tocar nos links, então o número precisa aparecer: é a
    # diferença entre "o filme não tem link" e "não deu para perguntar".
    links_nao_consultados: int = 0
    nao_casados: List[str] = field(default_factory=list)
    ligacoes: List[str] = field(default_factory=list)


def casa_com_filme(nome: str) -> Optional[Movie]:
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


def rotulo_de_qualidade(release: TorrentRelease) -> str:
    """Resumo curto para a interface, ex.: 'REMUX 2160p DV ATMOS'."""
    partes = []
    if release.is_remux:
        partes.append('REMUX')
    if release.resolution:
        partes.append(release.resolution)
    if release.has_dolby_vision:
        partes.append('DV')
    elif release.has_hdr:
        partes.append('HDR')
    if release.has_atmos:
        partes.append('ATMOS')
    return ' '.join(partes)[:100]


async def _busca_torrents(chave: str, limite: int):
    cliente = RealDebridClient(chave)
    try:
        return await cliente.list_torrents(limit=limite)
    finally:
        await cliente.close()


async def _busca_links(chave: str, ids):
    """
    GET /torrents devolve `links` vazio; só GET /torrents/info/{id} os traz, e
    sem eles o degrau Real-Debrid não resolve. Uma chamada por item casado.

    Devolve só as consultas que responderam. `get_torrent_info` engole erro de
    HTTP e devolve {} — dict vazio é "não sei", não "não tem links", e tratar
    os dois como a mesma coisa apagava os links bons que já estavam gravados.
    """
    cliente = RealDebridClient(chave)
    try:
        achados = {}
        for i in ids:
            info = await cliente.get_torrent_info(i)
            if info:
                achados[i] = info.get('links') or []
        return achados
    finally:
        await cliente.close()


def sincroniza_realdebrid(limite: int = 200, dry_run: bool = False) -> ResultadoDaSincronizacao:
    chave = settings.REAL_DEBRID_API_KEY
    if not chave:
        raise RuntimeError('REAL_DEBRID_API_KEY não configurada.')

    torrents = async_to_sync(_busca_torrents)(chave, limite)
    r = ResultadoDaSincronizacao(total_na_conta=len(torrents))
    casados = []

    for t in torrents:
        nome = t.get('filename') or ''

        if t.get('status') != 'downloaded':
            r.incompletos += 1
            continue
        if parece_serie(nome):
            r.series += 1
            continue

        filme = casa_com_filme(nome)
        if not filme:
            r.sem_casamento += 1
            r.nao_casados.append(nome)
            continue

        if dry_run:
            r.ligados += 1
            r.ligacoes.append(f'{nome[:58]} -> {filme.title} ({filme.year})')
            continue

        casados.append((filme, t, nome))

    if casados:
        links_por_id = async_to_sync(_busca_links)(chave, [t['id'] for _, t, _ in casados])
        for filme, t, nome in casados:
            # Ausente do dicionário = a consulta falhou. Nesse caso o registro
            # é atualizado sem tocar em realdebrid_links, preservando o que já
            # estava lá; a reprodução não pode cair por causa de um blip de rede.
            sabemos = t['id'] in links_por_id
            if sabemos:
                t['links'] = links_por_id[t['id']]
            else:
                r.links_nao_consultados += 1
            _, foi_criado = _grava(filme, t, nome, grava_links=sabemos)
            if foi_criado:
                r.ligados += 1
                r.ligacoes.append(f'{filme.title} ({filme.year}) — {len(t["links"])} link(s)')
            else:
                r.atualizados += 1

        _atualiza_resumo_dos_filmes({f.id for f, _, _ in casados})

    return r


def monta_campos(filme, torrent, nome, grava_links: bool = True) -> dict:
    """
    Campos gravados no TorrentRelease.

    `grava_links=False` omite realdebrid_links de propósito, e essa omissão é
    o ponto: em update_or_create, o que não está em defaults não é tocado.
    Incluir a chave com lista vazia apagaria os links bons quando a API só
    tivesse deixado de responder.
    """
    qualidade = parse_quality_from_title(nome)
    dados = {
        'movie': filme,
        'title': nome[:500],
        'size_bytes': torrent.get('bytes') or 0,
        'in_realdebrid': True,
        'realdebrid_id': torrent.get('id', ''),
        'realdebrid_status': torrent.get('status', ''),
        'realdebrid_progress': torrent.get('progress', 0),
        # Já baixado na conta: reproduz na hora, sem espera.
        'instantly_available': True,
        **qualidade,
    }
    if grava_links:
        dados['realdebrid_links'] = torrent.get('links') or []

    dados.update(calculate_quality_score(dados))
    return dados


def _grava(filme, torrent, nome, grava_links: bool = True):
    return TorrentRelease.objects.update_or_create(
        info_hash=torrent['hash'].lower(),
        defaults=monta_campos(filme, torrent, nome, grava_links),
    )


def _atualiza_resumo_dos_filmes(ids):
    """
    Reflete no filme a melhor cópia que ele passou a ter. Sem isto o player
    mostra "SEM MÍDIA" enquanto toca um REMUX 2160p: best_quality_available é
    o que a interface lê, e ficava vazio.
    """
    for filme in Movie.objects.filter(id__in=ids):
        melhor = filme.torrent_releases.order_by('-quality_score').first()
        if not melhor:
            continue
        filme.best_quality_available = rotulo_de_qualidade(melhor)
        filme.current_quality_score = melhor.quality_score
        filme.save(update_fields=['best_quality_available', 'current_quality_score'])
