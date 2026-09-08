'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { APIError } from '@/services/http/errors';
import { movieKeys } from '@/features/movies/hooks/useMovies';
import { http } from '@/services/http/client';
import type { components } from '@/types/api-generated';

export type Release = components['schemas']['TorrentRelease'];

export type EstadoBusca = 'ociosa' | 'enfileirada' | 'buscando' | 'concluida' | 'erro';

/**
 * O que está acontecendo com a busca de cópias de um filme.
 *
 * Todo documento traz TODAS as chaves, sempre, para a tela nunca precisar
 * checar se um campo existe. Os contadores nascem `null` de propósito: "ainda
 * não sei" não é zero, e `cache_check_failed` tem três respostas — null é
 * "ainda não perguntei", false é "perguntei e está tudo certo", true é "não
 * deu para perguntar".
 */
export interface EstadoDaBusca {
  movie_id: string;
  estado: EstadoBusca;
  iniciada_em: string | null;
  concluida_em: string | null;
  erro: string | null;
  new_releases_found: number | null;
  total_releases: number | null;
  cache_check_failed: boolean | null;
  consultas_falhas: string[];
}

/**
 * Chaves próprias, fora de `movieKeys`.
 *
 * `useImportarRelease` e outros invalidam `movieKeys.all`, e a consulta de
 * estado seria refetchada junto sem motivo nenhum.
 */
export const releaseKeys = {
  all: ['releases'] as const,
  busca: (id: string) => [...releaseKeys.all, 'busca', id] as const,
} as const;

const MS_ENTRE_PERGUNTAS = 2000;
const EM_ANDAMENTO: EstadoBusca[] = ['enfileirada', 'buscando'];

/**
 * Acompanha a busca de cópias deste filme.
 *
 * Monta junto com a ficha, e não só depois do clique: a busca pode ter sido
 * disparada em outra aba, ou antes de a página ser fechada e reaberta. Como o
 * estado mora no servidor, a retomada não custa uma linha de código.
 */
export function useEstadoDaBusca(movieId: string | undefined) {
  return useQuery({
    queryKey: releaseKeys.busca(movieId ?? ''),
    queryFn: () => http.get<EstadoDaBusca>(`/api/movies/${movieId}/search_status/`),
    enabled: Boolean(movieId),
    refetchInterval: (query) =>
      EM_ANDAMENTO.includes(query.state.data?.estado as EstadoBusca)
        ? MS_ENTRE_PERGUNTAS
        : false,
    // O padrão do projeto é `refetchOnWindowFocus: false` (lib/queryClient.ts).
    // Aqui a verdade mora no servidor e a aba pode ter ficado escondida durante
    // a busca inteira, então esta consulta pede o contrário, explicitamente.
    refetchOnWindowFocus: true,
  });
}

/**
 * Toca a campainha da busca. Quem trabalha é o worker.
 *
 * O endpoint prendia a requisição de 40 a 100 segundos, porque um dos
 * indexadores agrega os do Jackett. Agora responde na hora com o documento de
 * estado, que já é semeado no cache do React Query para o acompanhamento
 * começar sem esperar a primeira pergunta.
 */
