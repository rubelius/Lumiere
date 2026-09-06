'use client';

import { useQuery } from '@tanstack/react-query';

import { http } from '@/services/http/client';
import type { components } from '@/types/api-generated';

export type CinemaSession = components['schemas']['CinemaSession'];
export type SessionMovie = components['schemas']['SessionMovie'];

export const sessionKeys = {
  all: ['sessions'] as const,
  upcoming: () => [...sessionKeys.all, 'upcoming'] as const,
  past: () => [...sessionKeys.all, 'past'] as const,
};

/**
 * Sessões agendadas, da mais próxima para a mais distante.
 *
 * A tela de sessão mostrava três filmes escritos no código — L'Avventura
 * pronto, Stalker em "AQUISIÇÃO... 68%", Persona aguardando — com barra
 * animada e velocidade sorteada a cada 1,2 s. Nenhuma chamada de rede em
 * lugar nenhum da página, e o mesmo download em curso para toda conta, em
 * toda visita, inclusive numa recém-criada.
 */
export function useProximasSessoes() {
  return useQuery({
    queryKey: sessionKeys.upcoming(),
    queryFn: () => http.get<CinemaSession[]>('/api/sessions/upcoming/'),
    // A preparação avança sozinha no servidor: busca de mídia, download,
    // playlist. Sem revalidar, o painel congela no estado da abertura.
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}

export function useSessoesPassadas() {
  return useQuery({
    queryKey: sessionKeys.past(),
    queryFn: () => http.get<CinemaSession[]>('/api/sessions/past/'),
    staleTime: 60_000,
  });
}

/**
 * Uma sessão com a fila de filmes dentro.
 *
 * `upcoming` é leve de propósito: o serializer só popula `session_movies`
 * quando o contexto marca `detail`, para a listagem não arrastar a fila de
 * cada sessão. Quem precisa da fila pede o detalhe.
 */
export function useSessao(id: string | undefined) {
  return useQuery({
    queryKey: [...sessionKeys.all, 'detalhe', id] as const,
    queryFn: () => http.get<CinemaSession>(`/api/sessions/${id}/`),
    enabled: Boolean(id),
    refetchInterval: 15_000,
  });
}
