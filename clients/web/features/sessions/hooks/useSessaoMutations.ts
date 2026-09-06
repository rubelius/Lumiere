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
