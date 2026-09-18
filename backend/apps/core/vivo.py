"""
O que está acontecendo AGORA. Não passa pelo cache do painel.

O resto do painel é retrato: números que mudam devagar e ficam guardados 60
segundos. Isto aqui é o contrário — é o que a pessoa olha enquanto espera, e um
número de um minuto atrás aqui é inútil.

O relato que originou o arquivo: apertar "rastrear cópias agora" enfileirava o
trabalho e a tela não dizia mais nada. Nem o progresso, nem a fila, nem em que
filme estava, nem quantas cópias tinha achado.
"""

import logging
from datetime import timedelta

from django.utils import timezone

logger = logging.getLogger(__name__)

# Quanto esperar o Celery responder a um `inspect`.
#
# Curto de propósito: sem worker, `inspect` espera o timeout inteiro, e é
# exatamente quando não há worker que a pessoa está olhando esta tela.
SEGUNDOS_PARA_INSPECIONAR = 1.5


def _profundidade_das_filas() -> dict:
    """
    Quantas tarefas esperando em cada fila.

    Lê o Redis direto: o `inspect` do Celery conhece o que os WORKERS têm, e
    uma fila com mil itens e nenhum worker é justamente o caso em que o inspect
    não responde nada.
    """
    try:
        import redis
        from django.conf import settings

        cliente = redis.from_url(settings.CELERY_BROKER_URL)
        return {fila: cliente.llen(fila) for fila in ('celery', 'etl')}
    except Exception as erro:  # noqa: BLE001
        logger.info('não consegui ler a profundidade das filas: %s', erro)
        return {}


def _ativas() -> list:
    """As tarefas que os workers estão executando neste instante."""
    try:
        from lumiere.celery import app

        inspecao = app.control.inspect(timeout=SEGUNDOS_PARA_INSPECIONAR)
        ativas = inspecao.active() or {}
        return [
            {
                'tarefa': (t.get('name') or '').rsplit('.', 1)[-1],
                'task_id': t.get('id', ''),
                'worker': worker,
                # `time_start` vem em tempo do worker (monotônico do processo),
                # então só a diferença serve — e mesmo ela é aproximada quando
                # worker e web estão em máquinas diferentes.
                'desde_s': round(t.get('time_start') and
                                 (timezone.now().timestamp() - t['time_start']) or 0, 1),
            }
            for worker, tarefas in ativas.items() for t in tarefas
        ]
    except Exception as erro:  # noqa: BLE001
        logger.info('inspect falhou: %s', erro)
        return []


def _ultimas_execucoes(quantas: int = 12) -> list:
    from apps.core.models import ExecucaoDeTarefa

    return [
        {
            'tarefa': e.tarefa.rsplit('.', 1)[-1],
            'task_id': e.task_id[:8],
            'quando': e.iniciada_em.isoformat(),
            'duracao_s': round(e.duracao_s, 2) if e.duracao_s is not None else None,
            # Nulo é "ainda rodando" e é diferente de falso. A tela precisa dos
            # três estados, senão uma tarefa em curso se lê como fracassada.
            'sucesso': e.sucesso,
            'origem': e.origem,
            'por': e.disparada_por.username if e.disparada_por else '',
            'erro': (e.erro or '')[:180],
        }
        for e in ExecucaoDeTarefa.objects.select_related('disparada_por')[:quantas]
    ]


def _buscas_em_curso() -> list:
    """
    Os filmes cuja busca por cópias está em andamento agora.

    O estado por filme já existia no Redis desde que o botão "atualizar cópias"
    foi construído — `busca_releases:andamento:<id>` — e ninguém o lia fora da
    própria ficha do filme.
    """
    try:
        from apps.movies.models import Movie
        from apps.movies.release_search import estado_da_busca

        # Só os filmes varridos há pouco podem estar com busca viva; varrer os
        # 25.908 para descobrir custaria mais que o painel inteiro.
        recentes = Movie.objects.filter(
            copias_buscadas_em__gte=timezone.now() - timedelta(minutes=30)
        ).only('id', 'title')[:40]

        em_curso = []
        for filme in recentes:
            estado = estado_da_busca(str(filme.pk))
            if estado.get('estado') in ('enfileirada', 'buscando'):
                em_curso.append({'filme': filme.title,
                                 'estado': estado['estado'],
                                 'desde': estado.get('iniciada_em') or ''})
        return em_curso
    except Exception as erro:  # noqa: BLE001
        logger.info('não consegui ler as buscas em curso: %s', erro)
        return []


def o_que_esta_acontecendo() -> dict:
    """
    O vivo, inteiro. Nunca levanta: esta é a parte da tela que a pessoa olha
    justamente quando algo está errado.
    """
    from apps.tasks.progresso import em_curso

    try:
        progressos = em_curso()
    except Exception:  # noqa: BLE001
        progressos = []

    filas = _profundidade_das_filas()
    return {
        'progressos': progressos,
        'ativas': _ativas(),
        'filas': [{'nome': n, 'esperando': q} for n, q in filas.items()],
        'buscas': _buscas_em_curso(),
        'execucoes': _ultimas_execucoes(),
        # Quem lê precisa saber se o que vê é de agora.
        'medido_em': timezone.now().isoformat(),
    }
