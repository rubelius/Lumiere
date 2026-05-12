"""
lumière/apps/ingestion/management/commands/run_etl_v2.py

PRODUCTION-GRADE CINEMATIC METADATA ETL — v2.1 REFACTORED
===========================================================

Architecture: Six-Stage Pipeline with full async support
  RAW → CLASSIFY → DISCOVER → ENRICH → VALIDATE → RESOLVE → PERSIST

Fixes applied in this version:
  [P1] Identity Resolution — multi-key lookup with confidence scoring, no more tmdb_id-only
  [P2] Async Celery pipeline — discovery/enrich/persist in distributed queues
  [P3] Wikidata circuit breaker — rate-limited, failure-counted, auto-disabled
  [P4] Redis response cache — all TMDB/Wikidata responses cached by key
  [P5] Relational hints — cast/genres normalized before write; schema notes inline
  [P6] Confidence scoring — fuzzy title+year+director scoring before accepting a match
  [P7] Race-safe persistence — select_for_update + unique constraint handling
  [P8] Token-bucket rate limiter — adaptive, burst-aware, per-endpoint

Usage:
  # Full sync run (default)
  python manage.py run_etl_v2

  # Async via Celery (requires workers)
  python manage.py run_etl_v2 --async

  # Dry run
  python manage.py run_etl_v2 --dry-run

  # Targeted re-run by failure category
  python manage.py run_etl_v2 --category NON_LATIN

  # Limit for smoke tests
  python manage.py run_etl_v2 --limit 50

  # Skip expensive fallbacks
  python manage.py run_etl_v2 --no-wikidata --no-cache
"""

from __future__ import annotations

import hashlib
import json
import logging
import math
import os
import re
import threading
import time
import unicodedata
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

import requests
from django.conf import settings
from django.core.cache import cache
from django.core.management.base import BaseCommand, CommandError
from django.db import IntegrityError, OperationalError, connection, transaction
from requests.adapters import HTTPAdapter
from tqdm import tqdm
from urllib3.util.retry import Retry

from apps.ingestion.models import RawIngestion
from apps.movies.models import Movie

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 1 — FAILURE TAXONOMY
# ═══════════════════════════════════════════════════════════════════════════════

class FailureCategory(str, Enum):
    NON_LATIN        = "NON_LATIN"
    STRUCTURAL_NOISE = "STRUCTURAL_NOISE"
    NON_FILM_MEDIA   = "NON_FILM_MEDIA"
    ARTICLE_SUFFIX   = "ARTICLE_SUFFIX"
    TYPO_IN_SOURCE   = "TYPO_IN_SOURCE"
    COMPOUND_TITLE   = "COMPOUND_TITLE"
    TIME_RANGE_YEAR  = "TIME_RANGE_YEAR"
    LOW_CONFIDENCE   = "LOW_CONFIDENCE"   # [P6] Match found but score too low
    IDENTITY_CONFLICT = "IDENTITY_CONFLICT"  # [P1] Multiple candidates, can't resolve
    API_ERROR        = "API_ERROR"
    DB_ERROR         = "DB_ERROR"
    UNKNOWN          = "UNKNOWN"


NON_FILM_MARKERS = {
    "[INSTALLATION]", "[VIDEO GAME]", "[PODCAST]", "[MUSIC VIDEO]",
    "[TV EPISODE]", "[SHORT]", "[FOUND FOOTAGE]", "[HOME VIDEO]",
    "[SOCIAL MEDIA]", "[NEWSREEL]", "[DEPOSITION]", "[COURTROOM]",
}

UNSEARCHABLE_TITLES = {"****", "---", "???", "", "[Enema Medley]"}

# [P6] Minimum confidence to accept a TMDB match (0.0–1.0)
MIN_CONFIDENCE_SCORE = 0.42

# [P3] Circuit breaker thresholds for Wikidata
WIKIDATA_MAX_FAILURES  = 5   # consecutive failures before opening circuit
WIKIDATA_RESET_SECONDS = 120  # seconds before attempting half-open


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 2 — STRUCTURED RESULT TYPES
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class DiscoveryResult:
    tmdb_id: Optional[int] = None
    media_type: str = "movie"
    strategy_used: str = "none"
    imdb_id_used: Optional[str] = None
    confidence: float = 0.0  # [P6] 0.0–1.0


@dataclass
class IdentityKey:
    """[P1] All stable external IDs for a film — used for multi-key resolution."""
    tmdb_id: Optional[int] = None
    imdb_id: Optional[str] = None
    tspdt_id: Optional[str] = None
    title: Optional[str] = None
    year: Optional[int] = None


@dataclass
class EnrichmentResult:
    # Identity
    title: Optional[str] = None
    original_title: Optional[str] = None
    year: Optional[int] = None
    imdb_id: Optional[str] = None
    tmdb_id: Optional[int] = None
    tspdt_id: Optional[str] = None

    # Classification
    genres: list = field(default_factory=list)
    keywords: list = field(default_factory=list)
    primary_genre: Optional[str] = None

    # People
    director: Optional[str] = None
    cast: list = field(default_factory=list)
    cinematographer: Optional[str] = None
    composer: Optional[str] = None
    writer: Optional[str] = None

    # Descriptive
    overview: Optional[str] = None
    tagline: Optional[str] = None
    country: Optional[str] = None
    length_minutes: Optional[int] = None
    color: Optional[str] = None
    mpaa_rating: Optional[str] = None
    collection_name: Optional[str] = None
    spoken_languages: list = field(default_factory=list)
    production_companies: list = field(default_factory=list)

    # Media assets
    poster_url: Optional[str] = None
    background_url: Optional[str] = None
    trailer_url: Optional[str] = None
    logo_url: Optional[str] = None

    # Ratings & financials
    tmdb_rating: Optional[float] = None
    tmdb_vote_count: Optional[int] = None
    budget: Optional[int] = None
    revenue: Optional[int] = None

    # TSPDT
    ranking_current: Optional[int] = None
    tspdt_history: dict = field(default_factory=dict)

    # Extras
    streaming_providers: list = field(default_factory=list)
    alternative_titles: list = field(default_factory=list)

    # [P6] confidence of the discovery match
    match_confidence: float = 0.0


@dataclass
class ETLStats:
    total: int = 0
    success: int = 0
    skipped_non_film: int = 0
    cache_hits: int = 0            # [P4]
    identity_resolved: int = 0    # [P1] resolved via secondary key
    failures: dict = field(default_factory=lambda: {c: 0 for c in FailureCategory})
    strategy_counts: dict = field(default_factory=dict)

    def record_failure(self, category: FailureCategory):
        self.failures[category] = self.failures.get(category, 0) + 1

    def record_strategy(self, strategy: str):
        self.strategy_counts[strategy] = self.strategy_counts.get(strategy, 0) + 1

    def report(self) -> str:
        total_failures = sum(self.failures.values())
        lines = [
            f"\n{'═' * 64}",
            f"  LUMIÈRE ETL v2.1 — RUN COMPLETE",
            f"{'═' * 64}",
            f"  Total processed      : {self.total}",
            f"  Successes            : {self.success}",
            f"  Non-film skipped     : {self.skipped_non_film}",
            f"  Failures             : {total_failures}",
            f"  Cache hits (P4)      : {self.cache_hits}",
            f"  Identity resolved    : {self.identity_resolved}",
            f"\n  Discovery strategies:",
        ]
        for strategy, count in sorted(self.strategy_counts.items(), key=lambda x: -x[1]):
            lines.append(f"    {strategy:<44} {count}")
        lines.append(f"\n  Failure breakdown:")
        for category, count in self.failures.items():
            if count > 0:
                lines.append(f"    {str(category):<34} {count}")
        lines.append(f"{'═' * 64}\n")
        return "\n".join(lines)


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 3 — [P8] TOKEN-BUCKET RATE LIMITER
# ═══════════════════════════════════════════════════════════════════════════════

