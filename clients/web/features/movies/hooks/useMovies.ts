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
  subtitles: (id: string, idiomas: string) => [...movieKeys.all, 'subtitles', id, idiomas] as const,
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

/**
 * Legendas externas do OpenSubtitles. Lista vazia (e não erro) quando a chave
 * de API não está configurada — legenda é opcional, não pode virar falha.
 */
export function useSubtitles(id: string, idiomas = 'pt-BR,pt-PT,en') {
  return useQuery({
    queryKey: movieKeys.subtitles(id, idiomas),
    queryFn: () => moviesApi.subtitles(id, idiomas),
    enabled: !!id,
    staleTime: 5 * 60_000,
  });
}

/**
 * Filmes que combinam com o gosto do usuário e que ele ainda não viu.
 *
 * O perfil é retreinado a cada filme concluído, então esta lista muda sozinha
 * conforme a pessoa assiste. `has_profile` distingue as duas razões de a lista
 * vir vazia — ainda não há perfil, ou há perfil e nada novo combinou —, que
 * pedem mensagens diferentes na tela.
 */
export function useRecomendados() {
  return useQuery({
    queryKey: [...movieKeys.all, 'recomendados'] as const,
    queryFn: () =>
      http.get<{ count: number; has_profile: boolean; results: MovieListItem[] }>(
        '/api/movies/recommended/',
      ),
    staleTime: 60_000,
  });
}

/**
 * Filmes começados e ainda não terminados, do mais recente ao mais antigo.
 *
 * Vem do servidor, não do navegador. A home lia isso de `localStorage`, o que
 * significa que a posição se perdia ao trocar de máquina — justamente quando
 * retomar importa — e que, sem nada guardado, ela inventava um "15% assistido,
 * 1h55m restantes" para um filme que o usuário nunca tinha aberto.
 */
export function useContinuarAssistindo() {
  return useQuery({
    queryKey: [...movieKeys.all, 'continuar'] as const,
    queryFn: () =>
      http.get<{
        count: number;
        results: {
          movie: MovieListItem;
          progress_seconds: number;
          runtime_seconds: number;
          fraction: number;
          last_watched_at: string;
        }[];
      }>('/api/movies/continue-watching/'),
    staleTime: 30_000,
  });
}

/**
 * Números do acervo: quantos filmes, quantas horas, quantos países.
 *
 * A home exibia os três sob a legenda "métricas em tempo real". Dois eram
 * inventados: as horas saíam de multiplicar a contagem por 1.8, e os países
 * eram a constante 92 para qualquer acervo com ao menos um filme.
 */
export function useEstatisticasDoAcervo() {
  return useQuery({
    queryKey: [...movieKeys.all, 'estatisticas'] as const,
    queryFn: () =>
      http.get<{ movies: number; hours: number; countries: number }>(
        '/api/movies/archive-stats/',
      ),
    staleTime: 5 * 60_000,
  });
}
