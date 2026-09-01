// src/features/movies/hooks/useMovies.ts
'use client';

import { useQuery } from '@tanstack/react-query';
import { http } from '@/services/http/client';
import { moviesApi } from '../api/moviesApi';
import { PaginatedResponse, MovieListItem, MovieDetail } from '../types';
import { APIError } from '@/services/http/errors';

export const movieKeys = {
  all: ['movies'] as const,
  lists: () => [...movieKeys.all, 'list'] as const,
  details: () => [...movieKeys.all, 'detail'] as const,
  detail: (id: string) => [...movieKeys.details(), id] as const,
  topRated: () => [...movieKeys.all, 'topRated'] as const,
  playback: (id: string) => [...movieKeys.all, 'playback', id] as const,
} as const;

// 👇 1. CRIAMOS A INTERFACE BLINDADA
export interface UseMoviesParams {
  page?: number;
  search?: string;
  category?: string;
  qualities?: string[];
  genres?: string[];
  decades?: string[];
  curations?: string[];
}

export function useMovies(params: UseMoviesParams = { page: 1 }) {
  return useQuery({
    // 👇 2. CACHE INTELIGENTE: O React Query agora refaz a busca se QUALQUER filtro mudar
    queryKey: [
      'movies', 
      params.page, 
      params.search, 
      params.category, 
      params.qualities, 
      params.genres, 
      params.decades, 
      params.curations
    ],
    
    queryFn: (): Promise<PaginatedResponse<MovieListItem>> => {
      // Arrays viram lista separada por virgula: genres=Drama,Ação
      const csv = (v?: string[]) => (v?.length ? v.join(',') : undefined);

      return http.get<PaginatedResponse<MovieListItem>>('/api/movies/', {
        params: {
          page: params.page,
          // string vazia nao vira `search=` na URL
          search: params.search || undefined,
          // 'Acervo Completo' e o "todos" da UI — nao vai para o backend
          category: params.category !== 'Acervo Completo' ? params.category : undefined,
          qualities: csv(params.qualities),
          genres: csv(params.genres),
          decades: csv(params.decades),
          curations: csv(params.curations),
        },
      });
    },
    staleTime: 60000, 
  });
}

export function useTopRatedMovies() {
  return useQuery({
    queryKey: movieKeys.topRated(),
    queryFn: () => moviesApi.topRated(),
  });
}

export function useMovie(id: string) {
  return useQuery({
    queryKey: movieKeys.detail(id),
    queryFn: async (): Promise<MovieDetail> => {
      const res = await moviesApi.detail(id);
      return res;
    },
    enabled: !!id, 
  });
}
/**
 * Onde tocar o filme. O backend tenta Real-Debrid, depois Jellyfin, depois
 * Plex. Um 404 é resposta legítima — quer dizer que nenhuma fonte tem a obra —
 * então não vale repetir a requisição.
 */
export function usePlayback(id: string) {
  return useQuery({
    queryKey: movieKeys.playback(id),
    queryFn: () => moviesApi.playback(id),
    enabled: !!id,
    retry: (falhas, erro) => !(erro instanceof APIError) && falhas < 2,
    staleTime: 60_000,
  });
}
