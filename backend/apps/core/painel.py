"""
O painel de administração: o estado do Lumière inteiro, em números.

A REGRA DESTE ARQUIVO, e ela é o motivo de ele existir com este cuidado: uma
tela de observabilidade é o lugar mais fácil do mundo para repetir o defeito que
este projeto mais comete — mostrar um número que parece uma coisa e é outra. Um
"saudável" verde derivado de "o processo está de pé" já custou caro aqui.

Por isso TODO painel carrega três coisas além do valor:

    origem     de onde o número vem, em nome de tabela ou de comando
    medido_em  quando, porque alguns são caros e ficam guardados
    ressalva   o que o número NÃO diz — vazio só quando não há o que ressalvar

A `ressalva` não é rodapé decorativo. O painel de tarefas, por exemplo, tem 19
falhas registradas no banco e NENHUMA delas diz qual tarefa falhou, porque
`result_extended` é falso; e o backend de resultado em uso é o Redis, não o
banco, então essas 19 são de outra era. Um painel que mostrasse "19 falhas" sem
dizer isso estaria mentindo com números verdadeiros.
"""

import logging
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import connection
from django.db.models import Count, Q
from django.utils import timezone

logger = logging.getLogger(__name__)

# Painéis que consultam serviço externo ficam guardados: abrir a tela não pode
# custar seis idas à rede, e nenhum deles muda de segundo em segundo.
SEGUNDOS_DE_CACHE = 60


def _painel(chave, titulo, valores, origem, ressalva=''):
    return {
        'chave': chave, 'titulo': titulo, 'valores': valores,
        'origem': origem, 'ressalva': ressalva,
        'medido_em': timezone.now().isoformat(),
    }


def _valor(rotulo, valor, detalhe=''):
    return {'rotulo': rotulo, 'valor': valor, 'detalhe': detalhe}


# ── o acervo ──────────────────────────────────────────────────────────────

def acervo():
    from apps.movies.models import Movie, TorrentRelease, WatchHistory

    filmes = Movie.objects.count()
    com_copia = (TorrentRelease.objects.values('movie_id').distinct().count())
    return _painel(
        'acervo', 'Acervo',
        [
            _valor('Filmes', filmes),
            _valor('Cópias catalogadas', TorrentRelease.objects.count(),
                   f'em {com_copia} filmes'),
            _valor('Filmes com alguma cópia', com_copia,
                   f'{100 * com_copia / filmes:.1f}% do acervo' if filmes else ''),
            _valor('Registros de reprodução', WatchHistory.objects.count()),
        ],
        origem='count() em movies_movie, torrent_releases e watch_history',
    )


# ── o rastreio de cópias ──────────────────────────────────────────────────

def rastreio():
    from apps.movies.models import Movie, TorrentRelease
    from apps.tasks.precarga import DIAS_ATE_VENCER

    total = Movie.objects.count()
    varridos = Movie.objects.filter(copias_buscadas_em__isnull=False).count()
    vencidos = Movie.objects.filter(
        copias_buscadas_em__lt=timezone.now() - timedelta(days=DIAS_ATE_VENCER)).count()

    por_indexador = list(
        TorrentRelease.objects.values('indexer_name')
        .annotate(n=Count('id')).order_by('-n')[:6])

    # Quanto falta, no ritmo atual. É a pergunta que a tela responde melhor que
    # qualquer porcentagem — e a que expõe se o rastreador está parado.
    faltam = total - varridos
    return _painel(
        'rastreio', 'Rastreio de cópias',
        [
            _valor('Filmes varridos', varridos,
                   f'{100 * varridos / total:.2f}% de {total}' if total else ''),
            _valor('Nunca varridos', faltam),
            _valor('Varredura vencida', vencidos, f'mais de {DIAS_ATE_VENCER} dias'),
            _valor('Indexadores', ', '.join(
                f"{i['indexer_name'] or 'sem nome'} ({i['n']})" for i in por_indexador) or '—'),
        ],
        origem='movies_movie.copias_buscadas_em e torrent_releases.indexer_name',
        ressalva=('`copias_buscadas_em` diz quando a busca RODOU, não se ela achou '
                  'algo. Um filme varrido e sem cópia conta como varrido.'),
    )


# ── motor, filas e tarefas ────────────────────────────────────────────────

def motor():
    from apps.core.motor import estado_do_motor

    estado = estado_do_motor()
    return _painel(
        'motor', 'Motor de tarefas',
        [
            _valor('Workers', estado.get('workers', 0)),
            _valor('Beat', 'de pé' if estado.get('beat') else 'parado'),
            _valor('Último pulso', estado.get('ultimo_pulso') or '—'),
            _valor('Busca de cópias', 'funciona' if estado.get('busca_funciona') else 'parada'),
            _valor('Rastreio', 'funciona' if estado.get('rastreio_funciona') else 'parado'),
        ],
        origem='apps/core/motor.py::estado_do_motor (ping ao Celery + pulso no Redis)',
        ressalva=('O pulso é escrito pelo beat e executado pelo worker: ele só '
                  'aparece quando os DOIS funcionam. Um beat morto não responde '
                  'quando perguntado — a ausência da chave é a resposta.'),
    )


