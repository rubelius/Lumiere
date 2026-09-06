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

export interface ResultadoDaImportacao {
  message: string;
  torrent_id: string;
  realdebrid_status: string;
  disponibilidade: Disponibilidade;
}

/**
 * Manda a cópia para a conta do Real-Debrid.
 *
 * Para o que já está no acervo do RD isso leva segundos; para o resto, o
 * Real-Debrid passa a baixar e a cópia fica em `baixando` até terminar.
 */
export function useImportarRelease() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (releaseId: string) =>
      http.post<ResultadoDaImportacao>(`/api/releases/${releaseId}/add_to_realdebrid/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: movieKeys.all }),
  });
}

export type Disponibilidade = components['schemas']['DisponibilidadeEnum'];

interface Rotulo {
  texto: string;
  detalhe: string;
  cor: 'pronta' | 'espera' | 'ausente';
  podeImportar: boolean;
}

const ROTULOS: Record<Disponibilidade, Rotulo> = {
  pronta: {
    texto: 'TOCA AGORA',
    detalhe: 'Está na sua conta do Real-Debrid, com link pronto.',
    cor: 'pronta',
    podeImportar: false,
  },
  instantanea: {
    texto: 'IMPORTA NA HORA',
    detalhe: 'O Real-Debrid já tem este arquivo; importar leva segundos.',
    cor: 'espera',
    podeImportar: true,
  },
  baixando: {
    texto: 'BAIXANDO',
    detalhe: 'Já foi enviada. O Real-Debrid ainda está buscando.',
    cor: 'espera',
    podeImportar: false,
  },
  ausente: {
    texto: 'PRECISA BAIXAR',
    detalhe: 'Ninguém pediu esta cópia ainda; o Real-Debrid vai ter que buscá-la.',
    cor: 'ausente',
    podeImportar: true,
  },
};

/** As três leituras possíveis, em cor: já é seu, está a caminho, ou nem isso. */
export const CORES_DA_COPIA: Record<Rotulo['cor'], { texto: string; borda: string }> = {
  pronta: { texto: 'var(--gold)', borda: 'rgba(191,143,60,0.45)' },
  espera: { texto: 'var(--m2)', borda: 'rgba(134,131,125,0.45)' },
  ausente: { texto: 'var(--m3)', borda: 'rgba(86,84,80,0.4)' },
};

/**
 * Como anunciar o estado de uma cópia.
 *
 * A tabela dizia "toca agora" para tudo que tinha `instantly_available`, mas
 * essa flag só conta que o hash está no acervo do Real-Debrid — sem importar
 * para a conta, não existe link nenhum para reproduzir. São estados
 * diferentes, e prometer o primeiro no lugar do segundo é a diferença entre
 * apertar play e descobrir que não há nada do outro lado.
 */
// Partial e não Pick: uma resposta guardada em cache de antes destes campos
// existirem chega sem eles, e o tipo gerado os dá como sempre presentes.
export function rotuloDaCopia(
  r: Partial<Pick<Release, 'disponibilidade' | 'pode_importar'>>,
): Rotulo {
  const rotulo = ROTULOS[r.disponibilidade ?? 'ausente'] ?? ROTULOS.ausente;
  // O estado diz que faria sentido importar; o backend diz se há como. Cópia
  // vinda da sincronização com o Real-Debrid não tem magnet, e o botão só
  // saberia dar erro.
  if (r.pode_importar === false) return { ...rotulo, podeImportar: false };
  return rotulo;
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
export function motivoDaFalha(
  erro: unknown,
  padrao = 'Não foi possível procurar cópias agora.',
): string {
  const motivo = erro instanceof APIError ? erro.message : '';
  return (motivo || padrao).toUpperCase();
}