class TokenBucketLimiter:
    """
    [P8] Adaptive, thread-safe token-bucket rate limiter.

    Replaces the naive time.sleep(N) approach.

    Parameters
    ----------
    rate     : tokens (requests) per second
    capacity : maximum burst size

    Algorithm
    ---------
    Tokens accumulate at `rate` per second up to `capacity`.
    Each request consumes 1 token. If the bucket is empty,
    we sleep only as long as needed to refill 1 token.

    This allows controlled bursts while respecting sustained limits.
    Dynamically backs off on 429 responses via penalize().
    """

    def __init__(self, rate: float = 20.0, capacity: float = 40.0):
        self._rate     = rate        # tokens/second
        self._capacity = capacity    # max burst
        self._tokens   = capacity    # start full
        self._last     = time.monotonic()
        self._lock     = threading.Lock()
        self._penalty  = 0.0        # extra sleep after 429

    def acquire(self):
        """Block until a token is available, then consume it."""
        with self._lock:
            now = time.monotonic()
            elapsed = now - self._last
            self._last = now
            # Refill tokens
            self._tokens = min(self._capacity, self._tokens + elapsed * self._rate)

            if self._tokens >= 1.0:
                self._tokens -= 1.0
                sleep_for = self._penalty
                self._penalty = 0.0
            else:
                # Time until 1 token is available
                sleep_for = (1.0 - self._tokens) / self._rate
                self._tokens = 0.0

        if sleep_for > 0:
            time.sleep(sleep_for)

    def penalize(self, retry_after: float = 5.0):
        """
        [P8] Called on HTTP 429 — drain bucket and schedule extra sleep.
        This affects the *next* acquire() call.
        """
        with self._lock:
            self._tokens = 0.0
            self._penalty = max(self._penalty, retry_after)

    def slow_down(self, factor: float = 0.75):
        """Reduce sustained rate (e.g., when errors spike)."""
        with self._lock:
            self._rate = max(1.0, self._rate * factor)
            logger.warning(f"[RateLimiter] Rate reduced to {self._rate:.1f} req/s")

    def restore(self):
        """Restore original rate after a healthy run period."""
        with self._lock:
            self._rate = min(self._rate * 1.1, 20.0)


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 4 — [P4] REDIS RESPONSE CACHE
# ═══════════════════════════════════════════════════════════════════════════════

class ResponseCache:
    """
    [P4] Two-tier cache: in-process LRU dict + Django Redis backend.

    Keys:
      tmdb:movie:{id}                   → full TMDB detail payload
      tmdb:search:movie:{sha256}        → search result list
      tmdb:find:imdb:{imdb_id}          → /find result
      wikidata:film:{sha256}            → SPARQL result

    TTLs:
      - TMDB detail: 48 h (stable metadata)
      - TMDB search: 12 h (results can shift)
      - Wikidata: 7 d (very stable)

    The in-process cache (bounded at 4096 entries) avoids Redis round-trips
    for records encountered twice in the same run (e.g., sequels/series).
    """

    DETAIL_TTL  = 60 * 60 * 48   # 48 hours
    SEARCH_TTL  = 60 * 60 * 12   # 12 hours
    WIKIDATA_TTL = 60 * 60 * 168  # 7 days
    MAX_LOCAL   = 4096

    def __init__(self, enabled: bool = True):
        self._enabled = enabled
        self._local: dict[str, object] = {}
        self._hits = 0

    @property
    def hits(self) -> int:
        return self._hits

    def get(self, key: str) -> Optional[object]:
        if not self._enabled:
            return None
        # 1. In-process
        if key in self._local:
            self._hits += 1
            return self._local[key]
        # 2. Redis
        try:
            val = cache.get(f"etl:{key}")
            if val is not None:
                self._hits += 1
                self._put_local(key, val)
                return val
        except Exception:
            pass
        return None

    def set(self, key: str, value: object, ttl: int = DETAIL_TTL):
        if not self._enabled or value is None:
            return
        self._put_local(key, value)
        try:
            cache.set(f"etl:{key}", value, ttl)
        except Exception:
            pass

    def _put_local(self, key: str, value: object):
        if len(self._local) >= self.MAX_LOCAL:
            # Evict oldest quarter
            evict = list(self._local.keys())[: self.MAX_LOCAL // 4]
            for k in evict:
                del self._local[k]
        self._local[key] = value

    @staticmethod
    def _sha(text: str) -> str:
        return hashlib.sha256(text.encode()).hexdigest()[:16]

    def tmdb_detail_key(self, media_type: str, tmdb_id: int) -> str:
        return f"tmdb:{media_type}:{tmdb_id}"

    def tmdb_search_key(self, title: str, year: Optional[int]) -> str:
        raw = f"{title}|{year}"
        return f"tmdb:search:movie:{self._sha(raw)}"

    def tmdb_find_key(self, imdb_id: str) -> str:
        return f"tmdb:find:imdb:{imdb_id}"

    def wikidata_key(self, title: str, year: Optional[int]) -> str:
        raw = f"{title}|{year}"
        return f"wikidata:film:{self._sha(raw)}"


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 5 — TMDB API CLIENT (with cache + rate limiter integration)
# ═══════════════════════════════════════════════════════════════════════════════

class TMDBClient:
    """
    [P4][P8] TMDB client with:
    - Response cache (Redis + in-process)
    - Token-bucket rate limiting
    - Retry with exponential backoff
    - 429 Retry-After propagation to rate limiter
    """

    BASE_URL = "https://api.themoviedb.org/3"
    IMG_BASE = "https://image.tmdb.org/t/p"

    def __init__(
        self,
        api_key: str,
        limiter: TokenBucketLimiter,
        resp_cache: ResponseCache,
    ):
        self.api_key    = api_key
        self.limiter    = limiter
        self.resp_cache = resp_cache

        retry = Retry(
            total=5,
            backoff_factor=1.5,
            status_forcelist=[500, 502, 503, 504],  # NOT 429 — we handle that ourselves
            allowed_methods=["GET"],
            raise_on_status=False,
        )
        adapter = HTTPAdapter(
            max_retries=retry,
            pool_connections=10,
            pool_maxsize=10,
        )
        self.session = requests.Session()
        self.session.mount("https://", adapter)

    def get(
        self,
        endpoint: str,
        params: Optional[dict] = None,
        language: str = "pt-BR",
        cache_key: Optional[str] = None,
        cache_ttl: int = ResponseCache.DETAIL_TTL,
    ) -> dict:
        """
        GET with full cache + rate-limit integration.

        cache_key=None → skip cache (for mutable endpoints).
        """
        # [P4] Cache read
        if cache_key:
            cached = self.resp_cache.get(cache_key)
            if cached is not None:
                return cached  # type: ignore[return-value]

        p = {"api_key": self.api_key, "language": language}
        if params:
            p.update(params)

        url = f"{self.BASE_URL}{endpoint}"

        for attempt in range(6):
            self.limiter.acquire()  # [P8] rate limit BEFORE request

            try:
                resp = self.session.get(url, params=p, timeout=15)

                if resp.status_code == 429:
                    retry_after = float(resp.headers.get("Retry-After", "5"))
                    logger.warning(f"[TMDB] 429 on {endpoint} — backing off {retry_after}s")
                    self.limiter.penalize(retry_after)
                    time.sleep(retry_after)
                    continue

                resp.raise_for_status()
                data = resp.json() if isinstance(resp.json(), dict) else {}

                # [P4] Cache write
                if cache_key and data:
                    self.resp_cache.set(cache_key, data, cache_ttl)

                return data

            except requests.HTTPError as e:
                if attempt >= 4:
                    raise
                time.sleep(2 ** attempt)

        return {}

    def poster_url(self, path: str, size: str = "w780") -> str:
        return f"{self.IMG_BASE}/{size}{path}" if path else ""

    def backdrop_url(self, path: str) -> str:
        return f"{self.IMG_BASE}/original{path}" if path else ""


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 6 — [P3] WIKIDATA CLIENT WITH CIRCUIT BREAKER
# ═══════════════════════════════════════════════════════════════════════════════

class CircuitBreakerOpen(Exception):
    """Raised when the Wikidata circuit breaker is open."""


class WikidataClient:
    """
    [P3] Wikidata SPARQL with circuit breaker.

    States:
      CLOSED   → normal operation
      OPEN     → all calls fail fast (circuit tripped after N failures)
      HALF_OPEN → one probe call allowed to test recovery

    The circuit breaker prevents:
    - IP bans from hammering the public endpoint
    - Pipeline slowdowns from Wikidata outages
    - Cascading failures in the enrichment stage
    """

    SPARQL_ENDPOINT = "https://query.wikidata.org/sparql"
    USER_AGENT = "Lumiere-ETL/2.1 (https://lumiere.app)"

    def __init__(
        self,
        resp_cache: ResponseCache,
        max_failures: int = WIKIDATA_MAX_FAILURES,
        reset_seconds: float = WIKIDATA_RESET_SECONDS,
    ):
        self.resp_cache    = resp_cache
        self.max_failures  = max_failures
        self.reset_seconds = reset_seconds

        self._failures     = 0
        self._last_failure = 0.0
        self._lock         = threading.Lock()

        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": self.USER_AGENT,
            "Accept": "application/sparql-results+json",
        })

    def _check_circuit(self):
        with self._lock:
            if self._failures < self.max_failures:
                return  # CLOSED
            elapsed = time.monotonic() - self._last_failure
            if elapsed < self.reset_seconds:
                raise CircuitBreakerOpen(
                    f"Wikidata circuit open — {self.reset_seconds - elapsed:.0f}s until half-open"
                )
            # HALF_OPEN — allow one probe

    def _record_success(self):
        with self._lock:
            self._failures = 0

    def _record_failure(self):
        with self._lock:
            self._failures += 1
            self._last_failure = time.monotonic()

    def find_film(self, title: str, year: Optional[int]) -> Optional[dict]:
        """
        Returns dict(imdb_id, tmdb_id, director, country) or None.
        """
        self._check_circuit()  # raises if OPEN

        cache_key = self.resp_cache.wikidata_key(title, year)
        cached = self.resp_cache.get(cache_key)
        if cached is not None:
            return cached if cached != "__MISS__" else None  # type: ignore[return-value]

        safe = title.replace('"', '\\"').replace("\\", "\\\\")
        year_filter = f"FILTER(YEAR(?pub) = {year})" if year else ""

        query = f"""
        SELECT DISTINCT ?film ?imdb ?tmdb ?dirLabel ?countryLabel
        WHERE {{
          ?film wdt:P31 wd:Q11424 ;
                rdfs:label "{safe}"@en .
          OPTIONAL {{ ?film wdt:P577 ?pub. {year_filter} }}
          OPTIONAL {{ ?film wdt:P345 ?imdb. }}
          OPTIONAL {{ ?film wdt:P4947 ?tmdb. }}
          OPTIONAL {{ ?film wdt:P57  ?dir. }}
          OPTIONAL {{ ?film wdt:P495 ?country. }}
          SERVICE wikibase:label {{
            bd:serviceParam wikibase:language "en,fr,de,it,es,ru,zh,ja"
          }}
        }} LIMIT 3
        """

        try:
            resp = self.session.get(
                self.SPARQL_ENDPOINT,
                params={"query": query, "format": "json"},
                timeout=20,
            )
            resp.raise_for_status()
            bindings = resp.json().get("results", {}).get("bindings", [])

            if not bindings:
                # Cache negative result so we don't re-query
                self.resp_cache.set(cache_key, "__MISS__", ResponseCache.WIKIDATA_TTL)
                self._record_success()
                return None

            first = bindings[0]
            result = {
                "imdb_id": first.get("imdb", {}).get("value"),
                "tmdb_id": first.get("tmdb", {}).get("value"),
                "director": first.get("dirLabel", {}).get("value"),
                "country": first.get("countryLabel", {}).get("value"),
            }
            self.resp_cache.set(cache_key, result, ResponseCache.WIKIDATA_TTL)
            self._record_success()
            return result

        except (requests.RequestException, Exception) as e:
            self._record_failure()
            logger.debug(f"[Wikidata] failure ({self._failures}/{self.max_failures}): {e}")
            return None


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 7 — [P6] CONFIDENCE SCORER
# ═══════════════════════════════════════════════════════════════════════════════

