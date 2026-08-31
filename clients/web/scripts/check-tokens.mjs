/**
 * Verifica se lib/design-tokens.ts (espelho para React Native) continua
 * de acordo com o :root de app/globals.css (fonte da verdade).
 *
 * Rode com: npm run check:tokens
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// --gold-deep <-> goldDeep
const toCssName = (ts) => ts.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())

// Tokens derivados por color-mix não têm hex literal no CSS; conferidos à mão.
const DERIVADOS = new Set(['goldLight'])

function palettaDoTs() {
  const src = readFileSync(join(root, 'lib/design-tokens.ts'), 'utf8')
  const bloco = src.match(/export const palette = \{([\s\S]*?)\n\} as const/)
  if (!bloco) throw new Error('bloco `export const palette` não encontrado em lib/design-tokens.ts')
  const out = {}
  for (const [, nome, hex] of bloco[1].matchAll(/^\s*([A-Za-z0-9]+):\s*'(#[0-9A-Fa-f]{6})'/gm)) {
    out[nome] = hex.toUpperCase()
  }
  return out
}

function palettaDoCss() {
  const src = readFileSync(join(root, 'app/globals.css'), 'utf8')
  const bloco = src.match(/\n:root \{([\s\S]*?)\n\}/)
  if (!bloco) throw new Error('bloco `:root` não encontrado em app/globals.css')
  const out = {}
  for (const [, nome, hex] of bloco[1].matchAll(/^\s*--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})\s*;/gm)) {
    out[nome] = hex.toUpperCase()
  }
  return out
}

const ts = palettaDoTs()
const css = palettaDoCss()
const problemas = []

for (const [nome, hex] of Object.entries(ts)) {
  if (DERIVADOS.has(nome)) continue
  const cssNome = toCssName(nome)
  if (!(cssNome in css)) problemas.push(`${nome}: existe no TS, ausente em --${cssNome} no CSS`)
  else if (css[cssNome] !== hex) problemas.push(`${nome}: TS ${hex} != CSS --${cssNome} ${css[cssNome]}`)
}
for (const nome of Object.keys(css)) {
  const tsNome = nome.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
  if (!(tsNome in ts)) problemas.push(`--${nome}: existe no CSS, ausente em palette.${tsNome}`)
}

if (problemas.length) {
  console.error(`\n✗ ${problemas.length} divergência(s) entre globals.css e design-tokens.ts:\n`)
  for (const p of problemas) console.error(`  · ${p}`)
  console.error('\nO CSS é a fonte da verdade — ajuste o espelho em lib/design-tokens.ts.\n')
  process.exit(1)
}

console.log(`✓ ${Object.keys(ts).length} tokens em sincronia entre globals.css e design-tokens.ts`)
