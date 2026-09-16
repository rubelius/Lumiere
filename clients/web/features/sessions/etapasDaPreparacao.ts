import type { components } from '@/types/api-generated';

type CinemaSession = components['schemas']['CinemaSession'];

/**
 * As quatro etapas da preparação, lidas do estado real da sessão.
 *
 * O DEFEITO: 'active' era atribuído à primeira etapa NÃO pronta, sem nenhuma
 * pergunta sobre se algo estava de fato rodando. E `prepare_session` é um
 * caminho que TERMINA: quando falta cópia para algum filme ele grava
 * `all_torrents_found = False` e devolve a sessão para `planning` — ou seja, a
 * preparação acabou e desistiu. A tela lia essas mesmas flags e concluía "a
 * etapa 02 está acontecendo agora", com LED pulsando, cursor de terminal
 * piscando e um feixe de luz correndo pela linha. Nada estava acontecendo, e
 * quem olhasse ficaria esperando.
 *
 * Quem sabe se algo está rodando é o STATUS da sessão, não a ausência de uma
 * marca. `preparing` é o único estado em que existe task em voo.
 */

export type EstadoDaEtapa = 'done' | 'active' | 'parado' | 'pending';

export interface Etapa {
  label: string;
  status: EstadoDaEtapa;
  /** Só a etapa de download tem número a mostrar; as outras ficam vazias. */
  time: string;
}

export function etapasDaPreparacao(sessao?: CinemaSession | null): Etapa[] {
  const marcos = [
    { label: 'Planejamento', pronto: Boolean(sessao?.all_movies_selected) },
    { label: 'Busca de Mídia', pronto: Boolean(sessao?.all_torrents_found) },
    { label: 'Download', pronto: Boolean(sessao?.all_downloads_ready) },
    { label: 'Sessão Pronta', pronto: Boolean(sessao?.playlist_created) },
  ];

  // A máquina de estados é planning -> preparing -> ready -> in_progress, e
  // `preparing` é o único em que há trabalho em voo.
  const rodando = sessao?.status === 'preparing';
  const primeiraPendente = marcos.findIndex((m) => !m.pronto);

  return marcos.map((m, i) => ({
    label: m.label,
    status: estadoDe(m.pronto, i === primeiraPendente, rodando),
    time: m.label === 'Download' && sessao && !m.pronto
      ? `${sessao.download_progress ?? 0}%`
      : '',
  }));
}

function estadoDe(pronto: boolean, ePrimeiraPendente: boolean, rodando: boolean): EstadoDaEtapa {
  if (pronto) return 'done';
  if (!ePrimeiraPendente) return 'pending';
  // A primeira pendente só está "acontecendo" se houver algo acontecendo.
  return rodando ? 'active' : 'parado';
}

/** O que escrever embaixo da etapa. */
export function rotuloDaEtapa(status: EstadoDaEtapa): string {
  switch (status) {
    case 'done': return 'CONCLUÍDO';
    case 'active': return 'EM ANDAMENTO';
    // "Parado" precisa dizer que a bola está com quem lê, senão se confunde
    // com "esperando o servidor" — que foi exatamente o que a tela dizia.
    case 'parado': return 'PARADO — AGUARDA VOCÊ';
    default: return 'AGUARDANDO';
  }
}
