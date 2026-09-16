import { describe, expect, it } from 'vitest';

import { rotuloDoFilmeNaFila } from './estadoDoFilmeNaFila';

// O rótulo era o `else` de um ternário de dois casos, então TODO outro status
// caía em "AGUARDANDO" — inclusive `failed`, que é o que `prepare_session`
// grava quando não achou cópia nenhuma. A pessoa ficava esperando um download
// que já tinha desistido.

describe('rotuloDoFilmeNaFila', () => {
  it('a falha deixa de se disfarçar de espera', () => {
    const r = rotuloDoFilmeNaFila('failed', 0);
    expect(r.texto).not.toBe('AGUARDANDO');
    expect(r.texto).toContain('DESISTIU');
    expect(r.tom).toBe('falhou');
  });

  it('os dois casos que já funcionavam continuam', () => {
    expect(rotuloDoFilmeNaFila('ready', 100).texto).toBe('INTEGRIDADE VERIFICADA');
    expect(rotuloDoFilmeNaFila('downloading', 42).texto).toBe('AQUISIÇÃO... 42%');
  });

  it('esperar de verdade continua sendo esperar', () => {
    expect(rotuloDoFilmeNaFila('pending', 0).texto).toBe('AGUARDANDO');
  });

  it('um status desconhecido não vira "aguardando"', () => {
    // Era assim que `failed` se disfarçava; traduzir errado é pior que mostrar
    // o que o servidor disse.
    expect(rotuloDoFilmeNaFila('cancelado_pelo_usuario', 0).texto)
      .toBe('CANCELADO_PELO_USUARIO');
  });
});
