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
export function useMovies(params: { page?: number; search?: string; category?: string } = { page: 1 }) {
  return useQuery({
    // A MÁGICA: Adicionamos o params.category aqui para o React Query separar os caches de cada aba!
    queryKey: ['movies', params.page, params.search, params.category],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.search) queryParams.append('search', params.search);
      
      // Se no futuro implementarmos o filtro de categoria no Django, o frontend já está pronto:
      // if (params.category && params.category !== 'O Acervo') {
      //   queryParams.append('category', params.category);
      // }

      const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/movies/?${queryParams.toString()}`;
      
      // A CHAVE DE ACESSO: credentials: 'include' envia o cookie JWT para o Django!
      const res = await fetch(url, {
        credentials: 'include'
      });
      
      if (!res.ok) throw new Error('Falha ao buscar filmes');
      return res.json(); // Retorna o { count, next, previous, results } do Django
    },
    staleTime: 60000, // Mantém os filmes na memória RAM por 1 minuto
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