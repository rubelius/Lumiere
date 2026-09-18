import { describe, expect, it } from 'vitest';

import { idadeDaMedicao } from './usePainel';

// Um "0 workers" de dez minutos atrás e um de agora dizem coisas diferentes.
// Sem a idade ao lado, não dá para saber qual dos dois se está lendo — e é
// exatamente assim que uma tela de observabilidade passa a mentir.

describe('idadeDaMedicao', () => {
  const agora = new Date('2026-09-18T12:00:00Z');
  const atras = (s: number) => new Date(agora.getTime() - s * 1000).toISOString();

  it('medição recente é "agora"', () => {
    expect(idadeDaMedicao(atras(3), agora)).toBe('AGORA');
  });

  it('conta segundos, minutos e horas', () => {
    expect(idadeDaMedicao(atras(42), agora)).toBe('HÁ 42S');
    expect(idadeDaMedicao(atras(300), agora)).toBe('HÁ 5MIN');
    expect(idadeDaMedicao(atras(7200), agora)).toBe('HÁ 2H');
  });

  it('sem carimbo, não inventa idade', () => {
    // O silêncio é melhor que "há 56 anos" a partir de um campo vazio.
    expect(idadeDaMedicao(undefined, agora)).toBe('');
    expect(idadeDaMedicao('', agora)).toBe('');
    expect(idadeDaMedicao('não é data', agora)).toBe('');
  });

  it('relógio adiantado não produz idade negativa', () => {
    expect(idadeDaMedicao(new Date(agora.getTime() + 5000).toISOString(), agora))
      .toBe('AGORA');
  });
});