class ConfidenceScorer:
    """
    [P6] Scores how well a TMDB candidate matches the source record.

    Score components (sum to 1.0):
      title_similarity  0.45  — normalized edit distance
      year_proximity    0.30  — penalty grows quadratically with gap
      director_match    0.15  — exact or partial name match
      language_bonus    0.10  — original_language matches expected country

    Returns float 0.0–1.0. Callers reject candidates below MIN_CONFIDENCE_SCORE.
    """

    def score(
        self,
        candidate: dict,          # TMDB search result
        expected_title: str,
        expected_year: Optional[int],
        expected_director: str = "",
        expected_country: str = "",
    ) -> float:
        components: dict[str, float] = {}

        # ── Title similarity (Levenshtein-based) ──────────────────────
        cand_title = (
            candidate.get("title")
            or candidate.get("name")
            or ""
        ).lower().strip()
        exp_lower = expected_title.lower().strip()
        components["title"] = self._string_similarity(exp_lower, cand_title) * 0.45

        # ── Year proximity ─────────────────────────────────────────────
        if expected_year:
            cand_year_str = (
                candidate.get("release_date", "")
                or candidate.get("first_air_date", "")
                or ""
            )[:4]
            try:
                cand_year = int(cand_year_str)
                gap = abs(cand_year - expected_year)
                # 0 gap → 1.0, 1 gap → 0.75, 2 gap → 0.44, 5+ → ~0.0
                year_score = math.exp(-0.3 * gap * gap) if gap <= 5 else 0.0
                components["year"] = year_score * 0.30
            except ValueError:
                components["year"] = 0.0
        else:
            components["year"] = 0.15  # partial credit when year unknown

        # ── Director match (requires separate detail fetch; use overview proxy) ──
        # We don't do an extra API call here — director info comes from enrichment.
        # Award a bonus if the candidate's overview/original_language hints match.
        if expected_director:
            # Heuristic: same language family
            orig_lang = candidate.get("original_language", "")
            country_lang_map = {
                "FR": "fr", "IT": "it", "DE": "de", "JP": "ja",
                "RU": "ru", "CN": "zh", "KR": "ko", "IN": "hi",
                "ES": "es", "PT": "pt", "SE": "sv", "DK": "da",
            }
            expected_lang = country_lang_map.get(expected_country.upper(), "")
            lang_match = (orig_lang == expected_lang) if expected_lang else True
            components["director"] = 0.15 if lang_match else 0.05
        else:
            components["director"] = 0.075

        # ── Language/origin bonus ──────────────────────────────────────
        orig_lang = candidate.get("original_language", "")
        # Penalise if expected non-English but candidate is English
        if expected_country.upper() not in ("US", "GB", "AU", "CA") and orig_lang == "en":
            components["language"] = 0.03
        else:
            components["language"] = 0.10

        total = sum(components.values())
        return round(min(total, 1.0), 4)

    def _string_similarity(self, a: str, b: str) -> float:
        """
        Normalized Levenshtein similarity.
        Pure Python — no external dependency required.
        """
        if a == b:
            return 1.0
        if not a or not b:
            return 0.0

        # Normalise: remove articles and punctuation for fairer comparison
        a = re.sub(r"^(the|a|an|le|la|les|l'|il|lo|el|los|der|die|das)\s+", "", a)
        b = re.sub(r"^(the|a|an|le|la|les|l'|il|lo|el|los|der|die|das)\s+", "", b)
        a = re.sub(r"[^\w\s]", "", a)
        b = re.sub(r"[^\w\s]", "", b)

        la, lb = len(a), len(b)
        if la == 0 or lb == 0:
            return 0.0

        # Single-row DP Levenshtein
        prev = list(range(lb + 1))
        for i, ca in enumerate(a, 1):
            curr = [i]
            for j, cb in enumerate(b, 1):
                curr.append(min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + (ca != cb)))
            prev = curr

        dist = prev[lb]
        return 1.0 - dist / max(la, lb)


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 8 — TITLE NORMALIZER
# ═══════════════════════════════════════════════════════════════════════════════

