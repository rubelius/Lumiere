import { describe, expect, it } from 'vitest';

import {
  GRAVADO, NAO_CONFIGURADO, RESPONDEU, seloDaIntegracao, seloPorBooleano,
} from './estadoDaIntegracao';

// A linha do Jellyfin mostrava ✓ [CONECTADO] em dourado porque
// `jellyfin_connected` era `bool(url && token)` — "os campos têm texto" usado
// para responder "o servidor respondeu". URL errada, token vencido, servidor
// desligado: tudo aparecia conectado.

describe('seloDaIntegracao', () => {
  it('credencial gravada sem resposta NÃO é confirmação', () => {
    const selo = seloDaIntegracao(GRAVADO);
    expect(selo.confirmado).toBe(false);
    expect(selo.texto).not.toContain('CONECTADO');
  });

  it('e a frase diz o que falta, senão "gravado" se lê como falha', () => {
    expect(seloDaIntegracao(GRAVADO).texto).toContain('SEM RESPOSTA');
  });

  it('só uma resposta recente é confirmada', () => {
    const selo = seloDaIntegracao(RESPONDEU, '2026-09-15T09:12:00-03:00');
    expect(selo.confirmado).toBe(true);
    expect(selo.texto).toContain('RESPONDEU');
  });

  it('diz QUANDO respondeu — um selo sem hora não envelhece na frente de quem lê', () => {
    expect(seloDaIntegracao(RESPONDEU, '2026-09-15T09:12:00-03:00').texto)
      .toMatch(/\d\d:\d\d/);
  });

  it('respondeu sem carimbo legível não inventa uma hora', () => {
    expect(seloDaIntegracao(RESPONDEU, 'não é uma data').texto).toBe('RESPONDEU');
    expect(seloDaIntegracao(RESPONDEU, null).texto).toBe('RESPONDEU');
  });

  it('sem estado nenhum, não configurado', () => {
    expect(seloDaIntegracao(NAO_CONFIGURADO).confirmado).toBe(false);
    expect(seloDaIntegracao(undefined).texto).toBe('NÃO CONFIGURADO');
    expect(seloDaIntegracao(null).texto).toBe('NÃO CONFIGURADO');
  });

  it('um estado desconhecido nunca vira confirmação', () => {
    // Backend mais novo que a tela: o desconhecido não pode virar dourado.
    expect(seloDaIntegracao('estado_que_ainda_nao_existe').confirmado).toBe(false);
  });
});

describe('seloPorBooleano', () => {
  it('serviços de nuvem continuam com dois estados', () => {
    // Real-Debrid e OpenSubtitles são exercitados a cada busca; não há
    // "servidor de casa desligado" a distinguir.
    expect(seloPorBooleano(true)).toEqual({ texto: 'CONECTADO', confirmado: true });
    expect(seloPorBooleano(false).confirmado).toBe(false);
  });
});
