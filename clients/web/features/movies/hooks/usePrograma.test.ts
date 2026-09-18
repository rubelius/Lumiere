import { describe, expect, it } from 'vitest';

import { dataDoPrograma } from './usePrograma';

// A home é estável o dia inteiro de propósito. Sem a data escrita na tela,
// isso se lê como defeito — foi o relato que originou este trabalho.

describe('dataDoPrograma', () => {
  it('escreve o dia por extenso', () => {
    expect(dataDoPrograma('2026-09-18')).toBe('PROGRAMA DE 18 DE SETEMBRO');
  });

  it('não desloca o dia por fuso', () => {
    // `new Date('2026-01-01')` é meia-noite UTC; a oeste de Greenwich isso é
    // 31 de dezembro, e a tela mostraria o dia anterior a tarde inteira.
    expect(dataDoPrograma('2026-01-01')).toBe('PROGRAMA DE 01 DE JANEIRO');
    expect(dataDoPrograma('2026-12-31')).toBe('PROGRAMA DE 31 DE DEZEMBRO');
  });

  it('sem data, não inventa uma', () => {
    expect(dataDoPrograma(undefined)).toBe('');
    expect(dataDoPrograma('')).toBe('');
    expect(dataDoPrograma('não é data')).toBe('');
  });
});
