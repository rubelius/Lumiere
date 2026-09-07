import os
import json
import logging
import requests
from celery import shared_task
from celery.exceptions import Retry
from django.conf import settings
from django.db import transaction, IntegrityError, OperationalError

from apps.ingestion.models import RawIngestion
from apps.movies.models import Movie

from apps.ingestion.management.commands.run_etl import (
    TMDBClient, WikidataClient, TitleNormalizer, ConfidenceScorer,
    IdentityResolver, DiscoveryEngine, EnrichmentEngine,
    PersistenceEngine, NonFilmClassifier, TokenBucketLimiter,
    ResponseCache, FailureCategory, ETLStats, MIN_CONFIDENCE_SCORE
)

logger = logging.getLogger(__name__)

# -------------------------------------------------------------------------
# INSTANCIAÇÃO GLOBAL (POR WORKER)
# Fazemos isso do lado de fora da função da task. Assim, o Cache em Memória
# e o Limitador de Taxa (Token Bucket) sobrevivem entre uma task e outra
# sendo compartilhados por todos os filmes que caírem no mesmo Worker!
# -------------------------------------------------------------------------
api_key = getattr(settings, "TMDB_API_KEY", os.getenv("TMDB_API_KEY", ""))

if api_key:
    limiter = TokenBucketLimiter(rate=20.0, capacity=40.0)
    resp_cache = ResponseCache(enabled=True)
    tmdb = TMDBClient(api_key, limiter, resp_cache)
    wikidata = WikidataClient(resp_cache)
    normalizer = TitleNormalizer()
    scorer = ConfidenceScorer()
    identity = IdentityResolver(scorer)
    discovery = DiscoveryEngine(tmdb, wikidata, normalizer, scorer, resp_cache)
    enrichment = EnrichmentEngine(tmdb, resp_cache)
    persistence = PersistenceEngine()
    classifier = NonFilmClassifier()


# Quanto tempo em PROCESSING sem notícia basta para considerar a linha órfã.
# A vida máxima de uma execução é curta (três tentativas com recuo de 2s, 4s e
# 8s), então meia hora é folga larga sobre qualquer processamento legítimo.
MINUTOS_PARA_ORFA = 30

# Teto do lote. Existe para o despachante não encher a fila de uma vez.
TAMANHO_DO_LOTE = 500


@shared_task
def process_pending_ingestions():
    """
    Orquestrador para cron jobs (Celery Beat).
    Ele apenas acha quem está pendente e distribui as cartas. Ele não faz o
    trabalho pesado.

    Também recolhe as órfãs. Uma linha em PROCESSING há muito tempo é uma que
    ficou pelo caminho — worker morto, processo reiniciado, tentativas
    esgotadas. Sem este resgate, PROCESSING era um estado sem saída: nada o
    relia, e havia 117 filmes parados nele.

    A ordenação não é enfeite. `[:500]` sem ORDER BY deixa o Postgres devolver
    500 linhas arbitrárias, e as mesmas 500 podem voltar rodada após rodada
    enquanto o resto nunca é despachado.
    """
    from datetime import timedelta
    from django.utils import timezone

    # O resgate é uma transição de estado, não um caso especial no consumidor:
    # a linha volta a PENDING, que é o estado que todo o pipeline sabe ler.
    # Despachá-la ainda em PROCESSING não adiantaria — a guarda de
    # process_single_ingestion recusaria na primeira tentativa.
    limite = timezone.now() - timedelta(minutes=MINUTOS_PARA_ORFA)
    orfas = RawIngestion.objects.filter(
        status='PROCESSING', updated_at__lt=limite).update(status='PENDING')

    abertas = list(
        RawIngestion.objects.filter(status='PENDING')
        .order_by('created_at')[:TAMANHO_DO_LOTE]
    )

    for task in abertas:
        process_single_ingestion.apply_async(args=[task.id], queue="etl")
    logger.info('Despachadas %d ingestões (%d resgatadas de PROCESSING)',
                len(abertas), orfas)
    return f"Despachadas {len(abertas)} tasks para a fila ETL ({orfas} órfãs)."


