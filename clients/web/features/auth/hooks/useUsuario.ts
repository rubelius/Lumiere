'use client';

import { useQuery } from '@tanstack/react-query';

import { http } from '@/services/http/client';
import type { components } from '@/types/api-generated';

export type Usuario = components['schemas']['User'];

/**
 * A conta de quem está usando.
 *
 * Existe porque nada no cliente sabia quem é admin: o `authStore` guarda o
 * username e mais nada, e o serializer só passou a expor `is_staff` agora. Sem
 * isto a tela não pode nem esconder o que o backend vai recusar, nem oferecer
 * o que ele vai permitir.
 */
export const usuarioKeys = { eu: ['usuario', 'eu'] as const };

export function useUsuario() {
  return useQuery({
    queryKey: usuarioKeys.eu,
    queryFn: () => http.get<Usuario>('/api/users/me/'),
    staleTime: 300_000,
    retry: false,
  });
}

/** Se esta conta pode ver o painel. Espelha o `IsAdminUser` do backend. */
export function ehEquipe(usuario: Usuario | undefined): boolean {
  return Boolean(usuario?.is_staff || usuario?.is_superuser);
}