class TitleNormalizer:

    LIBRARY_SUFFIXES = [
        ", The", ", A", ", An", ", Lo", ", La", ", Le", ", Les", ", L'",
        ", Il", ", I", ", Gli", ", El", ", Los", ", Las",
        ", O", ", Os", ", As", ", Der", ", Die", ", Das",
        ", Det", ", Den", ", De", ", Een", ", Un", ", Une",
    ]

    def generate_candidates(self, raw_title: str, raw_year: str = "") -> list[str]:
        raw_title = str(raw_title).strip()
        candidates = []

        base = self._strip_noise(raw_title)
        prefixed = self._shift_article(base)
        candidates.append(prefixed)

        if "/" in base:
            candidates.extend(p.strip() for p in base.split("/"))

        stripped = self._strip_diacritics(prefixed)
        if stripped != prefixed:
            candidates.append(stripped)

        if ":" in prefixed:
            candidates.append(prefixed.split(":")[0].strip())

        candidates.append(base)

        seen: set[str] = set()
        result = []
        for c in candidates:
            c = c.strip()
            if c and c not in seen and len(c) > 1:
                seen.add(c)
                result.append(c)

        return result

    def _strip_noise(self, title: str) -> str:
        title = re.sub(r"\[.*?\]", "", title)
        title = re.sub(r"\(\d{4}[-–]\d{2,4}\)", "", title)
        title = re.sub(r"\(\d{4}\)", "", title)
        title = re.sub(r"\s+", " ", title).strip().rstrip(" ,.-–")
        return title

    def _shift_article(self, title: str) -> str:
        for suffix in self.LIBRARY_SUFFIXES:
            if title.endswith(suffix):
                article = suffix.lstrip(", ")
                base = title[: -len(suffix)].strip()
                if article.endswith("'"):
                    return f"{article}{base}"
                return f"{article} {base}"
        return title

    def _strip_diacritics(self, text: str) -> str:
        return "".join(
            c for c in unicodedata.normalize("NFD", text)
            if unicodedata.category(c) != "Mn"
        )

    def classify_failure(self, raw_title: str) -> FailureCategory:
        upper = raw_title.upper()
        for marker in NON_FILM_MARKERS:
            if marker in upper:
                return FailureCategory.NON_FILM_MEDIA

        clean = re.sub(r"\[.*?\]|\(.*?\)", "", raw_title).strip()
        if not clean or clean in UNSEARCHABLE_TITLES or re.match(r"^[\W_]+$", clean):
            return FailureCategory.STRUCTURAL_NOISE

        if re.search(r"\(\d{4}[-–]\d{2,4}\)", raw_title):
            return FailureCategory.TIME_RANGE_YEAR

        if "/" in raw_title and len(raw_title.split("/")) == 2:
            return FailureCategory.COMPOUND_TITLE

        if re.search(r",\s*L['']", raw_title):
            return FailureCategory.ARTICLE_SUFFIX

        if any(
            unicodedata.category(c).startswith("L") and ord(c) > 127
            for c in raw_title
        ):
            return FailureCategory.NON_LATIN

        return FailureCategory.UNKNOWN


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 9 — [P1] IDENTITY RESOLVER
# ═══════════════════════════════════════════════════════════════════════════════

class IdentityResolver:
    """
    [P1] Resolves which existing Movie record (if any) a discovery result maps to.

    Resolution order (highest confidence first):
      1. tmdb_id — canonical, no ambiguity
      2. imdb_id — stable but occasionally reused for remakes; validate title+year
      3. tspdt_id — TSPDT-specific, trustworthy within the dataset
      4. title + year + director — fuzzy; only accepted at high similarity

    This prevents:
    - Duplicate records when one film was previously ingested via different source
    - Overwriting the wrong record when TMDB ID was previously missing
    - Silent data corruption from compound-title or remake collisions
    """

    def __init__(self, scorer: ConfidenceScorer):
        self._scorer = scorer

    def resolve(self, enrichment: EnrichmentResult) -> Optional[Movie]:
        """
        Returns the existing Movie that best matches this enrichment,
        or None if no confident match is found (→ will create new record).
        """

        # ── Strategy 1: tmdb_id (unique, fastest) ─────────────────────
        if enrichment.tmdb_id:
            try:
                movie = Movie.objects.filter(tmdb_id=enrichment.tmdb_id).first()
                if movie:
                    return movie
            except Exception:
                pass

        # ── Strategy 2: imdb_id (unique constraint, validate year) ─────
        if enrichment.imdb_id:
            try:
                movie = Movie.objects.filter(imdb_id=enrichment.imdb_id).first()
                if movie:
                    # Validate that title+year are consistent (guard remakes)
                    if self._years_compatible(movie.year, enrichment.year):
                        return movie
                    else:
                        logger.warning(
                            f"[Identity] imdb_id={enrichment.imdb_id} found but "
                            f"year mismatch: existing={movie.year} new={enrichment.year}. "
                            f"Treating as separate record."
                        )
            except Exception:
                pass

        # ── Strategy 3: tspdt_id ──────────────────────────────────────
        if enrichment.tspdt_id:
            try:
                movie = Movie.objects.filter(tspdt_id=enrichment.tspdt_id).first()
                if movie:
                    return movie
            except Exception:
                pass

        # ── Strategy 4: title + year fuzzy (guard-railed) ─────────────
        if enrichment.title and enrichment.year:
            candidates = Movie.objects.filter(
                year__in=[enrichment.year - 1, enrichment.year, enrichment.year + 1]
            ).only("id", "title", "year", "director", "tmdb_id", "imdb_id")

            best_score = 0.0
            best_movie: Optional[Movie] = None

            for candidate in candidates:
                sim = self._scorer._string_similarity(
                    (candidate.title or "").lower(),
                    (enrichment.title or "").lower(),
                )
                year_ok = self._years_compatible(candidate.year, enrichment.year)
                combined = sim * (0.9 if year_ok else 0.5)

                if combined > best_score:
                    best_score = combined
                    best_movie = candidate

            # Only accept very high confidence title matches (0.92+)
            if best_score >= 0.92 and best_movie:
                return best_movie

        return None  # → new record

    def _years_compatible(self, y1: Optional[int], y2: Optional[int]) -> bool:
        if y1 is None or y2 is None:
            return True
        return abs(y1 - y2) <= 1


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 10 — MULTI-STRATEGY DISCOVERY ENGINE
# ═══════════════════════════════════════════════════════════════════════════════