def tarefas():
    """
    As tarefas periódicas, com histórico real — e a ressalva que as acompanha.
    """
    valores, ressalva = [], ''
    try:
        from django_celery_beat.models import PeriodicTask

        periodicas = (PeriodicTask.objects.filter(enabled=True)
                      .exclude(name__startswith='celery.')
                      .order_by('-total_run_count')[:12])
        valores = [
            _valor(t.name, t.total_run_count or 0,
                   f'último em {t.last_run_at:%d/%m %H:%M}' if t.last_run_at else 'nunca rodou')
            for t in periodicas]
    except Exception as erro:  # noqa: BLE001
        logger.info('sem django_celery_beat: %s', erro)
        ressalva = 'django_celery_beat não está disponível nesta instalação.'

    # A ressalva que impede este painel de mentir com números verdadeiros.
    try:
        from django_celery_results.models import TaskResult
        falhas = TaskResult.objects.filter(status='FAILURE').count()
        sem_nome = TaskResult.objects.filter(task_name__isnull=True).count()
        total = TaskResult.objects.count()
        if total:
            valores.append(_valor('Falhas registradas no banco', falhas,
                                  f'de {total} resultados'))
            ressalva = (
                f'{sem_nome} dos {total} resultados no banco não dizem QUAL tarefa '
                'foram (`result_extended` está desligado). E o backend de '
                'resultado em uso é o Redis, não o banco — estas linhas são de '
                'quando era o contrário, e novas falhas NÃO chegam aqui.')
    except Exception as erro:  # noqa: BLE001
        logger.info('sem django_celery_results: %s', erro)

    return _painel(
        'tarefas', 'Tarefas periódicas', valores,
        origem='django_celery_beat.PeriodicTask e django_celery_results.TaskResult',
        ressalva=ressalva,
    )


# ── a ingestão ────────────────────────────────────────────────────────────

def ingestao():
    try:
        from apps.ingestion.models import RawIngestion
    except Exception:  # noqa: BLE001
        return None

    por_status = dict(RawIngestion.objects.values_list('status')
                      .annotate(n=Count('id')))
    if not por_status:
        return None

    # As categorias de falha já estão estruturadas em JSON e ninguém as lê.
    categorias = {}
    for log in (RawIngestion.objects.filter(status='FAILED')
                .values_list('error_log', flat=True)[:2000]):
        if isinstance(log, dict):
            cat = log.get('category') or 'SEM CATEGORIA'
            categorias[cat] = categorias.get(cat, 0) + 1

    valores = [_valor(k, v) for k, v in sorted(por_status.items(), key=lambda x: -x[1])]
    if categorias:
        valores.append(_valor(
            'Falhas por categoria',
            ', '.join(f'{k} {v}' for k, v in sorted(categorias.items(), key=lambda x: -x[1])[:6])))

    return _painel(
        'ingestao', 'Ingestão do catálogo', valores,
        origem='ingestion_rawingestion.status e .error_log',
        ressalva=('As categorias saem do JSON de `error_log` das primeiras 2.000 '
                  'linhas com falha, não de todas.'),
    )


# ── o banco ───────────────────────────────────────────────────────────────

