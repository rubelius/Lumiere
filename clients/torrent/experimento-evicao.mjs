/**
 * Experimento, não código de produção.
 *
 * A pergunta: se o store "esquecer" uma peça que o torrent acha que tem, o que
 * acontece ao ler essa faixa? Ele rebaixa, trava, ou devolve lixo?
 *
 * Disso depende o desenho inteiro do cache deslizante. Se ele rebaixa sozinho,
 * um store com cota resolve tudo. Se trava, é preciso mexer no bitfield — e aí
 * é cirurgia em interno de biblioteca.
 */

import FSChunkStore from 'fs-chunk-store';
import WebTorrent from 'webtorrent';

const SINTEL = 'magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10'
  + '&dn=Sintel&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337'
  + '&tr=udp%3A%2F%2Fexplodie.org%3A6969&tr=udp%3A%2F%2Ftracker.torrent.eu.org%3A451';

const esquecidas = new Set();

/** Um FSChunkStore que finge não ter as peças que mandarmos esquecer. */
class StoreQueEsquece {
  constructor(chunkLength, opts) {
    this.chunkLength = chunkLength;
    this.dentro = new FSChunkStore(chunkLength, opts);
  }

  put(index, buf, cb) {
    // Rebaixou: o cache volta a tê-la. Sem isto o experimento manteria a peça
    // "esquecida" para sempre e nunca veria a recuperação acontecer.
    if (esquecidas.delete(index)) console.log(`    [store] peça ${index} voltou`);
    this.dentro.put(index, buf, cb);
  }

  get(index, opts, cb) {
    if (typeof opts === 'function') { cb = opts; opts = {}; }
    if (esquecidas.has(index)) {
      console.log(`    [store] peça ${index} foi evacuada — devolvendo erro`);
      return cb(new Error('peça evacuada do cache'));
    }
    this.dentro.get(index, opts, cb);
  }

  close(cb) { this.dentro.close(cb); }
  destroy(cb) { this.dentro.destroy(cb); }
}

const cliente = new WebTorrent();
process.on('uncaughtException', (e) => console.log('  !! exceção:', e.message));

const torrent = cliente.add(SINTEL, {
  path: '/tmp/lumiere-experimento',
  store: StoreQueEsquece,
  // Sem a camada de cache em memória: senão a releitura vem dela e o
  // experimento não testa nada.
  storeCacheSlots: 0,
});

const desiste = setTimeout(() => {
  console.log('  tempo esgotado');
  cliente.destroy(() => process.exit(3));
}, 180000);

torrent.on('metadata', () => {
  console.log(`  peça = ${(torrent.pieceLength / 1024).toFixed(0)} KB, `
    + `${torrent.pieces.length} peças, arquivo = ${torrent.files.length}`);
});

torrent.on('ready', () => console.log('  pronto, baixando...'));

let jaTestou = false;
torrent.on('download', async () => {
  if (jaTestou || torrent.progress < 0.02) return;
  jaTestou = true;

  const arquivo = torrent.files.reduce((a, b) => (a.length > b.length ? a : b));
  console.log(`  baixou ${(torrent.progress * 100).toFixed(1)}%`);

  // 1. Lê os primeiros 32 KB normalmente, para provar que o caminho funciona.
  const antes = await leFaixa(arquivo, 0, 32767);
  console.log(`  leitura normal: ${antes} bytes`);

  // 2. Evacua as peças 0 e 1 e lê de novo A MESMA faixa.
  esquecidas.add(0);
  esquecidas.add(1);
  // A receita que o próprio webtorrent usa quando uma peça falha na
  // verificação: recria a Piece, zera o bit e volta a selecioná-la.
  torrent._markUnverified(0);
  torrent._markUnverified(1);
  console.log('  evacuadas as peças 0 e 1 E marcadas como não-tidas; relendo...');

  const inicio = Date.now();
  const depois = await leFaixa(arquivo, 0, 32767, 60000);
  const levou = ((Date.now() - inicio) / 1000).toFixed(1);

  if (depois === 'ERRO') console.log(`  => a leitura FALHOU (${levou}s)`);
  else if (depois === 'TRAVOU') console.log(`  => a leitura TRAVOU (${levou}s)`);
  else console.log(`  => releu ${depois} bytes em ${levou}s`);

  clearTimeout(desiste);
  cliente.destroy(() => process.exit(0));
});

function leFaixa(arquivo, start, end, tempoLimite = 20000) {
  return new Promise((resolve) => {
    let total = 0;
    let resolvido = false;
    const acaba = (v) => { if (!resolvido) { resolvido = true; resolve(v); } };

    const relogio = setTimeout(() => acaba('TRAVOU'), tempoLimite);
    const fluxo = arquivo.createReadStream({ start, end });

    fluxo.on('data', (p) => { total += p.length; });
    fluxo.on('end', () => { clearTimeout(relogio); acaba(total); });
    fluxo.on('error', (e) => {
      clearTimeout(relogio);
      console.log('    [fluxo] erro:', e.message);
      acaba('ERRO');
    });
  });
}
