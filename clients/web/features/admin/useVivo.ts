'use client';

import { useQuery } from '@tanstack/react-query';

import { http } from '@/services/http/client';

/**
 * O que está acontecendo agora.
 *
 * Separado do painel de propósito: o painel é retrato e fica guardado 60
 * segundos; isto é o que a pessoa olha ENQUANTO espera, e um número de um
 * minuto atrás aqui é inútil.
 */
export interface Progresso {
  tarefa: string;
  total: number;
  feitos: number;
  achados: number;
  erros: number;
  agora_em: string;
  detalhe: string;
  comecou_em: number;
  atualizado_em: number;
  terminou: boolean;
  resumo?: string;
}

export interface Ativa { tarefa: string; task_id: string; worker: string; desde_s: number }
export interface Fila { nome: string; esperando: number }
export interface BuscaEmCurso { filme: string; estado: string; desde: string }
export interface Execucao {
  tarefa: string; task_id: string; quando: string;
  duracao_s: number | null;
  /** Nulo é "ainda rodando", e é diferente de falso. */
  sucesso: boolean | null;
  origem: string; por: string; erro: string;
}

export interface Vivo {
  progressos: Progresso[];
  ativas: Ativa[];
  filas: Fila[];
  buscas: BuscaEmCurso[];
  execucoes: Execucao[];
  medido_em: string;
}

export const vivoKeys = { all: ['painel', 'vivo'] as const };

/**
 * O ritmo sai do PRÓPRIO dado, e não de um parâmetro.
 *
 * Perguntar de 3 em 3 segundos o tempo todo é tráfego à toa — o painel fica
 * aberto e ocioso a maior parte do tempo. Perguntar de 15 em 15 durante uma
 * rodada faz a barra andar aos saltos, que é o oposto de dar visibilidade.
 *
 * A primeira versão recebia `temTrabalho` como argumento e o chamador não
 * tinha como saber a resposta antes da primeira consulta — o parâmetro chegava
 * sempre `undefined` e a tela ficava eternamente no ritmo lento. O
 * `refetchInterval` do React Query aceita uma função da última resposta, que é
 * exatamente a informação que faltava.
 */
export function useVivo() {
  return useQuery({
    queryKey: vivoKeys.all,
    queryFn: () => http.get<Vivo>('/api/painel/vivo/'),
    refetchInterval: (consulta) =>
      (temTrabalhoEmVoo(consulta.state.data) ? 3000 : 15000),
    staleTime: 0,
    retry: false,
  });
}

/** Se há trabalho em voo — o que decide o ritmo da consulta acima. */
export function temTrabalhoEmVoo(vivo: Vivo | undefined): boolean {
  if (!vivo) return false;
  return (
    vivo.ativas.length > 0
    || vivo.progressos.some((p) => !p.terminou)
    || vivo.filas.some((f) => f.esperando > 0)
    || vivo.buscas.length > 0
  );
}

/** Quanto de um progresso já foi feito, em porcentagem. */
export function fracaoDoProgresso(p: Progresso): number {
  if (!p.total) return 0;
  // Limitado a 100: `feitos` pode passar de `total` se a tarefa reprocessar, e
  // uma barra de 140% é pior que nenhuma barra.
  return Math.min(100, Math.round((p.feitos / p.total) * 100));
}

/** Há quanto tempo o progresso não recebe notícia — em segundos. */
export function silencioDoProgresso(p: Progresso, agora = Date.now() / 1000): number {
  return Math.max(0, Math.round(agora - (p.atualizado_em || 0)));
}
