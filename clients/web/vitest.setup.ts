import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Sem isto o DOM de um teste sobrevive para o seguinte, e uma asserção passa
// por causa do que a anterior deixou na tela.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// jsdom não implementa nenhum dos dois, e o Framer Motion e os cards que usam
// `whileInView` chamam ambos ao montar.
class ObservadorFalso {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

Object.defineProperty(globalThis, 'IntersectionObserver', {
  writable: true,
  value: ObservadorFalso,
});
Object.defineProperty(globalThis, 'ResizeObserver', {
  writable: true,
  value: ObservadorFalso,
});

Object.defineProperty(globalThis, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  }),
});
