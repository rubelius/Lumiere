// src/types/api.ts

// Formato padrão de paginação do Django REST Framework
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// O formato exato que o seu MovieListSerializer cospe
export interface MovieListItem {
  id: string;
  title: string;
  original_title: string;
  year: number;
  director: string;
  country: string;
  length_minutes: number;
  genres: string[];
  primary_genre: string;
  poster_url: string | null;
  backdrop_url: string | null;
  current_ranking: number | null;
  tmdb_rating: number | null;
  imdb_rating: number | null;
  letterboxd_rating: number | null;
  average_user_rating: number | null;
  in_plex: boolean;
  available_instantly: boolean;
  current_quality_score: number;
}