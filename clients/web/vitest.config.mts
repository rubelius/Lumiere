import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Configuração dos testes do cliente.
 *
 * `resolve.tsconfigPaths` faz o alias `@/` do tsconfig valer também aqui; sem
 * ele todo import do projeto quebraria só dentro dos testes. É o substituto
 * nativo do plugin vite-tsconfig-paths, que esta versão do Vite dispensa.
 *
 * Server Component assíncrono fica de fora de propósito — o Vitest não os
 * suporta, e o próprio guia do Next recomenda cobri-los por E2E.
 */
export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules/**', '.next/**'],
  },
});