@shared_task(bind=True, max_retries=3, queue="etl")
def process_single_ingestion(self, task_id):
    """
    A TASK DE OURO: Processa um filme só. Isola falhas. Escala infinitamente.
    """
    if not api_key:
        return "ERRO FATAL: TMDB_API_KEY não configurada."

    try:
        task = RawIngestion.objects.get(id=task_id)
    except RawIngestion.DoesNotExist:
        return f"Task ID {task_id} não encontrada no banco."

    # Estados que ainda admitem trabalho. 'PROCESSING' entra na lista quando
    # somos NÓS voltando: a task grava PROCESSING antes de trabalhar, e a
    # gravação commita em autocommit (não há transação em volta — o
    # ATOMIC_REQUESTS do Django não alcança o worker). Quando um dos três
    # retries reexecutava a mesma mensagem, esta guarda encontrava PROCESSING
    # e devolvia "Task ignorada": os `max_retries=3` eram três no-ops pagos, e
    # a linha ficava presa nesse estado para sempre, porque
    # process_pending_ingestions só enxerga PENDING. Havia 117 assim no banco.
    aceitos = ['PENDING', 'FAILED']
    if self.request.retries:
        aceitos.append('PROCESSING')

    if task.status not in aceitos:
        return f"Task ignorada (Status: {task.status})"

    # Reivindicação atômica. O UPDATE condicional é a trava: sem ele, dois
    # workers passavam pela guarda de leitura acima no mesmo instante e ambos
    # seguiam para o TMDB com o mesmo filme.
    if not RawIngestion.objects.filter(id=task_id, status__in=aceitos).update(
            status='PROCESSING'):
        return f"Task ignorada (outro worker assumiu {task_id})"
    task.status = 'PROCESSING'

    # Extrai dados básicos da planilha do TSPDT
    raw = task.raw_data
    raw_title = str(raw.get("Title", "")).strip()
    raw_year = str(raw.get("Year", ""))
    raw_imdb = str(raw.get("IMDb", "")).strip()
    raw_dir = str(raw.get("Director(s)", "")).strip()
    raw_ctry = str(raw.get("Country", "")).strip()

    # Função interna auxiliar para falhar bonito e sair da task
    def fail(category: FailureCategory, detail: str):
        task.status = "FAILED"
        task.error_log = json.dumps({"category": category.value, "detail": detail[:400]})
        task.save(update_fields=["status", "error_log"])
        return f"Falha: {category.value} - {raw_title}"

    def reagenda(exc, countdown, etapa):
        """
        Pede nova tentativa e, quando elas acabarem, devolve a linha a FAILED.

        `self.retry()` levanta Retry no caso normal e outra coisa
        (MaxRetriesExceededError, ou a própria exc) quando não há mais
        tentativas. Sem tratar o segundo caso, a linha terminava em
        PROCESSING — estado que nenhuma consulta de recuperação lê.
        """
        try:
            self.retry(exc=exc, countdown=countdown)
        except Retry:
            raise
        except Exception:
            logger.warning('[Celery] %s esgotou as tentativas em %r', etapa, raw_title)
            return fail(FailureCategory.API_ERROR, f'{etapa}: {exc}')

    def trabalha():
        """Da descoberta à persistência, num único try."""
        # Status fake de 1 filme só, pra satisfazer a engine.
        stats = ETLStats(total=1)

        # ── 1. CLASSIFICAÇÃO (Filtrando Lixo) ──
        if classifier.is_non_film(raw_title):
            task.status = "NON_FILM"
            task.error_log = '{"category": "NON_FILM_MEDIA"}'
            task.save(update_fields=["status", "error_log"])
            return f"Ignorado (Não-Filme): {raw_title}"

        # ── 2. DISCOVERY (A Busca Multimeios) ──
        try:
            disc_result = discovery.discover(raw_title, raw_year, raw_imdb, raw_dir, raw_ctry, stats)
        except requests.HTTPError as e:
            # Se der erro de rede, o Celery manda tentar de novo daqui a 2s, depois 4s, depois 8s...
            return reagenda(e, 2 ** self.request.retries, 'Discovery')

        if disc_result is None:
            cat = normalizer.classify_failure(raw_title)
            return fail(cat, "Todas as estratégias de descoberta falharam.")

        if disc_result.confidence < MIN_CONFIDENCE_SCORE:
            return fail(FailureCategory.LOW_CONFIDENCE, f"Confiança muito baixa ({disc_result.confidence})")

        # ── 3. ENRICHMENT (A Extração Profunda de Dados) ──
        try:
            enrich_result = enrichment.enrich(disc_result, raw)
        except requests.HTTPError as e:
            return reagenda(e, 2 ** self.request.retries, 'Enrichment')

        if not enrich_result.title:
            return fail(FailureCategory.UNKNOWN, "TMDB retornou título vazio")

        # ── 4. IDENTITY RESOLUTION (Prevenção de Duplicatas) ──
        existing_movie = identity.resolve(enrich_result)

        # ── 5. PERSISTENCE (Salvamento Atômico) ──
        try:
            movie, created = persistence.persist(enrich_result, existing_movie, dry_run=False)
        
            task.status = 'COMPLETED'
            task.error_log = json.dumps({
                "strategy": disc_result.strategy_used,
                "confidence": disc_result.confidence,
                "created": created,
                "movie_id": str(movie.id)
            })
            task.save(update_fields=['status', 'error_log'])
        
            return f"Sucesso: {movie.title} (Criado: {created}) [Score: {disc_result.confidence:.2f}]"

        except (IntegrityError, OperationalError) as e:
            # Se dois workers tentarem salvar o mesmo filme no mesmo milissegundo,
            # rola colisão no banco. O Celery pega a exceção e manda tentar de novo em 5s.
            return reagenda(e, 5, 'Persistência')
        
        except Exception as e:
            return fail(FailureCategory.DB_ERROR, str(e))

    # Rede de baixo. Qualquer exceção não prevista — um IndexError vindo do
    # motor de descoberta, por exemplo — subia até o Celery e deixava a linha
    # em PROCESSING, que nenhuma consulta relê. Foi assim que 19 das 117
    # linhas resgatadas voltaram a ficar presas na primeira reprocessagem.
    #
    # A garantia que importa é esta: a linha NUNCA termina em PROCESSING.
    # FAILED é visível para a guarda acima, para o resgate do despachante e
    # para quem for investigar; PROCESSING não é visível para ninguém.
    try:
        return trabalha()
    except Retry:
        raise
    except Exception as e:
        logger.exception('[Celery] Falha inesperada em %r', raw_title)
        return fail(FailureCategory.UNKNOWN, f'{type(e).__name__}: {e}')
