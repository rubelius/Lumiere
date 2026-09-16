'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { http } from '@/services/http/client';

/**
 * As preferências de notificação, que existiam no servidor e não na tela.
 *
 * O DEFEITO: os dois interruptores da aba Notificações — "Integridade do
 * Download" e "Falhas de Comunicação" — eram `useState` local iniciado em
 * `true`, nunca enviado nem lido. Anunciavam estar LIGADOS sobre preferências
 * que ninguém consultava.
 *
 * E o backend já tinha tudo: o modelo `NotificationPreference` com dez campos,
 * `GET /api/notifications/preferences/` e
 * `PATCH /api/notifications/update_preferences/`. Faltava a tela conversar com
 * eles — o que torna a remoção do bloco a saída errada aqui, diferente do
 * Trakt, que não existia em lugar nenhum.
 */
export interface PreferenciasDeNotificacao {
  enable_in_app: boolean;
  enable_email: boolean;
  email_session_reminders: boolean;
  email_downloads: boolean;
  email_recommendations: boolean;
  email_weekly_digest: boolean;
  enable_push: boolean;
  push_session_reminders: boolean;
  push_downloads: boolean;
  digest_frequency: string;
}

export const notificacaoKeys = {
  all: ['notificacoes', 'preferencias'] as const,
};

export function useNotificacoes() {
  return useQuery({
    queryKey: notificacaoKeys.all,
    queryFn: () => http.get<PreferenciasDeNotificacao>('/api/notifications/preferences/'),
    staleTime: 30_000,
  });
}

export function useSalvarNotificacoes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dados: Partial<PreferenciasDeNotificacao>) =>
      http.patch<PreferenciasDeNotificacao>(
        '/api/notifications/update_preferences/', dados),
    // A resposta do PATCH é o estado novo inteiro: gravá-la evita o piscar de
    // um refetch e, principalmente, evita a tela mostrar o que ela PEDIU em
    // vez do que o servidor gravou.
    onSuccess: (novo) => queryClient.setQueryData(notificacaoKeys.all, novo),
  });
}
