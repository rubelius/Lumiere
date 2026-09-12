/**
 * As decisões do serviço de torrent, separadas para poderem ser testadas.
 *
 * O resto do servidor é rede e disco; isto aqui é julgamento — qual arquivo
 * tocar e que pedaço dele servir. As duas coisas erram em silêncio quando
 * erram: um arquivo errado toca a amostra em vez do filme, e uma faixa errada
 * monta um vídeo corrompido sem nenhum erro no caminho.
 */

import path from 'node:path';

export const EXTENSOES_DE_VIDEO = new Set([
  '.mkv', '.mp4', '.avi', '.mov', '.m4v', '.webm', '.ts', '.m2ts', '.wmv',
]);

/**
 * O arquivo que interessa dentro do torrent.
 *
 * O maior COM EXTENSÃO DE VÍDEO, e não simplesmente o maior: torrents de filme
 * costumam trazer amostras, extras e às vezes um .iso ou .rar de bônus maior
 * que o próprio filme. Escolher pelo tamanho puro toca o extra.
 *
 * Sem nenhum vídeo reconhecível, cai no maior de todos — tentar é melhor que
 * recusar, porque a lista de extensões nunca vai estar completa.
 */
export function arquivoPrincipal(arquivos) {
  if (!arquivos || arquivos.length === 0) return null;

  const videos = arquivos.filter(
    (f) => EXTENSOES_DE_VIDEO.has(path.extname(f.name || '').toLowerCase()));
  const candidatos = videos.length ? videos : arquivos;

  return candidatos.reduce((maior, f) => (f.length > maior.length ? f : maior),
                           candidatos[0]);
}

/**
 * A faixa de bytes que o navegador pediu.
 *
 * Devolve `{ inicio, fim }`, ou `null` quando o pedido é impossível — e aí o
 * chamador precisa responder 416. Servir o arquivo inteiro no lugar de uma
 * faixa inválida faz o navegador montar um vídeo corrompido, sem erro nenhum
 * aparecendo.
 *
 * Sem cabeçalho `Range`, devolve o arquivo inteiro: é o que o `<video>` pede
 * na primeira requisição, antes de saber o tamanho.
 */
export function faixaPedida(cabecalho, total) {
  if (!cabecalho) return { inicio: 0, fim: total - 1, parcial: false };

  const casou = /bytes=(\d*)-(\d*)/.exec(cabecalho);
  if (!casou) return { inicio: 0, fim: total - 1, parcial: false };

  const temInicio = casou[1] !== '';
  const temFim = casou[2] !== '';

  // `bytes=-500` quer dizer "os últimos 500", e não "do zero ao 500". O
  // navegador usa essa forma para ler o índice de um MP4 cujo `moov` está no
  // fim — tratá-la como prefixo entrega o começo do arquivo e o vídeo não abre.
  if (!temInicio && temFim) {
    const quantos = Number(casou[2]);
    if (quantos <= 0) return null;
    return { inicio: Math.max(0, total - quantos), fim: total - 1, parcial: true };
  }

  const inicio = temInicio ? Number(casou[1]) : 0;
  const fim = temFim ? Number(casou[2]) : total - 1;

  if (!Number.isFinite(inicio) || !Number.isFinite(fim)) return null;
  if (inicio >= total || inicio > fim || inicio < 0) return null;

  // Um fim além do arquivo é pedido legítimo e comum: o navegador chuta uma
  // faixa maior do que existe. A regra é aparar, não recusar.
  return { inicio, fim: Math.min(fim, total - 1), parcial: true };
}
