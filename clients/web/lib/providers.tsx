'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { getQueryClient } from './queryClient';
import { type ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  // Chamamos a função que você criou no Passo 3. 
  // Ela garante que o Servidor crie um cache limpo e o Cliente reaproveite o dele.
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* DevTools só aparece em desenvolvimento. Uma florzinha no canto inferior esquerdo para debugar o cache. */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      )}
    </QueryClientProvider>
  );
}