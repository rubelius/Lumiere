import { describe, expect, it } from 'vitest';

import { fracaoDoProgresso, silencioDoProgresso, temTrabalhoEmVoo } from './useVivo';

import type { Progresso, Vivo } from './useVivo';

const vazio: Vivo = {
  progressos: [], ativas: [], filas: [], buscas: [], execucoes: [],
  medido_em: '',
};

const progresso = (campos: Partial<Progresso>): Progresso => ({
  tarefa: 't', total: 8, feitos: 0, achados: 0, erros: 0, agora_em: '',
  detalhe: '', comecou_em: 0, atualizado_em: 0, terminou: false, ...campos,
});

// A consulta acelera quando há trabalho. Errar para um lado é tráfego à toa;
// para o outro, é a barra andando aos saltos — o oposto de dar visibilidade.

describe('temTrabalhoEmVoo', () => {
  it('parado é parado', () => {
    expect(temTrabalhoEmVoo(vazio)).toBe(false);
    expect(temTrabalhoEmVoo(undefined)).toBe(false);
  });

  it('tarefa ativa conta', () => {
    expect(temTrabalhoEmVoo({ ...vazio, ativas: [{ tarefa: 't', task_id: '1', worker: 'w', desde_s: 1 }] }))
      .toBe(true);
  });

  it('fila com item conta, mesmo sem worker', () => {
    // É justamente o caso que mais importa: fila cheia e ninguém consumindo.
    expect(temTrabalhoEmVoo({ ...vazio, filas: [{ nome: 'celery', esperando: 3 }] }))
      .toBe(true);
  });

  it('progresso terminado NÃO conta', () => {
    // Ele fica na tela mais dois minutos para quem estava olhando ver o
    // resultado — mas não é motivo para seguir perguntando de 3 em 3s.
    expect(temTrabalhoEmVoo({ ...vazio, progressos: [progresso({ terminou: true })] }))
      .toBe(false);
  });

  it('progresso em curso conta', () => {
    expect(temTrabalhoEmVoo({ ...vazio, progressos: [progresso({ feitos: 2 })] }))
      .toBe(true);
  });
});

describe('fracaoDoProgresso', () => {
  it('conta o que foi feito', () => {
    expect(fracaoDoProgresso(progresso({ feitos: 2, total: 8 }))).toBe(25);
  });

  it('não passa de 100 quando a tarefa reprocessa', () => {
    // Uma barra de 140% é pior que nenhuma barra.
    expect(fracaoDoProgresso(progresso({ feitos: 11, total: 8 }))).toBe(100);
  });

  it('total zero não vira divisão por zero', () => {
    expect(fracaoDoProgresso(progresso({ feitos: 0, total: 0 }))).toBe(0);
  });
});

describe('silencioDoProgresso', () => {
  it('diz há quanto tempo não há notícia', () => {
    expect(silencioDoProgresso(progresso({ atualizado_em: 1000 }), 1090)).toBe(90);
  });

  it('relógio adiantado não vira silêncio negativo', () => {
    expect(silencioDoProgresso(progresso({ atualizado_em: 1100 }), 1000)).toBe(0);
  });
});