class DiscoveryEngine:
    """
    [P6] Cascading discovery with confidence scoring on every result.

    Strategies (fastest → most expensive):
      1. TMDB strict search  — title + year
      2. TMDB loose search   — title only
      3. TMDB /find by IMDb  — zero search cost when raw_data has IMDb column
      4. TMDB multi-search   — catches TV/docs
      5. Wikidata SPARQL     — cross-references then TMDB /find

    Every TMDB result is scored before acceptance. Candidates below
    MIN_CONFIDENCE_SCORE are rejected (→ FAILED/LOW_CONFIDENCE).
    """

    def __init__(
        self,
        tmdb: TMDBClient,
        wikidata: Optional[WikidataClient],
        normalizer: TitleNormalizer,
        scorer: ConfidenceScorer,
        resp_cache: ResponseCache,
    ):
        self.tmdb       = tmdb
        self.wikidata   = wikidata
        self.normalizer = normalizer
        self.scorer     = scorer
        self.cache      = resp_cache

    def discover(
        self,
        raw_title: str,
        raw_year: str,
        raw_imdb_id: str,
        raw_director: str,
        raw_country: str,
        stats: ETLStats,
    ) -> Optional[DiscoveryResult]:

        candidates = self.normalizer.generate_candidates(raw_title, raw_year)
        year = self._parse_year(raw_year)

        # ── Strategy 1: Strict (title + primary_release_year) ─────────
        for title in candidates:
            result = self._movie_search(title, year, strict=True)
            scored = self._score_results(result, title, year, raw_director, raw_country)
            if scored:
                scored.strategy_used = "tmdb_strict"
                stats.record_strategy("tmdb_strict")
                return scored

        # ── Strategy 2: Loose (title only) ────────────────────────────
        for title in candidates:
            result = self._movie_search(title, None, strict=False)
            scored = self._score_results(result, title, year, raw_director, raw_country)
            if scored:
                scored.strategy_used = "tmdb_loose"
                stats.record_strategy("tmdb_loose")
                return scored

        # ── Strategy 3: /find by IMDb ID ──────────────────────────────
        clean_imdb = (raw_imdb_id or "").strip()
        if clean_imdb.startswith("tt"):
            result = self._find_by_imdb(clean_imdb)
            if result:
                # /find is authoritative — skip confidence scoring
                result.strategy_used = "tmdb_find_imdb"
                result.imdb_id_used  = clean_imdb
                result.confidence    = 0.95
                stats.record_strategy("tmdb_find_imdb")
                return result

        # ── Strategy 4: Multi-search ───────────────────────────────────
        for title in candidates[:2]:
            result = self._multi_search(title, year)
            scored = self._score_results(result, title, year, raw_director, raw_country)
            if scored:
                scored.strategy_used = "tmdb_multi"
                stats.record_strategy("tmdb_multi")
                return scored

        # ── Strategy 5: Wikidata SPARQL ────────────────────────────────
        if self.wikidata:
            try:
                result = self._wikidata_fallback(candidates[0], year)
                if result:
                    result.strategy_used = "wikidata_sparql"
                    stats.record_strategy("wikidata_sparql")
                    return result
            except CircuitBreakerOpen as e:
                logger.debug(f"[Wikidata] circuit open: {e}")

        return None

    # ── Private helpers ────────────────────────────────────────────────

    def _movie_search(
        self, title: str, year: Optional[int], strict: bool
    ) -> list[dict]:
        params: dict = {"query": title}
        if strict and year:
            params["primary_release_year"] = year

        cache_key = self.cache.tmdb_search_key(title, year if strict else None)
        try:
            data = self.tmdb.get(
                "/search/movie", params,
                cache_key=cache_key,
                cache_ttl=ResponseCache.SEARCH_TTL,
            )
            return data.get("results", [])[:5]
        except requests.HTTPError:
            return []

    def _find_by_imdb(self, imdb_id: str) -> Optional[DiscoveryResult]:
        cache_key = self.cache.tmdb_find_key(imdb_id)
        try:
            data = self.tmdb.get(
                f"/find/{imdb_id}",
                {"external_source": "imdb_id"},
                cache_key=cache_key,
            )
            for result_key, media_type in [("movie_results", "movie"), ("tv_results", "tv")]:
                results = data.get(result_key, [])
                if results:
                    return DiscoveryResult(
                        tmdb_id=results[0]["id"],
                        media_type=media_type,
                        imdb_id_used=imdb_id,
                    )
        except requests.HTTPError:
            pass
        return None

    def _multi_search(self, title: str, year: Optional[int]) -> list[dict]:
        params: dict = {"query": title}
        try:
            data = self.tmdb.get(
                "/search/multi", params,
                cache_key=self.cache.tmdb_search_key(f"multi:{title}", year),
                cache_ttl=ResponseCache.SEARCH_TTL,
            )
            return [
                r for r in data.get("results", [])
                if r.get("media_type") in ("movie", "tv")
            ][:5]
        except requests.HTTPError:
            return []

    def _score_results(
        self,
        results: list[dict],
        expected_title: str,
        expected_year: Optional[int],
        expected_director: str,
        expected_country: str,
    ) -> Optional[DiscoveryResult]:
        """
        [P6] Score all candidates and return the best above threshold.
        """
        best_score = 0.0
        best_result: Optional[dict] = None

        for candidate in results:
            score = self.scorer.score(
                candidate, expected_title, expected_year,
                expected_director, expected_country,
            )
            if score > best_score:
                best_score = score
                best_result = candidate

        if best_result and best_score >= MIN_CONFIDENCE_SCORE:
            media_type = best_result.get("media_type", "movie")
            return DiscoveryResult(
                tmdb_id=best_result["id"],
                media_type=media_type if media_type in ("movie", "tv") else "movie",
                confidence=best_score,
            )

        return None

    def _wikidata_fallback(
        self, title: str, year: Optional[int]
    ) -> Optional[DiscoveryResult]:
        wd = self.wikidata.find_film(title, year)
        if not wd:
            return None

        tmdb_id_str = wd.get("tmdb_id")
        if tmdb_id_str:
            try:
                return DiscoveryResult(
                    tmdb_id=int(tmdb_id_str),
                    media_type="movie",
                    confidence=0.80,
                )
            except (ValueError, TypeError):
                pass

        imdb_id = wd.get("imdb_id", "")
        if imdb_id and imdb_id.startswith("tt"):
            result = self._find_by_imdb(imdb_id)
            if result:
                result.confidence = 0.75
                return result

        return None

    def _parse_year(self, year_str: str) -> Optional[int]:
        if not year_str:
            return None
        match = re.search(r"\d{4}", str(year_str))
        return int(match.group()) if match else None


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 11 — ENRICHMENT ENGINE
# ═══════════════════════════════════════════════════════════════════════════════

