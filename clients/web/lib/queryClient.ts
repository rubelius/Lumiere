import { QueryClient } from '@tanstack/react-query';
import { APIError } from '@/services/http/errors';

// Função fábrica: garante que o Next.js crie um cache limpo por usuário no Servidor
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Dados ficam frescos por 30s. Reduz requisições desnecessárias.
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
        // Só tenta de novo se o erro NÃO for de autenticação (ex: erro de rede)
        retry: (failureCount, error) => {
          if (error instanceof APIError && error.isAuth()) return false;
          return failureCount < 2;
        },
        // Impede refetchs irritantes só por trocar de aba no navegador
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

// Variável para guardar o cache apenas do lado do Cliente (Navegador)
let browserQueryClient: QueryClient | undefined;

export function getQueryClient() {
  if (typeof window === 'undefined') {
    // Se estiver rodando no Servidor (Next.js SSR), sempre retorna um novo
    return makeQueryClient();
  } else {
    // Se estiver rodando no Navegador, cria uma vez e reaproveita
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
  }
}