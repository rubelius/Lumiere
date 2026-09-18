'use client';

import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

/**
 * Um gráfico do painel.
 *
 * Monta o ECharts à mão em vez de usar um wrapper de React: o pacote
 * acrescentaria uma dependência para fazer três coisas — criar, atualizar e
 * destruir — e é justamente nas três que se erra (instância vazando ao trocar
 * de rota, canvas que não redimensiona).
 */
export function Grafico({ opcoes, altura = 240 }: { opcoes: unknown; altura?: number }) {
  const caixa = useRef<HTMLDivElement>(null);
  const grafico = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!caixa.current) return undefined;
    grafico.current = echarts.init(caixa.current, undefined, { renderer: 'canvas' });

    // Sem isto o canvas nasce com a largura do primeiro quadro e não acompanha
    // a janela — o gráfico fica cortado a cada redimensionamento.
    const observador = new ResizeObserver(() => grafico.current?.resize());
    observador.observe(caixa.current);

    return () => {
      observador.disconnect();
      grafico.current?.dispose();
      grafico.current = null;
    };
  }, []);

  useEffect(() => {
    // Mantendo a instância (sem `notMerge`), a atualização de 60s não recomeça
    // a animação — senão o gráfico pisca na periferia da visão a cada minuto.
    grafico.current?.setOption(opcoes as echarts.EChartsOption);
  }, [opcoes]);

  return <div ref={caixa} style={{ width: '100%', height: altura }} />;
}