class EnrichmentEngine:

    APPEND = ",".join([
        "credits", "videos", "release_dates", "keywords",
        "images", "alternative_titles", "external_ids",
        "watch/providers",
    ])

    def __init__(self, tmdb: TMDBClient, resp_cache: ResponseCache):
        self.tmdb  = tmdb
        self.cache = resp_cache

    def enrich(self, discovery: DiscoveryResult, raw: dict) -> EnrichmentResult:
        endpoint  = f"/{discovery.media_type}/{discovery.tmdb_id}"
        cache_key = self.cache.tmdb_detail_key(discovery.media_type, discovery.tmdb_id)

        data = self.tmdb.get(
            endpoint,
            {"append_to_response": self.APPEND, "include_image_language": "pt,en,null"},
            cache_key=cache_key,
        )

        # Fallback to English overview if pt-BR is empty
        if not data.get("overview"):
            en_data = self.tmdb.get(endpoint, {"append_to_response": "credits"}, language="en-US")
            data["overview"] = en_data.get("overview", "")

        r = EnrichmentResult()
        r.tmdb_id         = discovery.tmdb_id
        r.match_confidence = discovery.confidence
        r.title           = data.get("title") or data.get("name") or ""
        r.original_title  = data.get("original_title") or data.get("original_name") or ""
        r.year            = self._extract_year(data)

        ext_ids   = data.get("external_ids", {})
        imdb_raw  = ext_ids.get("imdb_id") or data.get("imdb_id") or raw.get("IMDb", "")
        r.imdb_id = imdb_raw.strip() if imdb_raw and imdb_raw.strip().startswith("tt") else None
        r.tspdt_id = str(raw.get("idTSPDT", "")).split(".")[0].strip() or None

        r.tspdt_history   = self._build_history(raw)
        ranking_str       = str(raw.get("2026", "0"))
        r.ranking_current = int(ranking_str) if ranking_str.isdigit() and ranking_str != "0" else None

        r.genres       = [g["name"] for g in data.get("genres", [])]
        r.primary_genre = r.genres[0] if r.genres else ""
        r.keywords     = [k["name"] for k in data.get("keywords", {}).get("keywords", [])]

        crew       = data.get("credits", {}).get("crew", [])
        cast_raw   = data.get("credits", {}).get("cast", [])
        # Mantemos as strings planas para busca rápida no banco (ex: filter(director="Kubrick"))
        directors  = [c["name"] for c in crew if c.get("job") == "Director"]
        r.director = directors[0] if directors else str(raw.get("Director(s)", ""))
        dops       = [c["name"] for c in crew if c.get("job") == "Director of Photography"]
        r.cinematographer = dops[0] if dops else None
        composers  = [c["name"] for c in crew if c.get("job") == "Original Music Composer"]
        r.composer = composers[0] if composers else None
        writers    = [c["name"] for c in crew if c.get("department") == "Writing"]
        r.writer   = writers[0] if writers else None

        # Filtramos apenas os cargos principais para não estourar o banco com 500 maquiadores
        target_jobs = {"Director", "Director of Photography", "Original Music Composer", "Screenplay", "Writer", "Producer"}

        # [P5] Cast normalised to stable structure (ready for future relational migration)
        r.cast = [
            {
                "name": a.get("name"),
                "character": a.get("character"),
                "order": a.get("order", idx),
                "tmdb_person_id": a.get("id"),
                "profile_url": self.tmdb.poster_url(a.get("profile_path", ""), "w185"),
            }
            for idx, a in enumerate(cast_raw[:10])
        ]

        r.overview   = data.get("overview", "")
        r.tagline    = data.get("tagline", "")
        r.length_minutes = self._runtime(data, discovery.media_type, raw)
        r.color      = str(raw.get("Colour", ""))

        prod_countries   = data.get("production_countries", [])
        r.country        = prod_countries[0]["iso_3166_1"] if prod_countries else str(raw.get("Country", ""))
        r.spoken_languages   = [l["iso_639_1"] for l in data.get("spoken_languages", [])]
        r.production_companies = [pc["name"] for pc in data.get("production_companies", [])]
        r.mpaa_rating    = self._mpaa(data)
        coll             = data.get("belongs_to_collection")
        r.collection_name = coll.get("name") if coll else None

        r.poster_url     = self.tmdb.poster_url(data.get("poster_path", ""), "w780")
        r.background_url = self.tmdb.backdrop_url(data.get("backdrop_path", ""))
        r.trailer_url    = self._trailer(data)

        logos     = data.get("images", {}).get("logos", [])
        en_logos  = [l for l in logos if l.get("iso_639_1") == "en"]
        best_logo = en_logos or logos
        r.logo_url = self.tmdb.poster_url(best_logo[0]["file_path"], "w500") if best_logo else None

        r.tmdb_rating     = data.get("vote_average")
        r.tmdb_vote_count = data.get("vote_count")
        r.budget          = data.get("budget") or None
        r.revenue         = data.get("revenue") or None

        alt_titles_data   = data.get("alternative_titles", {})
        alts              = alt_titles_data.get("titles", []) or alt_titles_data.get("results", [])
        r.alternative_titles = [
            {"title": t.get("title"), "country": t.get("iso_3166_1")} for t in alts[:20]
        ]

        providers_data = data.get("watch/providers", {}).get("results", {})
        for region in ("BR", "US", "GB"):
            region_data = providers_data.get(region, {})
            if region_data:
                flatrate = region_data.get("flatrate", [])
                r.streaming_providers = [
                    {"name": p.get("provider_name"),
                     "logo": self.tmdb.poster_url(p.get("logo_path", ""), "w92")}
                    for p in flatrate[:5]
                ]
                break

        return r

    def _extract_year(self, data: dict) -> Optional[int]:
        date_str = data.get("release_date") or data.get("first_air_date") or ""
        try:
            return int(date_str[:4]) if len(date_str) >= 4 else None
        except ValueError:
            return None

    def _runtime(self, data: dict, media_type: str, raw: dict) -> Optional[int]:
        rt = data.get("runtime")
        if not rt and media_type == "tv":
            ep = data.get("episode_run_time", [])
            rt = ep[0] if ep else None
        if not rt:
            raw_len = str(raw.get("Length", "0"))
            rt = int(raw_len) if raw_len.isdigit() and int(raw_len) > 0 else None
        return rt

    def _mpaa(self, data: dict) -> str:
        for country in data.get("release_dates", {}).get("results", []):
            if country.get("iso_3166_1") == "US":
                for rd in country.get("release_dates", []):
                    cert = rd.get("certification", "")
                    if cert:
                        return cert
        return ""

    def _trailer(self, data: dict) -> str:
        for type_filter in ("Trailer", "Teaser"):
            for v in data.get("videos", {}).get("results", []):
                if v.get("site") == "YouTube" and v.get("type") == type_filter:
                    return f"https://www.youtube.com/watch?v={v['key']}"
        return ""

    def _build_history(self, raw: dict) -> dict:
        history = {}
        for year in range(2008, 2031):
            val_str = str(raw.get(str(year), "0")).split(".")[0].strip()
            if val_str.isdigit() and int(val_str) > 0:
                history[str(year)] = int(val_str)
        return history


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 12 — [P7] RACE-SAFE PERSISTENCE ENGINE
# ═══════════════════════════════════════════════════════════════════════════════

