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

  // "Alguém abriu a ficha deste filme": põe-o na frente da fila do rastreador.
  //
  // Barato de propósito — só uma escrita no Redis — porque roda em TODA
  // abertura de ficha. O botão de atualizar é o caminho caro e limitado a
  // 10/hora; este é o automático.
  precarrega: (id: string) =>
    http.post<{ na_fila: boolean; ja_tem_copias: boolean; buscadas_em: string | null }>(
      `/api/movies/${id}/precarrega/`, {}),

  // Põe uma cópia para tocar direto do torrent. Exige a permissão ligada em
  // Configurações — o backend recusa com 403 antes de falar com o motor.
  tocarDoTorrent: (id: string, releaseId: string) =>
    http.post<{
      info_hash: string; arquivo: string | null; tamanho: number | null;
      pares: number; progresso: number; stream_url: string; release_id: string;
    }>(`/api/movies/${id}/tocar-do-torrent/`, { release: releaseId }),

  // Como vai o download direto. É daqui que sai o "poucos semeadores" da tela.
  estadoDoTorrent: (id: string, hash: string) =>
    http.get<{ pares: number; progresso: number; velocidade: number; baixado: number;
               cache: { bytes: number; cota: number | null; pausado_por_cota: boolean } | null }>(
      `/api/movies/${id}/estado-do-torrent/`, { params: { hash } }),

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