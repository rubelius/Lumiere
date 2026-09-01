'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { http } from '@/services/http/client';
import type { components } from '@/types/api-generated';

/**
 * Credenciais das fontes de reprodução (Real-Debrid, Jellyfin, Plex).
 *
 * Os tokens são write-only no backend: a leitura devolve apenas `*_connected`,
 * nunca o valor. Por isso o formulário nunca vem preenchido com o segredo —
 * campo de token vazio significa "manter o que está gravado".
 */
export type IntegrationSettings = components['schemas']['IntegrationSettings'];

export const integrationKeys = {
  all: ['integrations'] as const,
};

export function useIntegrations() {
  return useQuery({
    queryKey: integrationKeys.all,
    queryFn: () => http.get<IntegrationSettings>('/api/users/integrations/'),
    staleTime: 30_000,
  });
}

export function useSaveIntegrations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dados: Partial<IntegrationSettings>) =>
      http.patch<IntegrationSettings>('/api/users/integrations/', dados),
    onSuccess: (dados) => {
      // A resposta do PATCH já é o estado novo; evita um GET redundante.
      queryClient.setQueryData(integrationKeys.all, dados);
    },
  });
}
