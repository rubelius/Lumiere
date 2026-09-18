/**
 * O tema dos gráficos, na linguagem da casa.
 *
 * O ECharts vem com um tema de dashboard: azul, grade branca, sombra, fonte do
 * sistema. Nada disso pertence a uma cinemateca — e um gráfico que parece de
 * outro produto denuncia que foi colado, não desenhado.
 *
 * As regras daqui são as mesmas do resto do Lumière: fundo transparente (quem
 * pinta é a página), dourado como único acento, tipografia monoespaçada nos
 * rótulos técnicos, grade quase invisível, e nenhuma animação que chame mais
 * atenção que o dado.
 */

export const OURO = '#BF8F3C';
export const FILME = '#EDE8DC';
export const M2 = '#8A857C';
export const M3 = '#565450';
export const TERRA = '#A6603C';
export const VOID = '#040402';

/** A paleta de séries. Variações de luz, e não de matiz. */
export const SERIES = [OURO, '#8A857C', '#6E5A3A', '#A6603C', '#4A4640'];

const MONO = "'DM Mono', monospace";

const EIXO = {
  axisLine: { lineStyle: { color: 'rgba(237,232,220,0.10)' } },
  axisTick: { show: false },
  axisLabel: { color: M3, fontFamily: MONO, fontSize: 9 },
  splitLine: { lineStyle: { color: 'rgba(237,232,220,0.04)' } },
};

/** A base que todo gráfico do painel herda. */
export function baseDoGrafico() {
  return {
    backgroundColor: 'transparent',
    // A grade é apertada de propósito: o título e a procedência vivem FORA do
    // canvas, em HTML, onde dá para selecionar o texto e onde eles seguem a
    // mesma tipografia do resto da página.
    grid: { left: 48, right: 16, top: 16, bottom: 28, containLabel: true },
    textStyle: { fontFamily: MONO, fontSize: 9, color: M2 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(4,4,2,0.95)',
      borderColor: 'rgba(191,143,60,0.35)',
      borderWidth: 1,
      textStyle: { color: FILME, fontFamily: MONO, fontSize: 10 },
      axisPointer: { lineStyle: { color: 'rgba(191,143,60,0.3)' } },
    },
    legend: {
      textStyle: { color: M3, fontFamily: MONO, fontSize: 9 },
      icon: 'rect', itemWidth: 8, itemHeight: 2, top: 0,
    },
    xAxis: { type: 'category', ...EIXO },
    yAxis: { type: 'value', ...EIXO },
    color: SERIES,
    // Uma vez, devagar, e só na entrada. Gráfico que reanima a cada atualização
    // de 60 segundos pisca na periferia da visão e cansa.
    animationDuration: 700,
    animationEasing: 'cubicOut' as const,
  };
}

interface PontoDeLinha { dia: string; media: number; pior: number; melhor: number; n: number }
interface SerieDeLinhas { nome: string; pontos: PontoDeLinha[] }
interface Barra { nome: string; total: number; falhas: number; rodando: number }

/**
 * Séries de linha: a média de cada série, e o pior caso junto.
 *
 * O pior caso vai no mesmo gráfico de propósito — a média esconde a execução
 * que travou, e é justamente ela que interessa num benchmark.
 */
export function opcoesDeLinhas(series: SerieDeLinhas[]) {
  const dias = [...new Set(series.flatMap((s) => s.pontos.map((p) => p.dia)))].sort();
  const porDia = (s: SerieDeLinhas, campo: 'media' | 'pior') =>
    dias.map((d) => s.pontos.find((p) => p.dia === d)?.[campo] ?? null);

  return {
    ...baseDoGrafico(),
    xAxis: { ...baseDoGrafico().xAxis, data: dias.map((d) => d.slice(5).replace('-', '/')) },
    series: series.flatMap((s, i) => [
      {
        name: s.nome, type: 'line', smooth: true, showSymbol: false,
        connectNulls: true, data: porDia(s, 'media'),
        lineStyle: { width: 1.4, color: SERIES[i % SERIES.length] },
      },
      {
        name: `${s.nome} · pior`, type: 'line', smooth: true, showSymbol: false,
        connectNulls: true, data: porDia(s, 'pior'),
        lineStyle: { width: 0.8, type: 'dotted', color: SERIES[i % SERIES.length], opacity: 0.6 },
      },
    ]),
  };
}

/**
 * Barras: o total, com as falhas destacadas em cor de alerta.
 *
 * Empilhadas e não lado a lado: a pergunta é "quanto do total falhou", e duas
 * barras separadas obrigam a comparar alturas em vez de ler uma proporção.
 */
export function opcoesDeBarras(barras: Barra[]) {
  const temFalha = barras.some((b) => b.falhas > 0 || b.rodando > 0);
  const base = baseDoGrafico();
  return {
    ...base,
    legend: { ...base.legend, show: temFalha },
    xAxis: {
      ...base.xAxis,
      data: barras.map((b) => b.nome),
      axisLabel: { ...EIXO.axisLabel, interval: 0, rotate: barras.length > 8 ? 40 : 0 },
    },
    series: temFalha
      ? [
        { name: 'concluídas', type: 'bar', stack: 'x', barWidth: '54%',
          data: barras.map((b) => Math.max(0, b.total - b.falhas - b.rodando)),
          itemStyle: { color: OURO } },
        { name: 'em curso', type: 'bar', stack: 'x',
          data: barras.map((b) => b.rodando), itemStyle: { color: M3 } },
        { name: 'falhas', type: 'bar', stack: 'x',
          data: barras.map((b) => b.falhas), itemStyle: { color: TERRA } },
      ]
      : [{ type: 'bar', barWidth: '54%', data: barras.map((b) => b.total),
           itemStyle: { color: OURO } }],
  };
}
