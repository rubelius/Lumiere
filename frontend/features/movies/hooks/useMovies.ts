// src/features/movies/hooks/useMovies.ts
'use client';

import { useQuery } from '@tanstack/react-query';
import { moviesApi } from '../api/moviesApi';

// Fábrica de chaves de cache: mantém o cache super organizado para limparmos quando necessário
export const movieKeys = {
  all: ['movies'] as const,
  lists: () => [...movieKeys.all, 'list'] as const,
  details: () => [...movieKeys.all, 'detail'] as const,
  detail: (id: string) => [...movieKeys.details(), id] as const,
  topRated: () => [...movieKeys.all, 'topRated'] as const,
} as const;

// Hook para a página de Arquivo/Library
export function useMovies() {
  return useQuery({
    queryKey: movieKeys.lists(),
    queryFn: () => moviesApi.list(),
  });
}

// Hook para destaques ou Hero Section
export function useTopRatedMovies() {
  return useQuery({
    queryKey: movieKeys.topRated(),
    queryFn: () => moviesApi.topRated(),
  });
}

export function useMovie(id: string) {
  return useQuery({
    queryKey: movieKeys.detail(id),
    queryFn: () => moviesApi.detail(id),
    enabled: !!id, // Só faz a busca se o ID existir na URL
  });
}