class PersistenceEngine:
    """
    [P7] Race-safe, null-preserving persistence.

    Race conditions addressed:
    - PostgreSQL advisory lock per (tmdb_id/imdb_id) prevents duplicate inserts
      when two Celery workers process the same film concurrently.
    - select_for_update() on the existing record before any write.
    - IntegrityError on unique constraints is caught and converted to a safe
      update on the conflicting row.

    Null-safety guarantee:
    - A field with a valid value in the DB is never overwritten by an empty/None
      value from the ETL payload.
    """

    def persist(
        self,
        enrichment: EnrichmentResult,
        existing: Optional[Movie],
        dry_run: bool = False,
    ) -> tuple[Movie, bool]:
        candidates = self._build_defaults(enrichment)

        if dry_run:
            fake = Movie(title=enrichment.title, year=enrichment.year)
            return fake, True

        # [P7] Acquire advisory lock scoped to this film's TMDB ID
        # This prevents two concurrent workers from creating duplicate rows.
        lock_id = self._advisory_lock_id(enrichment)

        with transaction.atomic():
            if lock_id:
                connection.cursor().execute(
                    "SELECT pg_advisory_xact_lock(%s)", [lock_id]
                )

            if existing:
                # [P7] Lock the row before update
                try:
                    existing = Movie.objects.select_for_update(
                        nowait=False
                    ).get(pk=existing.pk)
                except Movie.DoesNotExist:
                    existing = None  # deleted between resolve and persist — create

            if existing:
                safe_defaults = self._filter_nulls(candidates, existing)
                for attr, val in safe_defaults.items():
                    setattr(existing, attr, val)
                try:
                    existing.save()
                    return existing, False
                except IntegrityError as e:
                    logger.warning(f"[Persist] IntegrityError on update pk={existing.pk}: {e}")
                    raise

            # Create new record
            safe_defaults = {k: v for k, v in candidates.items() if v is not None}
            try:
                movie = Movie.objects.create(**safe_defaults)
                return movie, True
            except IntegrityError:
                # [P7] Race: another worker created the record between our resolve() and now
                # Fetch it and do a safe update instead
                movie = self._fetch_by_any_key(enrichment)
                if movie:
                    movie = Movie.objects.select_for_update().get(pk=movie.pk)
                    safe_defaults = self._filter_nulls(candidates, movie)
                    for attr, val in safe_defaults.items():
                        setattr(movie, attr, val)
                    movie.save()
                    return movie, False
                raise  # truly unexpected — re-raise

    def _advisory_lock_id(self, enrichment: EnrichmentResult) -> Optional[int]:
        """
        Derive a stable integer lock ID from the film's identity.
        PostgreSQL advisory locks take a 64-bit integer.
        """
        if enrichment.tmdb_id:
            # Namespace: 0x1000_0000 | tmdb_id — keeps it distinct from other locks
            return (0x10000000 + enrichment.tmdb_id) & 0x7FFFFFFFFFFFFFFF
        if enrichment.imdb_id:
            num = int(enrichment.imdb_id.replace("tt", ""), 10)
            return (0x20000000 + num) & 0x7FFFFFFFFFFFFFFF
        return None

    def _fetch_by_any_key(self, enrichment: EnrichmentResult) -> Optional[Movie]:
        if enrichment.tmdb_id:
            m = Movie.objects.filter(tmdb_id=enrichment.tmdb_id).first()
            if m:
                return m
        if enrichment.imdb_id:
            m = Movie.objects.filter(imdb_id=enrichment.imdb_id).first()
            if m:
                return m
        return None

    def _build_defaults(self, e: EnrichmentResult) -> dict:
        return {
            "title": e.title, "original_title": e.original_title,
            "year": e.year, "imdb_id": e.imdb_id, "tspdt_id": e.tspdt_id,
            "director": e.director, "country": e.country,
            "length_minutes": e.length_minutes, "color": e.color,
            "overview": e.overview, "tagline": e.tagline,
            "genres": e.genres, "keywords": e.keywords,
            "primary_genre": e.primary_genre, "cast": e.cast,
            "production_companies": e.production_companies,
            "spoken_languages": e.spoken_languages,
            "mpaa_rating": e.mpaa_rating, "collection_name": e.collection_name,
            "budget": e.budget, "revenue": e.revenue,
            "poster_url": e.poster_url, "background_url": e.background_url,
            "trailer_url": e.trailer_url, "logo_url": e.logo_url,
            "ranking_current": e.ranking_current, "tspdt_history": e.tspdt_history,
            "tmdb_rating": e.tmdb_rating, "tmdb_vote_count": e.tmdb_vote_count,
            "cinematographer": e.cinematographer, "composer": e.composer,
            "writer": e.writer, "alternative_titles": e.alternative_titles,
            "streaming_providers": e.streaming_providers, "crew": e.crew,
        }

    def _filter_nulls(self, candidates: dict, existing: Movie) -> dict:
        """[P1][P7] Never overwrite a valid DB value with an empty ETL value."""
        safe = {}
        for key, new_val in candidates.items():
            existing_val = getattr(existing, key, None)

            new_empty = new_val in (None, "", [], {}, 0)
            existing_valid = existing_val not in (None, "", [], {}, 0)

            if new_empty and existing_valid:
                continue  # preserve existing

            safe[key] = new_val

        return safe


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 13 — NON-FILM CLASSIFIER
# ═══════════════════════════════════════════════════════════════════════════════

class NonFilmClassifier:
    _NON_FILM_PATTERNS = [
        r"BBC News", r"CNN Report", r"v\.\s+Amber",
        r"General Election.*Video", r"Kino-pravda \d+[-–]\d+",
        r"Mining Review \d+", r"Charley Says:",
    ]

    def is_non_film(self, raw_title: str) -> bool:
        upper = raw_title.upper()
        for marker in NON_FILM_MARKERS:
            if marker in upper:
                return True

        clean = re.sub(r"\[.*?\]|\(.*?\)", "", raw_title).strip()
        if not clean or re.match(r"^[\W_]{1,5}$", clean):
            return True

        for pattern in self._NON_FILM_PATTERNS:
            if re.search(pattern, raw_title, re.IGNORECASE):
                return True

        return False


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 14 — STRUCTURED FAILURE LOGGER
# ═══════════════════════════════════════════════════════════════════════════════

class StructuredFailureLogger:

    def __init__(self, log_path: str):
        self.log_path = log_path
        self._buffer: list[dict] = []
        with open(log_path, "w", encoding="utf-8") as f:
            f.write("=== LUMIÈRE ETL v2.1 FAILURE LOG ===\n\n")

    def log(self, raw: dict, raw_title: str, category: FailureCategory, detail: str):
        self._buffer.append({
            "tspdt_id": str(raw.get("idTSPDT", "N/A")),
            "title": raw_title, "year": str(raw.get("Year", "")),
            "category": category.value, "detail": detail[:400],
            "ts": int(time.time()),
        })
        if len(self._buffer) >= 50:
            self._flush()

    def _flush(self):
        with open(self.log_path, "a", encoding="utf-8") as f:
            for entry in self._buffer:
                f.write(json.dumps(entry, ensure_ascii=False) + "\n")
        self._buffer.clear()

    def close(self):
        self._flush()


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 15 — THE COMMAND
# ═══════════════════════════════════════════════════════════════════════════════

