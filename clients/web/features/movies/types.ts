// src/features/movies/types.ts
//
// Os tipos derivam de types/api-generated.ts, gerado do schema OpenAPI do
// Django (`npm run gen:api`). Não escreva campos de filme à mão aqui: foi
// assim que surgiu um MovieListItem com 7 campos que a API nunca devolveu.
//
// A única coisa que refinamos são os JSONField do Django, que o
// drf-spectacular não consegue inferir e tipa como `unknown`.

import type { components } from '@/types/api-generated'

type GenMovieList = components['schemas']['MovieList']
type GenMovieDetail = components['schemas']['MovieDetail']

// ── Formas dos JSONField (invisíveis para o gerador) ──
export interface StreamingProvider {
  name: string;
  logo: string;
}

export interface CastMember {
  name: string;
  character: string;
  profile_url: string | null;
  order?: number;
  tmdb_person_id?: number;
}

export interface AlternativeTitle {
  title: string;
  country: string;
}

// ── 1. LISTA (Home e Library) ──
export type MovieListItem = Omit<GenMovieList, 'streaming_providers'> & {
  streaming_providers: StreamingProvider[] | null;
}

// ── 2. DETALHE (página individual) ──
export type MovieDetail = Omit<
  GenMovieDetail,
  'streaming_providers' | 'cast' | 'crew' | 'alternative_titles' | 'tspdt_history' | 'festivals'
> & {
  streaming_providers: StreamingProvider[] | null;
  cast: CastMember[];
  crew: unknown[];
  alternative_titles: AlternativeTitle[];
  /** Evolução do ranking TSPDT por ano — alimenta o TspdtHistoryChart. */
  tspdt_history: Record<string, number>;
  festivals: unknown;
}

export type SimilarMovie = components['schemas']['SimilarMovie']
export type TorrentRelease = components['schemas']['TorrentRelease']

// ── 3. PAGINAÇÃO DO DJANGO ──
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
