/**
 * O cache com cota.
 *
 * A política erra em silêncio: apagar a peça errada não dá erro nenhum — o
 * filme só engasga, ou para com zero bytes e sem mensagem.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, beforeEach, test } from 'node:test';

import { CacheDeslizante, FOLGA_A_FRENTE } from './cacheDeslizante.js';

const RAIZ = fs.mkdtempSync(path.join(os.tmpdir(), 'cache-teste-'));
after(() => fs.rmSync(RAIZ, { recursive: true, force: true }));

const PECA = 1024;
let contador = 0;

/** Um torrent de mentira que só registra o que foi desmarcado. */
function torrenteFalso() {
  return { desmarcadas: [], _markUnverified(i) { this.desmarcadas.push(i); } };
}

function cacheCom(cota, torrent = torrenteFalso()) {
  const c = new CacheDeslizante(PECA, {
    path: RAIZ, name: `t${contador++}`, cota, torrent,
  });
  return { cache: c, torrent };
}

const peca = (n) => Buffer.alloc(PECA, n % 256);

/** Grava N peças em ordem, como o download faria. */
async function grava(cache, deInclusive, ateInclusive) {
  for (let i = deInclusive; i <= ateInclusive; i++) {
    await new Promise((r, rej) => cache.put(i, peca(i), (e) => (e ? rej(e) : r())));
  }
}

const le = (cache, index) =>
  new Promise((r) => cache.get(index, {}, (erro, buf) => r(erro ? 'ERRO' : buf.length)));

beforeEach(() => { contador += 1; });

// ── o básico ──────────────────────────────────────────────────────────────

test('grava e lê uma peça', async () => {
  const { cache } = cacheCom(Infinity);
  await grava(cache, 0, 0);
  assert.equal(await le(cache, 0), PECA);
});

test('peça que nunca foi gravada devolve erro, e não silêncio', async () => {
  const { cache } = cacheCom(Infinity);
  assert.equal(await le(cache, 7), 'ERRO');
});

test('lê uma fatia da peça', async () => {
  const { cache } = cacheCom(Infinity);
  await grava(cache, 0, 0);
  const fatia = await new Promise((r) =>
    cache.get(0, { offset: 10, length: 30 }, (e, b) => r(e ? 'ERRO' : b.length)));
  assert.equal(fatia, 30);
});

// ── a cota ────────────────────────────────────────────────────────────────

test('ilimitado nunca apaga nada', async () => {
  const { cache, torrent } = cacheCom(Infinity);
  await grava(cache, 0, 49);
  cache.defineLeitura(49);

  assert.equal(cache.guardadas.size, 50);
  assert.deepEqual(torrent.desmarcadas, []);
});

test('passou da cota: apaga as peças já assistidas', async () => {
  // A cota precisa ser MAIOR que a folga de leitura, senão quem manda é a
  // folga — e mandar é o certo dela: não se apaga o que está tocando.
  const cota = (FOLGA_A_FRENTE + 10) * PECA;
  const { cache } = cacheCom(cota);
  for (let i = 0; i <= 59; i++) {
    cache.defineLeitura(i);
    await grava(cache, i, i);
  }

  assert.ok(cache.bytes <= cota,
            `guardou ${cache.bytes} bytes com cota de ${cota}`);
});

test('o que foi apagado é o COMEÇO, não o que está tocando', async () => {
  const { cache } = cacheCom(10 * PECA);
  for (let i = 0; i <= 29; i++) {
    cache.defineLeitura(i);
    await grava(cache, i, i);
  }

  const guardadas = [...cache.guardadas.keys()].sort((a, b) => a - b);
  assert.ok(guardadas.includes(29), 'apagou a peça que está tocando');
  assert.ok(!guardadas.includes(0), 'manteve o começo do filme');
});

test('o torrent é avisado de cada peça apagada', async () => {
  // Sem este aviso, um salto para trás lê do store, toma erro, e o fluxo
  // termina com ZERO BYTES e sem erro nenhum. Medido.
  const { cache, torrent } = cacheCom(10 * PECA);
  for (let i = 0; i <= 29; i++) {
    cache.defineLeitura(i);
    await grava(cache, i, i);
  }

  assert.ok(torrent.desmarcadas.length > 0, 'apagou sem avisar o torrent');
  for (const index of torrent.desmarcadas) {
    assert.ok(!cache.guardadas.has(index), `avisou sobre ${index} sem apagar`);
  }
});

test('a peça apagada some do disco de verdade', async () => {
  const { cache } = cacheCom(10 * PECA);
  for (let i = 0; i <= 29; i++) {
    cache.defineLeitura(i);
    await grava(cache, i, i);
  }

  const noDisco = fs.readdirSync(cache.pasta).length;
  assert.equal(noDisco, cache.guardadas.size,
               'o registro e o disco discordam');
});

test('nunca apaga o que está à frente da leitura', async () => {
  // O caso que faria o filme engasgar em ciclo: apagar o que está prestes a
  // ser lido, rebaixar, apagar de novo.
  const { cache } = cacheCom(2 * PECA);
  cache.defineLeitura(0);
  await grava(cache, 0, 9);

  const guardadas = [...cache.guardadas.keys()];
  assert.ok(guardadas.includes(9), 'apagou o que ainda vai ser lido');
});

