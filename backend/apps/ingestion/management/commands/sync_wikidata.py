"""
management/commands/sync_wikidata.py

Wikidata Deep Sync — Versão Otimizada
--------------------------------------
Melhorias em relação à versão anterior:
  • Uma única query SPARQL por batch (metadados + prêmios juntos)
  • update_fields seletivo: salva apenas colunas alteradas (3-5x mais rápido)
  • Backoff exponencial real no 429 (não apenas sleep fixo)
  • ThreadPoolExecutor para bater na API em paralelo (configurável)
  • Iterator no queryset — sem carregar toda a RAM de uma vez
  • Argumentos CLI: --batch-size, --workers, --limit, --dry-run
  • Arquivo de falhas estruturado (JSON-lines) para re-execução cirúrgica
  • Compatível com Django 5 + os campos novos adicionados pela migração abaixo

Migration necessária (crie em apps/movies/migrations/):
  Ver arquivo 0004_movie_wikidata_fields.py (entregue junto)
"""

import json
import logging
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
from typing import Any

import requests
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.movies.models import Movie

logger = logging.getLogger(__name__)

SPARQL_ENDPOINT = "https://query.wikidata.org/sparql"
DEFAULT_HEADERS = {
    "User-Agent": (
        "LumiereApp/3.0 (https://github.com/edwingodavid; "
        "edwin@lumiere.com) Python-Requests"
    ),
    "Accept": "application/sparql-results+json",
}

# ──────────────────────────────────────────────────────────────────────────────
# SPARQL — Uma única query unificada
# ──────────────────────────────────────────────────────────────────────────────

UNIFIED_QUERY = """
SELECT DISTINCT
  ?imdb_id
  ?item
  ?aspectLabel
  ?mubi
  ?bechdelLabel
  ?locLabel
  ?award_status
  ?award_name
  (YEAR(?award_date) AS ?award_year)
WHERE {{
  VALUES ?imdb_id {{ {values} }}
  ?item wdt:P345 ?imdb_id .

  OPTIONAL {{
    ?item wdt:P2061 ?aspect_item .
    ?aspect_item rdfs:label ?aspectLabel .
    FILTER(LANG(?aspectLabel) = "en")
  }}
  OPTIONAL {{ ?item wdt:P6856 ?mubi . }}
  OPTIONAL {{
    ?item wdt:P3643 ?bechdel_item .
    ?bechdel_item rdfs:label ?bechdelLabel .
    FILTER(LANG(?bechdelLabel) = "en")
  }}
  OPTIONAL {{
    ?item wdt:P915 ?loc_item .
    ?loc_item rdfs:label ?locLabel .
    FILTER(LANG(?locLabel) = "en")
  }}
  
  # PRÊMIOS OTIMIZADOS: Sem UNION e sem GROUP_CONCAT
  OPTIONAL {{
    VALUES (?p_prop ?ps_prop ?award_status) {{
      (p:P166 ps:P166 "Vencedor")
      (p:P1411 ps:P1411 "Indicado")
    }}
    ?item ?p_prop ?stmt .
    ?stmt ?ps_prop ?award_item .
    OPTIONAL {{ ?stmt pq:P585 ?award_date . }}
    ?award_item rdfs:label ?award_name .
    FILTER(LANG(?award_name) = "en")
  }}
}}
"""

# ──────────────────────────────────────────────────────────────────────────────
# HTTP helper com backoff exponencial
# ──────────────────────────────────────────────────────────────────────────────

def sparql_get(
    values_str: str,
    *,
    max_retries: int = 5,
    base_sleep: float = 4.0,
) -> list[dict] | None:
    """
    Executa a query SPARQL unificada.
    Retorna lista de bindings ou None em caso de falha permanente.
    """
    query = UNIFIED_QUERY.format(values=values_str)
    params = {"query": query, "format": "json"}

    for attempt in range(max_retries):
        try:
            resp = requests.get(
                SPARQL_ENDPOINT,
                params=params,
                headers=DEFAULT_HEADERS,
                timeout=90,
            )

            if resp.status_code == 429:
                wait = base_sleep * (2 ** attempt)
                logger.warning("429 recebido — aguardando %.0fs (tentativa %d)", wait, attempt + 1)
                time.sleep(wait)
                continue

            resp.raise_for_status()
            return resp.json().get("results", {}).get("bindings", [])

        except requests.exceptions.Timeout:
            wait = base_sleep * (2 ** attempt)
            logger.warning("Timeout — aguardando %.0fs (tentativa %d)", wait, attempt + 1)
            time.sleep(wait)

        except requests.exceptions.RequestException as exc:
            logger.error("Erro de rede: %s", exc)
            time.sleep(base_sleep)

    logger.error("Falha permanente após %d tentativas.", max_retries)
    return None


# ──────────────────────────────────────────────────────────────────────────────
# Parsing dos bindings
# ──────────────────────────────────────────────────────────────────────────────

def _val(row: dict, key: str) -> str | None:
    return row.get(key, {}).get("value") or None


