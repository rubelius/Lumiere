// src/features/movies/hooks/useMovies.ts
'use client';

import { useQuery } from '@tanstack/react-query';
import { moviesApi } from '../api/moviesApi';
import { PaginatedResponse, MovieListItem, MovieDetail } from '../types';

export const movieKeys = {
  all: ['movies'] as const,
  lists: () => [...movieKeys.all, 'list'] as const,
  details: () => [...movieKeys.all, 'detail'] as const,
  detail: (id: string) => [...movieKeys.details(), id] as const,
  topRated: () => [...movieKeys.all, 'topRated'] as const,
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
    
    queryFn: async (): Promise<PaginatedResponse<MovieListItem>> => {
      const queryParams = new URLSearchParams();
      
      // Filtros básicos
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.search) queryParams.append('search', params.search);
      // Evita mandar "Acervo Completo" (que é o 'Todos') para o backend
      if (params.category && params.category !== "Acervo Completo") {
        queryParams.append('category', params.category);
      }

      // 👇 3. FILTROS AVANÇADOS: Junta os arrays com vírgula. 
      // Ex: se tiver ["Drama", "Ação"], vai virar "genres=Drama,Ação" na URL
      if (params.qualities?.length) queryParams.append('qualities', params.qualities.join(','));
      if (params.genres?.length) queryParams.append('genres', params.genres.join(','));
      if (params.decades?.length) queryParams.append('decades', params.decades.join(','));
      if (params.curations?.length) queryParams.append('curations', params.curations.join(','));

      const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/movies/?${queryParams.toString()}`;
      
      const res = await fetch(url, {
        credentials: 'include'
      });
      
      if (!res.ok) throw new Error('Falha ao buscar filmes');
      return res.json();
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