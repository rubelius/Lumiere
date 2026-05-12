import os
import json
import logging
import requests
from celery import shared_task
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


@shared_task
def process_pending_ingestions():
    """
    Orquestrador para cron jobs (Celery Beat).
    Ele apenas acha quem está pendente e distribui as cartas. Ele não faz o trabalho pesado.
    """
    pending_tasks = RawIngestion.objects.filter(status='PENDING')[:500]
    for task in pending_tasks:
        process_single_ingestion.apply_async(args=[task.id], queue="etl")
    return f"Despachadas {pending_tasks.count()} tasks para a fila ETL."


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

    if task.status not in ["PENDING", "FAILED"]:
        return f"Task ignorada (Status: {task.status})"

    # Sinaliza que este worker assumiu o B.O.
    task.status = 'PROCESSING'
    task.save(update_fields=['status'])

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

    # Instanciamos um status fake de 1 filme só pra satisfazer a engine
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
        logger.warning(f"[Celery] API Error no Discovery de '{raw_title}'. Agendando Retry...")
        raise self.retry(exc=e, countdown=2 ** self.request.retries)

    if disc_result is None:
        cat = normalizer.classify_failure(raw_title)
        return fail(cat, "Todas as estratégias de descoberta falharam.")

    if disc_result.confidence < MIN_CONFIDENCE_SCORE:
        return fail(FailureCategory.LOW_CONFIDENCE, f"Confiança muito baixa ({disc_result.confidence})")

    # ── 3. ENRICHMENT (A Extração Profunda de Dados) ──
    try:
        enrich_result = enrichment.enrich(disc_result, raw)
    except requests.HTTPError as e:
        logger.warning(f"[Celery] API Error no Enrichment de '{raw_title}'. Agendando Retry...")
        raise self.retry(exc=e, countdown=2 ** self.request.retries)

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
        logger.warning(f"[Celery] Colisão de banco de dados para '{raw_title}'. Retentando...")
        raise self.retry(exc=e, countdown=5)
        
    except Exception as e:
        return fail(FailureCategory.DB_ERROR, str(e))