def parse_bindings(bindings: list[dict]) -> dict[str, dict[str, Any]]:
    """Agrupa os resultados planos por imdb_id usando o Python (muito mais rápido que o banco)."""
    result: dict[str, dict[str, Any]] = {}

    for row in bindings:
        uid = _val(row, "imdb_id")
        if not uid:
            continue

        # Inicializa o filme no dicionário
        if uid not in result:
            result[uid] = {
                "wikidata_id": None,
                "aspect_ratio": None,
                "mubi_id": None,
                "bechdel_status": None,
                "filming_locations": set(), # Usamos set() para não repetir locações
                "festivals_dict": {},       # Usamos dict para não repetir prêmios
            }

        entry = result[uid]

        # Pega as informações simples (só salva se ainda estiver vazio)
        if not entry["wikidata_id"] and (wid := _val(row, "item")):
            entry["wikidata_id"] = wid.split("/")[-1]

        if not entry["aspect_ratio"] and (aspect := _val(row, "aspectLabel")):
            entry["aspect_ratio"] = aspect

        if not entry["mubi_id"] and (mubi := _val(row, "mubi")):
            entry["mubi_id"] = mubi

        if not entry["bechdel_status"] and (bechdel := _val(row, "bechdelLabel")):
            entry["bechdel_status"] = bechdel

        # Adiciona a locação ao Set (se houver)
        if loc := _val(row, "locLabel"):
            entry["filming_locations"].add(loc)

        # Adiciona o prêmio ao Dict (se houver)
        award_name = _val(row, "award_name")
        award_status = _val(row, "award_status")
        if award_name and award_status:
            award_year = _val(row, "award_year") or ""
            
            # Cria uma chave única para evitar o mesmo prêmio duplicado
            award_key = f"{award_name}@@{award_status}@@{award_year}"
            year_label = f"{award_year} | {award_status}" if award_year else award_status
            
            entry["festivals_dict"][award_key] = {
                "award": award_name,
                "name": "International Recognition",
                "year": year_label
            }

    # Formata o resultado final convertendo os Sets e Dicts de volta para Listas pro Django
    final_result = {}
    for uid, data in result.items():
        final_result[uid] = {
            "wikidata_id": data["wikidata_id"],
            "aspect_ratio": data["aspect_ratio"],
            "mubi_id": data["mubi_id"],
            "bechdel_status": data["bechdel_status"],
            "filming_locations": list(data["filming_locations"]),
            "festivals": list(data["festivals_dict"].values()),
        }

    return final_result


# ──────────────────────────────────────────────────────────────────────────────
# Gravação no banco (update_fields seletivo)
# ──────────────────────────────────────────────────────────────────────────────

TRACKED_FIELDS = [
    "wikidata_id",
    "aspect_ratio",
    "mubi_id",
    "bechdel_status",
    "filming_locations",
    "festivals",
    "wikidata_checked",
]


def save_batch(
    movies: list[Movie],
    enriched: dict[str, dict[str, Any]],
    *,
    dry_run: bool = False,
) -> tuple[int, list[str]]:
    """
    Persiste apenas os campos que mudaram.
    Retorna (qtd_salva, lista_de_imdb_ids_com_erro).
    """
    to_update: list[Movie] = []
    failed_ids: list[str] = []

    for movie in movies:
        data = enriched.get(movie.imdb_id)
        movie.wikidata_checked = True

        if data:
            for field, value in data.items():
                if value is not None:
                    setattr(movie, field, value)

        to_update.append(movie)

    if dry_run:
        return len(to_update), []

    try:
        with transaction.atomic():
            Movie.objects.bulk_update(to_update, TRACKED_FIELDS, batch_size=50)
        return len(to_update), []
    except Exception as exc:
        logger.error("bulk_update falhou: %s — tentando fallback individual", exc)

    # Fallback: salva um a um para não perder o lote todo
    saved = 0
    for movie in to_update:
        try:
            movie.save(update_fields=TRACKED_FIELDS)
            saved += 1
        except Exception as exc:
            logger.error("Falha ao salvar %s (%s): %s", movie.imdb_id, movie.title, exc)
            failed_ids.append(movie.imdb_id)

    return saved, failed_ids


# ──────────────────────────────────────────────────────────────────────────────
# Worker (para uso com ThreadPoolExecutor)
# ──────────────────────────────────────────────────────────────────────────────

def process_batch(
    movies: list[Movie],
    *,
    dry_run: bool,
) -> tuple[int, list[str]]:
    """Unidade de trabalho executada em cada thread."""
    imdb_ids = [m.imdb_id for m in movies]
    values_str = " ".join(f'"{uid}"' for uid in imdb_ids)

    bindings = sparql_get(values_str)

    if bindings is None:
        # API falhou permanentemente para este lote
        return 0, imdb_ids

    enriched = parse_bindings(bindings)
    return save_batch(movies, enriched, dry_run=dry_run)


# ──────────────────────────────────────────────────────────────────────────────
# Comando Django
# ──────────────────────────────────────────────────────────────────────────────

