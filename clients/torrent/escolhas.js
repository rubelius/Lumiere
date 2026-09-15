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

/**
 * Trackers públicos, acrescentados a todo magnet que chega.
 *
 * MEDIDO: o mesmo magnet de Pulp Fiction (1348 semeadores segundo o indexador)
 * ficou 30 segundos sem UM ÚNICO par usando só a DHT, e trouxe os metadados em
 * 2,3 segundos quando anunciado a estes endereços.
 *
 * A razão é simples e fácil de não enxergar: os 1629 magnets do acervo vêm dos
 * indexadores como `magnet:?xt=urn:btih:HASH&dn=NOME` — NENHUM traz `&tr=`. Sem
 * tracker sobra a DHT, e a DHT atrás de NAT doméstico é lenta quando funciona.
 * Os semeadores estão lá; nós é que não perguntávamos a quem sabe deles.
 *
 * Isto NÃO é um segundo cadastro de trackers a manter em dia: é o piso para
 * quando o magnet não traz nenhum. Os do próprio magnet continuam valendo — o
 * webtorrent soma as duas listas.
 */
export const TRACKERS_PUBLICOS = [
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://open.demonii.com:1337/announce',
  'udp://tracker.torrent.eu.org:451/announce',
  'udp://exodus.desync.com:6969/announce',
  'udp://open.stealth.si:80/announce',
  'udp://tracker.dler.org:6969/announce',
];

/**
 * A quem anunciar este magnet.
 *
 * Devolve SEMPRE uma lista não-vazia, mesmo — principalmente — quando o magnet
 * não declara tracker nenhum. Confiar só no que o magnet traz é o defeito que
 * deixou o acervo inteiro dependendo da DHT.
 */
export function anunciosPara(magnet) {
  const proprios = [...String(magnet ?? '').matchAll(/[?&]tr=([^&]+)/g)]
    .map((achado) => {
      try { return decodeURIComponent(achado[1]); } catch { return achado[1]; }
    })
    .filter(Boolean);

  // Um Set porque um magnet pode repetir um endereço que já está no piso, e
  // anunciar duas vezes ao mesmo tracker só rende tráfego.
  return [...new Set([...proprios, ...TRACKERS_PUBLICOS])];
}

/**
 * Se o próximo torrent cabe, contando o que os outros JÁ ocupam.
 *
 * O teto era por torrent: cada um entrando era comparado sozinho contra o
 * limite, e nada somava o que já estava em disco. Com três torrents no ar e
 * teto de 20 GB, o disco podia chegar a 60. Na máquina do usuário isso disputa
 * com um SSD de centenas de GB; dentro da VM do Docker o disco é fixo e
 * compartilhado com a stack de mídia que já roda lá — encher significa derrubar
 * o Prowlarr junto.
 *
 * É o formato de defeito que este projeto já viu: um limite que responde uma
 * pergunta mais estreita do que a que aparenta responder.
 */
export function cabeNoDisco(pedido, jaEmUso, limite) {
  return jaEmUso + pedido <= limite;
}
