// src/features/movies/api/moviesApi.ts

import { http } from '@/services/http/client';
import type { MovieListItem, PaginatedResponse } from '@/types/api';

export const moviesApi = {
  // Busca a lista principal paginada
  list: () => http.get<PaginatedResponse<MovieListItem>>('/api/movies/'),
  
  // Busca a lista de mais bem avaliados (seu endpoint customizado do backend)
  topRated: () => http.get<MovieListItem[]>('/api/movies/top_rated/'),
  
  // Busca os detalhes de um único filme
  detail: (id: string) => http.get<any>(`/api/movies/${id}/`), // Depois tipamos o 'any' com o MovieDetail completo
};