def banco():
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT relname, pg_total_relation_size(c.oid)
            FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relkind = 'r'
            ORDER BY 2 DESC LIMIT 8
        """)
        maiores = cursor.fetchall()
        cursor.execute("SELECT pg_database_size(current_database())")
        total = cursor.fetchone()[0]

    def mb(n):
        return f'{n / 1024 ** 2:.0f} MB' if n >= 1024 ** 2 else f'{n / 1024:.0f} KB'

    return _painel(
        'banco', 'Banco de dados',
        [_valor('Total', mb(total))]
        + [_valor(nome, mb(tamanho)) for nome, tamanho in maiores],
        origem='pg_total_relation_size e pg_database_size',
    )


# ── usuários ──────────────────────────────────────────────────────────────

def usuarios():
    from apps.movies.models import WatchHistory

    User = get_user_model()
    vistos = dict(WatchHistory.objects.values_list('user_id')
                  .annotate(n=Count('id')))
    return _painel(
        'usuarios', 'Contas',
        [_valor(u.username,
                'admin' if u.is_superuser else ('equipe' if u.is_staff else 'comum'),
                f'{vistos.get(u.id, 0)} reproduções · '
                + (f'último acesso {u.last_login:%d/%m %H:%M}' if u.last_login else 'nunca entrou'))
         for u in User.objects.order_by('-is_superuser', 'username')[:30]],
        origem='auth user + watch_history',
    )


# ── integrações ───────────────────────────────────────────────────────────

# Quanto esperar cada serviço. Curto de propósito: a tela de admin não pode
# levar meio minuto para abrir porque o Prowlarr está fora do ar — e "não
# respondeu em 4s" é a informação que ela precisa dar.
SEGUNDOS_PARA_RESPONDER = 4.0


# O que a coroutine devolve quando não HÁ o que perguntar. Precisa ser diferente
# de None, porque None é uma resposta ruim do serviço e isto é a ausência de
# pergunta — a tela não pode dizer "sem resposta" sobre algo que nunca foi
# configurado.
NAO_CONFIGURADO = object()


def _pergunta(rotulo, coroutine, formata):
    """
    Uma integração, com a resposta ou o motivo de não ter havido resposta.

    TRÊS ESTADOS, e não dois. "Não configurado", "não respondeu" e a resposta de
    verdade pedem ações diferentes: preencher a credencial, olhar o serviço, ou
    nada. Um teste desta casa pegou justamente isto — um Prowlarr que nunca foi
    configurado aparecia com a mesma frase de um Prowlarr fora do ar.

    NUNCA levanta: um serviço caído é o que esta tela existe para mostrar, e
    derrubar o painel por causa dele seria o oposto do trabalho.
    """
    from asgiref.sync import async_to_sync
    try:
        dados = async_to_sync(coroutine)()
    except Exception as erro:  # noqa: BLE001
        return _valor(rotulo, 'sem resposta', str(erro)[:120])
    if dados is NAO_CONFIGURADO:
        return _valor(rotulo, 'não configurado', 'falta credencial nas configurações')
    if dados is None:
        return _valor(rotulo, 'sem resposta', 'o serviço não devolveu nada')
    return _valor(rotulo, *formata(dados))


def integracoes():
    from django.contrib.auth import get_user_model

    User = get_user_model()
    dono = User.objects.filter(is_superuser=True).first() or User.objects.first()
    valores = []

    # ── Real-Debrid: conta e validade ──
    async def _rd():
        from apps.integrations.realdebrid import RealDebridClient, chave_do_usuario
        chave = chave_do_usuario(dono) if dono else ''
        if not chave:
            return NAO_CONFIGURADO
        cliente = RealDebridClient(chave)
        try:
            cliente.client.timeout = SEGUNDOS_PARA_RESPONDER
            return await cliente.get_user_info()
        finally:
            await cliente.close()

    valores.append(_pergunta(
        'Real-Debrid', _rd,
        lambda d: (d.get('type') or 'conta',
                   f"expira em {(d.get('expiration') or '')[:10]} · "
                   f"{d.get('points', 0)} pontos")))

    # ── Prowlarr: indexadores ──
    async def _prowlarr():
        from apps.integrations.prowlarr import ProwlarrClient
        url = getattr(dono, 'prowlarr_url', '') if dono else ''
        chave = getattr(dono, 'prowlarr_api_key', '') if dono else ''
        if not (url and chave):
            return NAO_CONFIGURADO
        cliente = ProwlarrClient(url, chave)
        try:
            cliente.client.timeout = SEGUNDOS_PARA_RESPONDER
            return await cliente.get_indexers()
        finally:
            await cliente.close()

    valores.append(_pergunta(
        'Prowlarr', _prowlarr,
        lambda d: (f'{len(d)} indexadores',
                   ', '.join(str(i.get('name', '?')) for i in d[:5]))))

    # ── o motor de torrent ──
    async def _torrent():
        import httpx
        from apps.integrations.torrent import _base
        async with httpx.AsyncClient(timeout=SEGUNDOS_PARA_RESPONDER) as http:
            r = await http.get(f'{_base()}/saude')
            # O motor responde 503 quando está vivo e não pode servir — e essa
            # distinção é justamente o que este painel precisa mostrar.
            return r.json()

    valores.append(_pergunta(
        'Motor de torrent', _torrent,
        lambda d: ('no ar' if d.get('ok') else (d.get('motivo') or 'indisponível'),
                   f"{d.get('torrents', 0)} torrent(s) servindo")))

    return _painel(
        'integracoes', 'Integrações', valores,
        origem='chamada REAL a cada serviço, agora',
        ressalva=('Cada linha é uma pergunta feita neste instante, com '
                  f'{SEGUNDOS_PARA_RESPONDER:.0f}s de paciência. "Sem resposta" '
                  'quer dizer que não respondeu AGORA — não que esteja quebrado.'),
    )


PAINEIS = [acervo, rastreio, motor, integracoes, tarefas, ingestao,
           banco, usuarios]


def monta_painel() -> dict:
    """
    Todos os painéis. Um que falhe vira uma ressalva, e não uma tela em branco.
    """
    montados, falharam = [], []
    for construtor in PAINEIS:
        try:
            p = construtor()
        except Exception as erro:  # noqa: BLE001
            logger.exception('painel %s falhou', construtor.__name__)
            falharam.append(f'{construtor.__name__}: {erro}')
            continue
        if p:
            montados.append(p)
    return {'paineis': montados, 'falharam': falharam}


def painel_guardado() -> dict:
    guardado = cache.get('painel:admin')
    if guardado is not None:
        return guardado
    montado = monta_painel()
    cache.set('painel:admin', montado, SEGUNDOS_DE_CACHE)
    return montado
