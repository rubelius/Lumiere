'use client';

import { useQuery } from '@tanstack/react-query';

import { http } from '@/services/http/client';
import type { components } from '@/types/api-generated';

type Filme = components['schemas']['MovieList'];

/**
 * O programa do dia: as seções que a home mostra.
 *
 * Substitui o arranjo que fazia a home inteira viver de UMA requisição — a
 * primeira página de `/api/movies/`, 20 filmes ordenados por `ranking_current`,
 * dos quais o hero sorteava 10. Eram 0,077% das 25.908 obras, e por isso
 * pareciam sempre os mesmos: eram sempre os mesmos.
 *
 * O programa é DETERMINÍSTICO POR DATA — estável do primeiro ao último acesso
 * do dia, outro amanhã. A tela mostra a data, e é ela que explica a
 * estabilidade: sem isso, uma home que não muda entre dois F5 parece quebrada.
 */
export interface SecaoDoPrograma {
  chave: string;
  titulo: string;
  subtitulo: string;
  filmes: Filme[];
}

export interface Programa {
  dia: string;
  secoes: SecaoDoPrograma[];
}

export const programaKeys = {
  all: ['programa'] as const,
};

export function usePrograma() {
  return useQuery({
    queryKey: programaKeys.all,
    queryFn: () => http.get<Programa>('/api/movies/programa/'),
    // Uma hora: o programa é o mesmo o dia inteiro, e o backend também o
    // guarda. Refetch antes disso é trabalho para receber a mesma resposta.
    staleTime: 3600_000,
  });
}

/**
 * A data do programa, como uma cinemateca escreveria na parede.
 *
 * Existe porque a home PRECISA dizer o dia. Uma tela que não muda entre dois
 * acessos e não explica por quê se lê como defeito — foi exatamente o relato
 * que originou este trabalho.
 */
export function dataDoPrograma(dia: string | undefined): string {
  if (!dia) return '';
  // `dia` vem como 'AAAA-MM-DD'. Montar com `new Date(dia)` interpretaria como
  // UTC e, a oeste de Greenwich, mostraria o dia anterior a tarde inteira.
  const [ano, mes, d] = dia.split('-').map(Number);
  if (!ano || !mes || !d) return '';
  const MESES = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
    'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
  return `PROGRAMA DE ${String(d).padStart(2, '0')} DE ${MESES[mes - 1]}`;
}
