/**
 * As duas decisões que erram em silêncio.
 *
 * Roda com `node --test`, sem dependência nenhuma: o serviço tem um pacote só
 * e não vale trazer um runner inteiro para dois arquivos.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { arquivoPrincipal, faixaPedida } from './escolhas.js';

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