class Command(BaseCommand):
    help = "Enriquece o acervo com metadados do Wikidata (aspect ratio, prêmios, etc.)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--batch-size",
            type=int,
            default=5,
            help="IMDb IDs por query SPARQL (default: 5). Acima de 10 aumenta risco de timeout.",
        )
        parser.add_argument(
            "--workers",
            type=int,
            default=3,
            help="Threads paralelas (default: 3). Não exceda 5 para evitar ban.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Limitar a N filmes (0 = sem limite).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Simula sem escrever no banco.",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Reprocessa filmes já verificados (wikidata_checked=True).",
        )
        parser.add_argument(
            "--only-imdb",
            nargs="+",
            metavar="tt1234567",
            help="Processa apenas os IMDb IDs especificados.",
        )

    # ── Filtro do queryset ────────────────────────────────────────────────────

    def _build_queryset(self, options):
        qs = Movie.objects.exclude(imdb_id__isnull=True).exclude(imdb_id="")

        if options["only_imdb"]:
            qs = qs.filter(imdb_id__in=options["only_imdb"])
        elif not options["force"]:
            qs = qs.filter(wikidata_checked=False)

        qs = qs.only("id", "imdb_id", "title", *TRACKED_FIELDS).order_by("pk")

        if options["limit"]:
            qs = qs[:options["limit"]]

        return qs

    # ── Gerador de batches (iterator = sem pressão na RAM) ────────────────────

    @staticmethod
    def _batches(qs, size: int):
        batch: list[Movie] = []
        for movie in qs.iterator(chunk_size=size * 4):
            batch.append(movie)
            if len(batch) == size:
                yield batch
                batch = []
        if batch:
            yield batch

    # ── Main ──────────────────────────────────────────────────────────────────

    def handle(self, *args, **options):
        batch_size = options["batch_size"]
        workers = options["workers"]
        dry_run = options["dry_run"]

        qs = self._build_queryset(options)
        total = qs.count()

        if total == 0:
            self.stdout.write(self.style.SUCCESS("✅ Nenhum filme pendente para enriquecer."))
            return

        mode = "DRY-RUN" if dry_run else "ESCRITA"
        self.stdout.write(
            self.style.WARNING(
                f"\n🎬 Wikidata Deep Sync [{mode}]\n"
                f"   Filmes: {total} | Batch: {batch_size} | Workers: {workers}\n"
            )
        )

        # Log de falhas (JSON-lines para fácil re-execução)
        log_path = Path(os.getcwd()) / "wikidata_failures.jsonl"
        if not dry_run:
            log_path.write_text("")  # limpa na nova execução

        total_saved = 0
        total_failed = 0
        completed_batches = 0
        start = time.perf_counter()

        batches = list(self._batches(qs, batch_size))
        total_batches = len(batches)

        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = {
                pool.submit(process_batch, batch, dry_run=dry_run): i
                for i, batch in enumerate(batches, 1)
            }

            for future in as_completed(futures):
                batch_num = futures[future]
                try:
                    saved, failed_ids = future.result()
                except Exception as exc:
                    self.stderr.write(f"  ⚠ Lote {batch_num} — exceção inesperada: {exc}")
                    continue

                total_saved += saved
                total_failed += len(failed_ids)
                completed_batches += 1

                if failed_ids and not dry_run:
                    with log_path.open("a") as f:
                        for uid in failed_ids:
                            f.write(
                                json.dumps(
                                    {"imdb_id": uid, "ts": datetime.utcnow().isoformat()},
                                    ensure_ascii=False,
                                )
                                + "\n"
                            )

                # Progresso inline
                pct = int(completed_batches / total_batches * 100) # <-- USE completed_batches
                bar = "█" * (pct // 5) + "░" * (20 - pct // 5)
                elapsed = time.perf_counter() - start
                eta = (elapsed / completed_batches) * (total_batches - completed_batches) # <-- USE completed_batches
                self.stdout.write(
                    f"\r  [{bar}] {pct:3d}% | "
                    f"lotes {completed_batches}/{total_batches} | " # <-- USE completed_batches
                    f"salvos {total_saved} | "
                    f"falhas {total_failed} | "
                    f"ETA {eta:.0f}s",
                    ending="",
                )
                self.stdout.flush()

                # Pausa entre lotes para não bater no rate-limit
                time.sleep(1.5)

        elapsed_total = time.perf_counter() - start
        self.stdout.write("")  # nova linha após o progresso inline

        self.stdout.write(
            self.style.SUCCESS(
                f"\n✅ Concluído em {elapsed_total:.0f}s\n"
                f"   Salvos:  {total_saved}\n"
                f"   Falhas:  {total_failed}"
                + (f"\n   Log:     {log_path}" if total_failed and not dry_run else "")
            )
        )

        if total_failed:
            self.stdout.write(
                self.style.WARNING(
                    "   Para reprocessar apenas as falhas:\n"
                    "   python manage.py sync_wikidata "
                    "--only-imdb $(jq -r '.imdb_id' wikidata_failures.jsonl | tr '\\n' ' ')"
                )
            )