import { describe, expect, it } from 'vitest';

import { etiquetasDeDisponibilidade, podeReproduzir } from './disponibilidade';

/**
 * Esta regra decidia disponibilidade olhando só `in_plex`, e o Plex é o degrau
 * adiado da cadeia. O acervo inteiro aparecia como OFFLINE, incluindo os
 * filmes que tocavam pelo Real-Debrid.
 */
describe('etiquetas de disponibilidade', () => {
  it('anuncia o filme que toca agora, com a qualidade que ele tem', () => {
    expect(
      etiquetasDeDisponibilidade({
        available_instantly: true,
        best_quality_available: 'REMUX 2160p DV',
      }),
    ).toEqual(['DISPONÍVEL', 'REMUX 2160p DV']);
  });

  it('anuncia sem qualidade quando o rótulo está vazio', () => {
    expect(
      etiquetasDeDisponibilidade({ available_instantly: true, best_quality_available: '  ' }),
    ).toEqual(['DISPONÍVEL']);
  });

  it('o Real-Debrid ganha do Plex, que é a ordem da cadeia de reprodução', () => {
    expect(
      etiquetasDeDisponibilidade({
        in_plex: true,
        available_instantly: true,
        best_quality_available: '1080p',
      }),
    ).toEqual(['DISPONÍVEL', '1080p']);
  });

  it('cai para PLEX quando é a única fonte', () => {
    expect(etiquetasDeDisponibilidade({ in_plex: true })).toEqual(['PLEX']);
  });

  it('só diz OFFLINE quando não há mesmo por onde tocar', () => {
    expect(etiquetasDeDisponibilidade({})).toEqual(['OFFLINE']);
  });

  it('nunca anuncia qualidade de filme que não se pode ver', () => {
    // Anunciar "REMUX 2160p" num filme indisponível é propaganda, não informação.
    expect(
      etiquetasDeDisponibilidade({ available_instantly: false, best_quality_available: 'REMUX 2160p' }),
    ).toEqual(['OFFLINE']);
  });
});

describe('podeReproduzir', () => {
  it.each([
    [{ available_instantly: true }, true],
    [{ in_plex: true }, true],
    [{}, false],
    [{ available_instantly: false, in_plex: false }, false],
  ])('%o -> %s', (filme, esperado) => {
    expect(podeReproduzir(filme)).toBe(esperado);
  });
});

describe('o estado do meio: cacheado mas não importado', () => {
  it('não some junto com os offline', () => {
    expect(etiquetasDeDisponibilidade({ cached_in_realdebrid: true })).toEqual(['UM CLIQUE']);
  });

  it('não promete reprodução, porque ainda não há link', () => {
    expect(podeReproduzir({ cached_in_realdebrid: true })).toBe(false);
  });

  it('cede a vez para quem já toca', () => {
    expect(
      etiquetasDeDisponibilidade({
        cached_in_realdebrid: true, available_instantly: true, best_quality_available: '2160p HDR',
      }),
    ).toEqual(['DISPONÍVEL', '2160p HDR']);
  });

  it('vem antes do Plex, que é o degrau mais lento da cadeia', () => {
    expect(etiquetasDeDisponibilidade({ cached_in_realdebrid: true, in_plex: true })).toEqual(['UM CLIQUE']);
  });
});
