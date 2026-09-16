import { describe, expect, it } from 'vitest';

import { etapasDaPreparacao, rotuloDaEtapa } from './etapasDaPreparacao';

// A etapa "02 Busca de Mídia" aparecia como "EM ANDAMENTO" com LED pulsando e
// cursor de terminal piscando quando NADA estava rodando: `prepare_session` é
// um caminho que TERMINA — ao faltar cópia ele grava all_torrents_found=False e
// devolve a sessão para `planning`. A tela lia a primeira flag falsa e concluía
// "está acontecendo agora". Quem olhasse ficaria esperando para sempre.

const sessao = (campos: Record<string, unknown>) => ({
  all_movies_selected: false, all_torrents_found: false,
  all_downloads_ready: false, playlist_created: false,
  status: 'planning', download_progress: 0, ...campos,
} as never);

describe('etapasDaPreparacao', () => {
  it('a preparação que desistiu não aparece como em andamento', () => {
    // O cenário exato: planejou, não achou cópia para todo mundo, voltou para
    // planning.
    const etapas = etapasDaPreparacao(sessao({
      all_movies_selected: true, status: 'planning',
    }));
    expect(etapas[1].status).toBe('parado');
    expect(etapas[1].status).not.toBe('active');
  });

  it('com a task em voo, a etapa está mesmo em andamento', () => {
    const etapas = etapasDaPreparacao(sessao({
      all_movies_selected: true, status: 'preparing',
    }));
    expect(etapas[1].status).toBe('active');
  });

  it('só a PRIMEIRA pendente muda de estado; as outras esperam', () => {
    const etapas = etapasDaPreparacao(sessao({
      all_movies_selected: true, status: 'preparing',
    }));
    expect(etapas.map((e) => e.status))
      .toEqual(['done', 'active', 'pending', 'pending']);
  });

  it('sessão pronta não tem etapa ativa nenhuma', () => {
    const etapas = etapasDaPreparacao(sessao({
      all_movies_selected: true, all_torrents_found: true,
      all_downloads_ready: true, playlist_created: true, status: 'ready',
    }));
    expect(etapas.every((e) => e.status === 'done')).toBe(true);
  });

  it('sem sessão nenhuma, nada está acontecendo', () => {
    const etapas = etapasDaPreparacao(undefined);
    expect(etapas[0].status).toBe('parado');
    expect(etapas.some((e) => e.status === 'active')).toBe(false);
  });

  it('só a etapa de download mostra número', () => {
    const etapas = etapasDaPreparacao(sessao({
      all_movies_selected: true, all_torrents_found: true,
      status: 'preparing', download_progress: 42,
    }));
    expect(etapas[2].time).toBe('42%');
    expect(etapas[0].time).toBe('');
    expect(etapas[1].time).toBe('');
  });
});

describe('rotuloDaEtapa', () => {
  it('"parado" diz que a bola está com quem lê', () => {
    // Sem isso se confunde com "esperando o servidor" — que é o que a tela
    // dizia, e é a razão de alguém ficar esperando.
    expect(rotuloDaEtapa('parado')).toContain('AGUARDA VOCÊ');
    expect(rotuloDaEtapa('parado')).not.toContain('EM ANDAMENTO');
  });

  it('e "em andamento" fica só para o que está em voo', () => {
    expect(rotuloDaEtapa('active')).toBe('EM ANDAMENTO');
    expect(rotuloDaEtapa('done')).toBe('CONCLUÍDO');
    expect(rotuloDaEtapa('pending')).toBe('AGUARDANDO');
  });
});
