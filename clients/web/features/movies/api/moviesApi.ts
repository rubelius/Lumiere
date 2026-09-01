// src/features/movies/api/moviesApi.ts

import { http } from '@/services/http/client';
import type { MovieDetail, MovieListItem, PaginatedResponse, PlaybackSource, Subtitle } from '../types';

export const moviesApi = {
  // Busca a lista principal paginada
  list: () => http.get<PaginatedResponse<MovieListItem>>('/api/movies/'),
  
  // Busca a lista de mais bem avaliados (seu endpoint customizado do backend)
  topRated: () => http.get<MovieListItem[]>('/api/movies/top_rated/'),
  
  // Busca os detalhes de um único filme
  detail: (id: string) => http.get<MovieDetail>(`/api/movies/${id}/`),

  // Resolve a fonte de reprodução: Real-Debrid > Jellyfin > Plex.
  // 404 quando nenhuma tem o filme.
  playback: (id: string) => http.get<PlaybackSource>(`/api/movies/${id}/playback/`),

  // Legendas externas. Vazio quando a chave do OpenSubtitles não está posta.
  subtitles: (id: string, languages: string) =>
    http.get<Subtitle[]>(`/api/movies/${id}/subtitles/`, { params: { languages } }),
};