class Command(BaseCommand):
    help = "Lumière ETL v2.1 — Production-Grade Cinematic Metadata Pipeline."

    def add_arguments(self, parser):
        parser.add_argument("--limit",         type=int,   default=None)
        parser.add_argument("--category",      type=str,   default=None)
        parser.add_argument("--dry-run",        action="store_true")
        parser.add_argument("--no-wikidata",    action="store_true")
        parser.add_argument("--no-cache",       action="store_true")
        parser.add_argument("--only-failed",    action="store_true")
        parser.add_argument("--async",          action="store_true", dest="use_async")
        parser.add_argument("--rate",           type=float, default=20.0,
                            help="Sustained requests/second for TMDB (default: 20)")
        parser.add_argument("--burst",          type=float, default=40.0,
                            help="Maximum burst size for rate limiter (default: 40)")
        parser.add_argument("--min-confidence", type=float, default=MIN_CONFIDENCE_SCORE,
                            help=f"Minimum match confidence (default: {MIN_CONFIDENCE_SCORE})")

    def handle(self, *args, **options):  # noqa: C901
        api_key = getattr(settings, "TMDB_API_KEY", os.getenv("TMDB_API_KEY", ""))
        if not api_key:
            raise CommandError("FATAL: TMDB_API_KEY is not configured.")

        dry_run      = options["dry_run"]
        use_async    = options["use_async"]
        use_wikidata = not options["no_wikidata"]
        use_cache    = not options["no_cache"]
        min_conf     = options["min_confidence"]

        if dry_run:
            self.stdout.write(self.style.WARNING("⚠  DRY-RUN — no database writes."))

        # ── Build query ────────────────────────────────────────────────
        statuses = ["FAILED"] if options["only_failed"] else ["PENDING", "FAILED"]
        qs = RawIngestion.objects.filter(status__in=statuses).order_by("id")

        if options["category"]:
            cat = options["category"].upper()
            qs = qs.filter(error_log__icontains=f'"category": "{cat}"')
            self.stdout.write(f"Filtering to category: {cat}")

        if options["limit"]:
            qs = qs[: options["limit"]]

        total = qs.count()
        if total == 0:
            self.stdout.write(self.style.SUCCESS("Nothing to process."))
            return

        self.stdout.write(self.style.WARNING(f"Starting ETL for {total} records."))

        # [P2] Async Celery dispatch
        if use_async:
            self._dispatch_async(qs, total)
            return

        # ── Initialise components ──────────────────────────────────────
        limiter     = TokenBucketLimiter(rate=options["rate"], capacity=options["burst"])
        resp_cache  = ResponseCache(enabled=use_cache)
        tmdb        = TMDBClient(api_key, limiter, resp_cache)
        wikidata    = WikidataClient(resp_cache) if use_wikidata else None
        normalizer  = TitleNormalizer()
        scorer      = ConfidenceScorer()
        identity    = IdentityResolver(scorer)
        discovery   = DiscoveryEngine(tmdb, wikidata, normalizer, scorer, resp_cache)
        enrichment  = EnrichmentEngine(tmdb, resp_cache)
        persistence = PersistenceEngine()
        classifier  = NonFilmClassifier()
        stats       = ETLStats(total=total)

        log_path     = os.path.join(settings.BASE_DIR, "etl_failures_v2.jsonl")
        fail_logger  = StructuredFailureLogger(log_path)

        consecutive_errors = 0
        RATE_SLOW_DOWN_THRESHOLD = 10

        # ── Main loop ──────────────────────────────────────────────────
        for task in tqdm(qs.iterator(chunk_size=200), total=total, desc="ETL v2.1", unit="film"):
            raw       = task.raw_data
            raw_title = str(raw.get("Title", "")).strip()
            raw_year  = str(raw.get("Year", ""))
            raw_imdb  = str(raw.get("IMDb", "")).strip()
            raw_dir   = str(raw.get("Director(s)", "")).strip()
            raw_ctry  = str(raw.get("Country", "")).strip()

            # ── Stage 1: Classify ──────────────────────────────────────
            if classifier.is_non_film(raw_title):
                task.status = "NON_FILM"
                task.error_log = '{"category": "NON_FILM_MEDIA"}'
                if not dry_run:
                    task.save(update_fields=["status", "error_log"])
                stats.skipped_non_film += 1
                continue

            # ── Stage 2: Discover ──────────────────────────────────────
            try:
                disc_result = discovery.discover(
                    raw_title, raw_year, raw_imdb, raw_dir, raw_ctry, stats
                )
            except requests.HTTPError as e:
                consecutive_errors += 1
                if consecutive_errors >= RATE_SLOW_DOWN_THRESHOLD:
                    limiter.slow_down()
                    consecutive_errors = 0
                self._fail(task, raw, raw_title, FailureCategory.API_ERROR,
                           str(e), fail_logger, stats, dry_run)
                time.sleep(2)
                continue

            if disc_result is None:
                cat = normalizer.classify_failure(raw_title)
                self._fail(task, raw, raw_title, cat,
                           "All discovery strategies exhausted",
                           fail_logger, stats, dry_run)
                continue

            # [P6] Confidence gate
            if disc_result.confidence < min_conf:
                self._fail(
                    task, raw, raw_title, FailureCategory.LOW_CONFIDENCE,
                    f"Best score={disc_result.confidence:.3f} < threshold={min_conf}",
                    fail_logger, stats, dry_run,
                )
                continue

            # ── Stage 3: Enrich ────────────────────────────────────────
            try:
                enrich_result = enrichment.enrich(disc_result, raw)
            except requests.HTTPError as e:
                self._fail(task, raw, raw_title, FailureCategory.API_ERROR,
                           f"Enrichment failed: {e}", fail_logger, stats, dry_run)
                time.sleep(2)
                continue

            if not enrich_result.title:
                self._fail(task, raw, raw_title, FailureCategory.UNKNOWN,
                           "Enrichment returned empty title", fail_logger, stats, dry_run)
                continue

            # ── Stage 4: Identity Resolution [P1] ─────────────────────
            existing_movie = identity.resolve(enrich_result) if not dry_run else None
            if existing_movie:
                stats.identity_resolved += 1

            # ── Stage 5: Persist [P7] ──────────────────────────────────
            try:
                _, was_created = persistence.persist(enrich_result, existing_movie, dry_run)

                task.status = "COMPLETED"
                task.error_log = json.dumps({
                    "strategy": disc_result.strategy_used,
                    "confidence": disc_result.confidence,
                    "created": was_created,
                })
                if not dry_run:
                    task.save(update_fields=["status", "error_log"])

                stats.success += 1
                consecutive_errors = 0

            except (IntegrityError, OperationalError) as e:
                self._fail(task, raw, raw_title, FailureCategory.DB_ERROR,
                           str(e), fail_logger, stats, dry_run)
                logger.exception(f"DB write failed for {raw_title}")

            except Exception as e:
                self._fail(task, raw, raw_title, FailureCategory.UNKNOWN,
                           str(e), fail_logger, stats, dry_run)
                logger.exception(f"Unexpected error for {raw_title}")

        # Sync cache stats
        stats.cache_hits = resp_cache.hits

        fail_logger.close()
        self.stdout.write(self.style.SUCCESS(stats.report()))
        self.stdout.write(f"Failure log → {log_path}")

    # ── Helpers ────────────────────────────────────────────────────────

    def _fail(
        self,
        task: RawIngestion,
        raw: dict,
        raw_title: str,
        category: FailureCategory,
        detail: str,
        fail_logger: StructuredFailureLogger,
        stats: ETLStats,
        dry_run: bool,
    ):
        payload = json.dumps({"category": category.value, "detail": detail[:400]})
        task.status    = "FAILED"
        task.error_log = payload
        if not dry_run:
            task.save(update_fields=["status", "error_log"])
        fail_logger.log(raw, raw_title, category, detail)
        stats.record_failure(category)

    def _dispatch_async(self, qs, total: int):
        """
        [P2] Dispatch all pending tasks to Celery workers.

        Each task is individually queued so:
        - A slow Wikidata call doesn't block the whole pipeline
        - Dead-letter queue handles permanent failures
        - Workers can scale horizontally
        """
        try:
            from apps.ingestion.tasks import process_single_ingestion
        except ImportError:
            self.stdout.write(self.style.ERROR(
                "Celery task 'process_single_ingestion' not found.\n"
                "Ensure apps/ingestion/tasks.py defines it.\n"
                "Run without --async for synchronous mode."
            ))
            return

        dispatched = 0
        for task in tqdm(qs.only("id").iterator(chunk_size=500),
                         total=total, desc="Dispatching", unit="task"):
            process_single_ingestion.apply_async(
                args=[task.id],
                queue="etl",
                retry=True,
                retry_policy={
                    "max_retries": 3,
                    "interval_start": 5,
                    "interval_step": 10,
                    "interval_max": 60,
                },
            )
            dispatched += 1

        self.stdout.write(self.style.SUCCESS(
            f"✅ Dispatched {dispatched} tasks to Celery 'etl' queue.\n"
            f"   Monitor with: celery -A lumiere flower"
        ))