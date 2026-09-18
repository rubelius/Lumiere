'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { http } from '@/services/http/client';

/**
 * O painel de administração.
 *
 * Cada painel carrega três coisas além do valor — `origem`, `medido_em` e
 * `ressalva` — e a tela mostra as três. Não é rodapé decorativo: uma tela de
 * observabilidade é o lugar mais fácil do mundo para mostrar um número que
 * parece uma coisa e é outra, e este projeto já pagou por isso.
 */
export interface ValorDoPainel {
  rotulo: string;
  valor: string | number;
  detalhe: string;
}

export interface Painel {
  chave: string;
  titulo: string;
  valores: ValorDoPainel[];
  origem: string;
  ressalva: string;
  medido_em: string;
}

export interface PontoDeLinha { dia: string; media: number; pior: number; melhor: number; n: number }
export interface SerieDeLinhas { nome: string; pontos: PontoDeLinha[] }
export interface Barra { nome: string; total: number; falhas: number; rodando: number }

export interface Grafico {
  chave: string;
  titulo: string;
  /** 'sem-dado' é uma resposta legítima: duas medições não são uma tendência. */
  tipo: 'linhas' | 'barras' | 'sem-dado';
  dados: SerieDeLinhas[] | Barra[];
  origem: string;
  ressalva: string;
}

export interface Acao {
  chave: string;
  titulo: string;
  descricao: string;
}

export interface RespostaDoPainel {
  paineis: Painel[];
  falharam: string[];
  graficos: Grafico[];
  acoes: Acao[];
}

export const painelKeys = { all: ['painel', 'admin'] as const };

export function usePainel() {
  return useQuery({
    queryKey: painelKeys.all,
    queryFn: () => http.get<RespostaDoPainel>('/api/painel/'),
    // O backend guarda por 60s; pedir mais que isso só rende a mesma resposta.
    staleTime: 60_000,
    // Uma tela de observabilidade que não se atualiza sozinha obriga a pessoa a
    // recarregar para saber se algo mudou — e o que ela observa muda.
    refetchInterval: 60_000,
    retry: false,
  });
}

/**
 * Há quanto tempo o número foi medido, em palavras.
 *
 * A tela precisa disto ao lado de cada painel: um "0 workers" de dez minutos
 * atrás e um de agora dizem coisas diferentes, e sem a idade não dá para saber
 * qual dos dois se está lendo.
 */
export function idadeDaMedicao(medidoEm: string | undefined, agora = new Date()): string {
  if (!medidoEm) return '';
  const quando = new Date(medidoEm);
  if (Number.isNaN(quando.getTime())) return '';
  const segundos = Math.max(0, Math.round((agora.getTime() - quando.getTime()) / 1000));
  if (segundos < 10) return 'AGORA';
  if (segundos < 60) return `HÁ ${segundos}S`;
  const minutos = Math.round(segundos / 60);
  if (minutos < 60) return `HÁ ${minutos}MIN`;
  return `HÁ ${Math.round(minutos / 60)}H`;
}


/**
 * Disparar uma ação do painel.
 *
 * Ao terminar, invalida o painel: o ponto de apertar o botão é ver o número
 * mudar, e esperar o refetch de 60 segundos faria a tela parecer inerte.
 */
export function useDisparaAcao() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (acao: string) =>
      http.post<{ chave: string; titulo: string; task_id: string }>(
        '/api/painel/acao/', { acao }),
    onSuccess: () => {
      // Um respiro antes de reler: a tarefa acabou de entrar na fila e o
      // registro de execução leva um instante para aparecer.
      setTimeout(() => queryClient.invalidateQueries({ queryKey: painelKeys.all }), 1500);
    },
  });
}
