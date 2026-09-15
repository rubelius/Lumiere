/**
 * As duas decisões que erram em silêncio.
 *
 * Roda com `node --test`, sem dependência nenhuma: o serviço tem um pacote só
 * e não vale trazer um runner inteiro para dois arquivos.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { anunciosPara, arquivoPrincipal, cabeNoDisco, faixaPedida, TRACKERS_PUBLICOS } from './escolhas.js';

const arq = (name, length) => ({ name, length });

// ── qual arquivo tocar ────────────────────────────────────────────────────

test('escolhe o maior vídeo', () => {
  const escolhido = arquivoPrincipal([
    arq('filme.mkv', 8_000_000_000),
    arq('extra.mkv', 200_000_000),
  ]);
  assert.equal(escolhido.name, 'filme.mkv');
});

test('ignora o arquivo maior quando ele não é vídeo', () => {
  // O caso real: torrents de filme trazem .rar e .iso de bônus maiores que o
  // filme. Escolher pelo tamanho puro toca o extra — ou não toca nada.
  const escolhido = arquivoPrincipal([
    arq('bonus.iso', 20_000_000_000),
    arq('filme.mkv', 8_000_000_000),
  ]);
  assert.equal(escolhido.name, 'filme.mkv');
});

test('a amostra não ganha do filme', () => {
  const escolhido = arquivoPrincipal([
    arq('sample.mkv', 50_000_000),
    arq('filme.mkv', 8_000_000_000),
  ]);
  assert.equal(escolhido.name, 'filme.mkv');
});

test('sem vídeo reconhecível, tenta o maior de todos', () => {
  // A lista de extensões nunca vai estar completa. Recusar seria pior.
  const escolhido = arquivoPrincipal([
    arq('leia-me.txt', 1000),
    arq('filme.divx', 700_000_000),
  ]);
  assert.equal(escolhido.name, 'filme.divx');
});

test('torrent vazio não escolhe nada em vez de estourar', () => {
  assert.equal(arquivoPrincipal([]), null);
  assert.equal(arquivoPrincipal(null), null);
});

test('extensão em maiúscula continua sendo vídeo', () => {
  const escolhido = arquivoPrincipal([
    arq('EXTRAS.RAR', 9_000_000_000),
    arq('FILME.MKV', 8_000_000_000),
  ]);
  assert.equal(escolhido.name, 'FILME.MKV');
});

// ── que pedaço servir ─────────────────────────────────────────────────────

const TOTAL = 129_241_752;

test('sem Range, o arquivo inteiro', () => {
  assert.deepEqual(faixaPedida(undefined, TOTAL),
                   { inicio: 0, fim: TOTAL - 1, parcial: false });
});

test('faixa comum', () => {
  assert.deepEqual(faixaPedida('bytes=0-65535', TOTAL),
                   { inicio: 0, fim: 65535, parcial: true });
});

test('faixa aberta no fim vai até o último byte', () => {
  assert.deepEqual(faixaPedida('bytes=1000-', TOTAL),
                   { inicio: 1000, fim: TOTAL - 1, parcial: true });
});

test('sufixo pede os ÚLTIMOS bytes, não os primeiros', () => {
  // `bytes=-500` é como o navegador lê o índice de um MP4 cujo `moov` está no
  // fim do arquivo. Tratar como prefixo entrega o começo, e o vídeo não abre.
  assert.deepEqual(faixaPedida('bytes=-500', TOTAL),
                   { inicio: TOTAL - 500, fim: TOTAL - 1, parcial: true });
});

test('fim além do arquivo é aparado, não recusado', () => {
  // Pedido legítimo e comum: o navegador chuta uma faixa maior do que existe.
  assert.deepEqual(faixaPedida(`bytes=1000-${TOTAL * 2}`, TOTAL),
                   { inicio: 1000, fim: TOTAL - 1, parcial: true });
});

test('início além do arquivo é impossível, e precisa virar 416', () => {
  // Servir o arquivo inteiro no lugar monta um vídeo corrompido em silêncio.
  assert.equal(faixaPedida(`bytes=${TOTAL}-`, TOTAL), null);
  assert.equal(faixaPedida(`bytes=${TOTAL + 10}-${TOTAL + 20}`, TOTAL), null);
});

test('faixa invertida é impossível', () => {
  assert.equal(faixaPedida('bytes=5000-1000', TOTAL), null);
});

test('cabeçalho sem sentido cai no arquivo inteiro', () => {
  assert.deepEqual(faixaPedida('bytes=abc', TOTAL),
                   { inicio: 0, fim: TOTAL - 1, parcial: false });
});

// ── a quem anunciar ───────────────────────────────────────────────────────
// O defeito que estes testes guardam: o acervo inteiro chegou aqui com magnets
// sem um único `&tr=`, e ficamos 30 segundos por torrent esperando a DHT
// achar alguém. "Use os trackers do magnet" é uma regra que parece certa e
// deixa 1629 cópias sem par nenhum.

test('um magnet sem tracker nenhum ainda tem a quem anunciar', () => {
  const nus = anunciosPara('magnet:?xt=urn:btih:' + 'a'.repeat(40) + '&dn=Filme');
  assert.ok(nus.length > 0, 'ficaria só com a DHT');
  assert.deepEqual(nus, TRACKERS_PUBLICOS);
});

test('magnet vazio ou ausente não derruba nem devolve lista vazia', () => {
  for (const nada of ['', null, undefined]) {
    assert.ok(anunciosPara(nada).length > 0);
  }
});

test('os trackers do próprio magnet são preservados', () => {
  const com = 'magnet:?xt=urn:btih:' + 'b'.repeat(40)
    + '&tr=' + encodeURIComponent('udp://tracker.exemplo.org:6969/announce');
  const lista = anunciosPara(com);
  assert.ok(lista.includes('udp://tracker.exemplo.org:6969/announce'),
    'descartou o tracker que o magnet trazia');
  // E o piso continua junto: o do magnet pode estar fora do ar.
  assert.ok(lista.includes(TRACKERS_PUBLICOS[0]));
});

test('vários trackers no magnet vêm todos, decodificados', () => {
  const com = 'magnet:?xt=urn:btih:' + 'c'.repeat(40)
    + '&tr=' + encodeURIComponent('udp://um.exemplo:80/announce')
    + '&tr=' + encodeURIComponent('http://dois.exemplo/announce?x=1');
  const lista = anunciosPara(com);
  assert.ok(lista.includes('udp://um.exemplo:80/announce'));
  assert.ok(lista.includes('http://dois.exemplo/announce?x=1'));
});

test('um endereço repetido não é anunciado duas vezes', () => {
  const com = 'magnet:?xt=urn:btih:' + 'd'.repeat(40)
    + '&tr=' + encodeURIComponent(TRACKERS_PUBLICOS[0]);
  const lista = anunciosPara(com);
  const vezes = lista.filter((u) => u === TRACKERS_PUBLICOS[0]).length;
  assert.equal(vezes, 1, `anunciou ${vezes} vezes ao mesmo tracker`);
});

test('o piso tem mais de um tracker, porque um sozinho cai', () => {
  assert.ok(TRACKERS_PUBLICOS.length >= 3);
});

// ── o teto de disco é do DISCO, não de um torrent ─────────────────────────
// O defeito: cada torrent entrando era comparado sozinho contra o limite, e
// nada somava o que já estava lá. Três torrents com teto de 20 GB davam 60 GB
// de disco. É o formato que este projeto já viu — um limite que responde uma
// pergunta mais estreita do que a que aparenta responder.

const GB = 1024 ** 3;

test('o primeiro torrent cabe', () => {
  assert.equal(cabeNoDisco(5 * GB, 0, 20 * GB), true);
});

test('o segundo é medido contando o primeiro', () => {
  // Sozinho caberia — 15 < 20. Somado ao que já está no ar, não.
  assert.equal(cabeNoDisco(15 * GB, 10 * GB, 20 * GB), false,
    'ignorou o que já estava ocupado');
});

test('couber exatamente é caber', () => {
  assert.equal(cabeNoDisco(10 * GB, 10 * GB, 20 * GB), true);
  assert.equal(cabeNoDisco(10 * GB + 1, 10 * GB, 20 * GB), false);
});

test('com o disco já cheio, nada mais entra', () => {
  assert.equal(cabeNoDisco(1, 20 * GB, 20 * GB), false);
});
