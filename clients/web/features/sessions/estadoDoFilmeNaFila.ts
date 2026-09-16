/**
 * O que dizer da linha de um filme na fila da sessão.
 *
 * O DEFEITO: o rótulo era o `else` de um ternário de dois casos (`ready` e
 * `downloading`), então TODO outro valor caía em "AGUARDANDO" — inclusive
 * `failed`, que é exatamente o que `prepare_session` grava quando não achou
 * cópia nenhuma para aquele filme. A pessoa ficava esperando um download que
 * já tinha desistido.
 */

export interface RotuloDaFila {
  texto: string;
  /** 'espera' | 'andando' | 'pronto' | 'falhou' — decide cor e animação. */
  tom: 'espera' | 'andando' | 'pronto' | 'falhou';
}

export function rotuloDoFilmeNaFila(status: string, progresso: number): RotuloDaFila {
  switch (status) {
    case 'ready':
      return { texto: 'INTEGRIDADE VERIFICADA', tom: 'pronto' };
    case 'downloading':
      return { texto: `AQUISIÇÃO... ${progresso}%`, tom: 'andando' };
    case 'failed':
      // O caso que se escondia atrás de "AGUARDANDO". A frase tem que dizer
      // que a espera acabou, senão a pessoa segue esperando.
      return { texto: 'SEM CÓPIA — A BUSCA DESISTIU', tom: 'falhou' };
    case 'pending':
      return { texto: 'AGUARDANDO', tom: 'espera' };
    default:
      // Um status que esta tela não conhece não pode virar "aguardando": era
      // assim que `failed` se disfarçava. Melhor mostrar o que o servidor
      // disse do que traduzir errado.
      return { texto: String(status || 'AGUARDANDO').toUpperCase(), tom: 'espera' };
  }
}
