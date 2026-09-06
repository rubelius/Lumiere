'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { APIError } from '@/services/http/errors';
import { movieKeys } from '@/features/movies/hooks/useMovies';
import { http } from '@/services/http/client';
import type { components } from '@/types/api-generated';

export type Release = components['schemas']['TorrentRelease'];

export interface ResultadoDaBusca {
  movie_id: string;
  releases: Release[];
  new_releases_found: number;
  total_releases: number;
  /** A consulta de cache falhou: a coluna "toca agora" está sem resposta. */
  cache_check_failed: boolean;
}

/**
 * Procura cópias do filme nos indexadores, via Prowlarr.
 *
 * Nada no cliente chamava este endpoint — a busca de releases existia só no
 * backend, e lá nunca tinha funcionado.
 */
export function useBuscarReleases(movieId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (opcoes: { min_seeders?: number; min_resolution?: string } = {}) =>
      http.post<ResultadoDaBusca>(`/api/movies/${movieId}/search_torrents/`, opcoes),
    // A ficha do filme carrega best_releases; depois de buscar ela mudou.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: movieKeys.all }),
  });
}

/**
 * Rótulo técnico de uma cópia, montado dos campos que a API devolve.
 *
 * A tabela lia `release.res`, `release.type`, `release.audio` e
 * `release.group` — nenhum deles existe na resposta. Toda linha mostrava
 * "N/A", e um `any` no map impedia o TypeScript de acusar.
 */
export function especificacaoDaCopia(r: Release): string[] {
  const partes: string[] = [];
  if (r.is_remux) partes.push('REMUX');
  if (r.resolution) partes.push(r.resolution);
  if (r.has_dolby_vision) partes.push('DV');
  else if (r.has_hdr) partes.push('HDR');
  if (r.video_codec) partes.push(r.video_codec);
  if (r.has_atmos) partes.push('ATMOS');
  else if (r.has_dtsx) partes.push('DTS-X');
  else if (r.audio_codec) partes.push(r.audio_codec);
  return partes;
}

/** "75.2 GB" a partir do tamanho em bytes; o serializer já expõe size_gb. */
export function tamanhoLegivel(r: Release): string {
  const gb = r.size_gb ?? (r.size_bytes ? r.size_bytes / 1024 ** 3 : 0);
  if (!gb) return '—';
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(gb * 1024).toFixed(0)} MB`;
}

/**
 * O que dizer quando a busca falha.
 *
 * O backend distingue os motivos — "o Prowlarr não está configurado" (400),
 * "o Prowlarr devolveu algo que não é JSON" (502) — e repetir o motivo é o que
 * separa um problema acionável de um encolher de ombros. Antes, qualquer falha
 * virava silêncio e a tela parecia dizer que não havia cópia nenhuma.
 */
export function motivoDaFalha(erro: unknown): string {
  const motivo = erro instanceof APIError ? erro.message : '';
  return (motivo || 'Não foi possível procurar cópias agora.').toUpperCase();
}
