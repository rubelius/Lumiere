'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { http } from '@/services/http/client';

import { sessionKeys, type CinemaSession } from './useSessoes';

export interface NovaSessao {
  name: string;
  description?: string;
  emoji?: string;
  /** ISO 8601. O backend guarda em UTC; o formulário monta a partir do fuso local. */
  scheduled_date: string;
  movie_ids?: string[];
}

/**
 * Cria uma sessão.
 *
 * O formulário existia na tela desde sempre — título, data, horário — mas com
 * os campos soltos, sem `value` nem `onChange`, e o botão de confirmar sem
 * `onClick`. Preenchê-lo e confirmar não fazia nada.
 */
export function useCriarSessao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dados: NovaSessao) =>
      http.post<CinemaSession>('/api/sessions/', {
        // O backend exige theme_type, e uma sessão montada à mão é 'custom' —
        // 'predefined' pediria um tema do catálogo que esta tela não escolhe.
        theme_type: 'custom',
        emoji: '🎬',
        ...dados,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionKeys.all }),
  });
}

/**
 * Gera um convite para a sessão.
 *
 * O botão "Copiar Link" copiava `window.location.href` — a URL da própria
 * página, que não dá acesso nenhum a quem a receba. O convite é outra coisa:
 * um código que autoriza uma conta a entrar, e que expira.
 */
export function useCriarConvite() {
  return useMutation({
    mutationFn: (sessionId: string) =>
      http.post<{ code: string; expires_at: string }>(
        `/api/sessions/${sessionId}/invite/`, {}),
  });
}

/** Entra numa sessão com o código recebido. */
export function useEntrarComCodigo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (code: string) =>
      http.post<CinemaSession>('/api/sessions/join/', { code: code.trim() }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionKeys.all }),
  });
}

/**
 * As três transições da sessão, na ordem em que acontecem.
 *
 * A máquina de estados vive no servidor e recusa salto: `prepare` só sai de
 * `planning`, `start` só de `ready`, `complete` só de `in_progress`. A tela
 * oferece uma ação por vez porque tentar a errada devolve 400 — e um botão
 * que só existe para dar erro não é uma opção, é uma armadilha.
 */
function acaoDaSessao(acao: 'prepare' | 'start' | 'complete') {
  return function useAcao() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: (sessionId: string) =>
        http.post<{ message: string; session: CinemaSession }>(
          `/api/sessions/${sessionId}/${acao}/`, {}),
      // `refetchQueries`, não `invalidateQueries`: a transição muda em qual
      // endpoint a sessão aparece — ao iniciar, ela sai de /upcoming/ e entra
      // em /current/. Com invalidação, /current/ não era rebuscado e a tela
      // dizia "nenhuma projeção agendada" no segundo seguinte a a pessoa ter
      // iniciado a projeção. Rebuscar é o que garante o estado consistente.
      //
      // A promessa é devolvida de propósito: a mutação só se dá por concluída
      // quando os dados novos chegaram, e o botão só volta do "iniciando...".
      onSuccess: () => queryClient.refetchQueries({ queryKey: sessionKeys.all }),
    });
  };
}

export const usePrepararSessao = acaoDaSessao('prepare');
export const useIniciarSessao = acaoDaSessao('start');
export const useEncerrarSessao = acaoDaSessao('complete');