test('cota menor que a janela em leitura estoura, mas não apaga o filme', async () => {
  const { cache, torrent } = cacheCom(PECA);
  cache.defineLeitura(0);
  await grava(cache, 0, 19);

  assert.ok(cache.bytes > cache.cota, 'deveria ter estourado');
  assert.deepEqual(torrent.desmarcadas, [], 'apagou o que está tocando');
});

// ── recuperação ───────────────────────────────────────────────────────────

test('peça apagada e rebaixada volta a ser legível', async () => {
  const { cache } = cacheCom((FOLGA_A_FRENTE + 10) * PECA);
  for (let i = 0; i <= 59; i++) {
    cache.defineLeitura(i);
    await grava(cache, i, i);
  }
  assert.equal(await le(cache, 0), 'ERRO', 'a peça inicial deveria ter saído');

  // O salto para trás MOVE a leitura antes de reler — sem isso a peça
  // rebaixada seria evacuada de novo no mesmo instante, por estar atrás.
  cache.defineLeitura(0);
  await grava(cache, 0, 0);

  assert.equal(await le(cache, 0), PECA);
});

test('sem _markUnverified, a evacuação se desliga em vez de servir silêncio', async () => {
  // Gastar disco é ruim; servir zero bytes sem erro é pior. Se uma versão
  // futura do webtorrent remover o método, o cache vira ilimitado.
  const semMetodo = {};
  const { cache } = cacheCom(2 * PECA, semMetodo);
  cache.defineLeitura(FOLGA_A_FRENTE + 10);
  await grava(cache, 0, 9);

  assert.equal(cache.cota, Infinity, 'seguiu apagando sem poder avisar');
  assert.equal(cache.guardadas.size, 10, 'apagou peças que não pôde desmarcar');
});

test('o registro se corrige quando o arquivo some por fora', async () => {
  const { cache } = cacheCom(Infinity);
  await grava(cache, 0, 0);
  fs.unlinkSync(path.join(cache.pasta, '0.peca'));

  assert.equal(await le(cache, 0), 'ERRO');
  assert.ok(!cache.guardadas.has(0), 'continuou afirmando que tem a peça');
});

test('destruir apaga a pasta inteira', async () => {
  const { cache } = cacheCom(Infinity);
  await grava(cache, 0, 4);
  const pasta = cache.pasta;

  await new Promise((r) => cache.destroy(r));
  assert.ok(!fs.existsSync(pasta), 'deixou gigabytes para trás');
});

test('avançar a leitura libera espaço mesmo sem baixar mais nada', async () => {
  // O caso do filme já baixado: sem `put`, o gatilho de escrita nunca volta a
  // disparar. Medido antes do conserto — 987 peças antes e depois de assistir
  // o filme inteiro.
  const { cache } = cacheCom((FOLGA_A_FRENTE + 5) * PECA);
  cache.defineLeitura(0);
  await grava(cache, 0, 59);

  const cheio = cache.guardadas.size;
  cache.defineLeitura(59);

  assert.ok(cache.guardadas.size < cheio,
            `nada foi liberado ao avançar a leitura (${cheio} peças)`);
  assert.ok(cache.bytes <= cache.cota, 'seguiu acima da cota');
});

test('recuar a leitura não apaga nada', async () => {
  // Voltar no filme não torna nada "já assistido" — pelo contrário.
  const { cache } = cacheCom((FOLGA_A_FRENTE + 5) * PECA);
  cache.defineLeitura(0);
  await grava(cache, 0, 40);
  cache.defineLeitura(40);
  const depoisDeAvancar = cache.guardadas.size;

  cache.defineLeitura(0);
  assert.equal(cache.guardadas.size, depoisDeAvancar);
});

// ── a cota como teto de verdade ───────────────────────────────────────────

/** Um torrent de mentira que também sabe pausar. */
function torrenteComPausa() {
  return {
    desmarcadas: [], pausas: 0, retomadas: 0, pausado: false,
    _markUnverified(i) { this.desmarcadas.push(i); },
    pause() { this.pausas++; this.pausado = true; },
    resume() { this.retomadas++; this.pausado = false; },
  };
}

test('sem leitura avançando, o download PARA em vez de passar da cota', async () => {
  // Medido antes do conserto: 123 MB baixados com cota de 20 MB, porque
  // ninguém estava assistindo e não havia o que evacuar.
  const t = torrenteComPausa();
  const { cache } = cacheCom(5 * PECA, t);
  cache.defineLeitura(0);
  await grava(cache, 0, 19);

  assert.ok(t.pausado, 'seguiu baixando com a cota estourada');
  assert.equal(t.pausas, 1, 'pausou mais de uma vez');
});

test('avançar a leitura libera espaço e o download retoma', async () => {
  const t = torrenteComPausa();
  const { cache } = cacheCom((FOLGA_A_FRENTE + 5) * PECA, t);
  cache.defineLeitura(0);
  await grava(cache, 0, 59);
  assert.ok(t.pausado, 'deveria ter pausado');

  cache.defineLeitura(59);

  assert.ok(!t.pausado, 'ficou pausado mesmo com espaço livre');
  assert.equal(t.retomadas, 1);
});

test('ilimitado nunca pausa', async () => {
  const t = torrenteComPausa();
  const { cache } = cacheCom(Infinity, t);
  cache.defineLeitura(0);
  await grava(cache, 0, 99);

  assert.equal(t.pausas, 0);
});
