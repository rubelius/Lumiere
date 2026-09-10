// src/features/movies/api/moviesApi.ts

import { http } from '@/services/http/client';
import type { ComoTocar, MovieDetail, MovieListItem, PaginatedResponse, PlaybackSource, Subtitle } from '../types';

export const moviesApi = {
  // Busca a lista principal paginada
  list: () => http.get<PaginatedResponse<MovieListItem>>('/api/movies/'),
  
  // Busca a lista de mais bem avaliados (seu endpoint customizado do backend)
  topRated: () => http.get<MovieListItem[]>('/api/movies/top_rated/'),
  
  // Busca os detalhes de um único filme
  detail: (id: string) => http.get<MovieDetail>(`/api/movies/${id}/`),

  // Resolve a fonte de reprodução: Real-Debrid > Jellyfin > Plex.
  // 404 quando nenhuma tem o filme.
  playback: (id: string, releaseId?: string) =>
    http.get<PlaybackSource>(`/api/movies/${id}/playback/`,
      releaseId ? { params: { release: releaseId } } : undefined),

  // O que o botão de projeção vai fazer com este filme.
  //
  // Endpoint próprio, e não campo do detalhe, porque a resposta depende do que
  // o Real-Debrid tem AGORA — e o detalhe é guardado por uma hora. Um "toca
  // agora" congelado é exatamente o defeito que este módulo veio corrigir.
  comoTocar: (id: string) => http.get<ComoTocar>(`/api/movies/${id}/como-tocar/`),

  // Legendas externas. Vazio quando a chave do OpenSubtitles não está posta.
  subtitles: (id: string, languages: string) =>
    http.get<Subtitle[]>(`/api/movies/${id}/subtitles/`, { params: { languages } }),
};