export function useBuscarReleases(movieId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (opcoes: { min_seeders?: number; min_resolution?: string } = {}) =>
      http.post<EstadoDaBusca>(`/api/movies/${movieId}/search_torrents/`, opcoes),
    onSuccess: (doc) => {
      // Semear, e não invalidar a ficha: no instante do clique nada mudou
      // ainda. A ficha é invalidada pela CONCLUSÃO, na tela.
      if (movieId) queryClient.setQueryData(releaseKeys.busca(movieId), doc);
    },
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

// A partir daqui, "enfileirada" sem ninguém ter pegado vira notícia: é o
// sintoma de um worker fora do ar, e a tela consegue dizer isso com segurança.
const SEGUNDOS_ATE_DESCONFIAR = 15;

// Um dos indexadores agrega os do Jackett e leva até 100s. Depois deste tempo
// a espera deixa de ser surpresa e passa a merecer explicação.
const SEGUNDOS_ATE_EXPLICAR = 45;

/**
 * Um relógio que anda enquanto `ativo`, para o contador da busca avançar.
 *
 * O refetch de 2 em 2 segundos NÃO basta: o React Query não re-renderiza
 * quando o documento volta estruturalmente igual, e durante `buscando` ele
 * volta igual toda vez — `iniciada_em` e `estado` não mudam. Sem este tique o
 * botão dizia "VASCULHANDO... 2s" do começo ao fim, o que é o mesmo tipo de
 * mentira que o botão travado era.
 */
export function useRelogio(ativo: boolean): Date {
  const [agora, setAgora] = useState(() => new Date());

  useEffect(() => {
    if (!ativo) return;
    const id = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(id);
  }, [ativo]);

  return agora;
}

export interface PainelDaBusca {
  rotuloDoBotao: string;
  ocupado: boolean;
  aviso: string;
  erro: string;
}

function segundosDesde(iso: string | null, agora: Date): number {
  if (!iso) return 0;
  const inicio = new Date(iso).getTime();
  if (Number.isNaN(inicio)) return 0;
  return Math.max(0, Math.floor((agora.getTime() - inicio) / 1000));
}

/**
 * O que o cabeçalho da aba de cópias diz, em cada estado da busca.
 *
 * Pura de propósito, como `rotuloDaCopia` e `motivoDaFalha`: é aqui que mora a
 * diferença entre "os indexadores responderam e não havia nada" e "a busca
 * quebrou", que o antigo 200-contra-502 carregava e que não pode se perder.
 */
export function mensagemDaBusca(
  doc: EstadoDaBusca | undefined,
  agora: Date,
): PainelDaBusca {
  const painel: PainelDaBusca = {
    rotuloDoBotao: '[ PROCURAR CÓPIAS ]',
    ocupado: false,
    aviso: '',
    erro: '',
  };

  if (!doc || doc.estado === 'ociosa') return painel;

  // A ressalva vale em qualquer desfecho: parte das consultas pode ter caído
  // sem derrubar a busca, e aí o que está na tela não é tudo que existe.
  if (doc.consultas_falhas.length > 0) {
    painel.aviso = 'UMA DAS CONSULTAS AO PROWLARR FALHOU — O QUE ESTÁ ABAIXO PODE NÃO SER TUDO.';
  }

  if (doc.estado === 'enfileirada') {
    painel.rotuloDoBotao = '[ NA FILA... ]';
    painel.ocupado = true;
    if (segundosDesde(doc.iniciada_em, agora) >= SEGUNDOS_ATE_DESCONFIAR) {
      painel.aviso = 'A BUSCA FOI ACEITA MAS NINGUÉM A PEGOU — O WORKER PODE ESTAR FORA DO AR.';
    }
    return painel;
  }

  if (doc.estado === 'buscando') {
    const s = segundosDesde(doc.iniciada_em, agora);
    painel.rotuloDoBotao = `[ VASCULHANDO... ${s}s ]`;
    painel.ocupado = true;
    if (s >= SEGUNDOS_ATE_EXPLICAR) {
      painel.aviso = 'UM DOS INDEXADORES AGREGA OUTROS E COSTUMA LEVAR ATÉ 100s.';
    }
    return painel;
  }

  if (doc.estado === 'erro') {
    // A frase do servidor, inteira: é a mesma que o 502 carregava.
    painel.erro = (doc.erro || 'A BUSCA FALHOU.').toUpperCase();
    return painel;
  }

  // concluida
  const novas = doc.new_releases_found ?? 0;
  painel.aviso = painel.aviso || (novas > 0
    ? `${novas} CÓPIA${novas > 1 ? 'S' : ''} NOVA${novas > 1 ? 'S' : ''}.`
    : 'NENHUMA CÓPIA NOVA — OS INDEXADORES RESPONDERAM E NÃO HAVIA NADA ALÉM DO QUE JÁ ESTÁ AQUI.');
  return painel;
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
