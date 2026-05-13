// src/features/movies/types.ts

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

// ── 1. TIPAGEM DA LISTA (Home e Library) ──
// Esse é o reflexo exato do nosso MovieListSerializer do Django
export interface MovieListItem {
  id: string;
  title: string;
  original_title: string;
  overview: string;
  year: number | null;
  director: string;
  poster_url: string;
  ranking_current: number | null;
  tmdb_rating: string | number | null;
  length_minutes: number | null;
  background_url: string;
  country: string;
  tagline: string;
  in_plex: boolean;
  genres: string[];
  trailer_url: string;
  
  // Nossos novos campos Premium!
  logo_url: string | null;
  cinematographer: string | null;
  composer: string | null;
  writer: string | null;
  streaming_providers: StreamingProvider[] | null;
  mpaa_rating: string;
  color: string;
  collection_name: string | null;
}

// ── 2. TIPAGEM DO FILME COMPLETO (Página de Detalhes) ──
// Herda a lista e adiciona os campos pesados do MovieDetailSerializer
export interface MovieDetail extends MovieListItem {
  cast: CastMember[];
  crew: any[]; 
  alternative_titles: AlternativeTitle[];
  tspdt_history: Record<string, number>;
  budget: number | null;
  revenue: number | null;
  current_ranking: number | null;
  best_releases: any[]; // Tiparemos isso melhor quando focarmos no Prowlarr
  similar_movies: Array<{
    movie: MovieListItem;
    similarity: number;
    type: string;
  }>;
}

// ── 3. TIPAGEM DA PAGINAÇÃO DO DJANGO ──
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}