/**
 * LUMIÈRE — DESIGN TOKENS (independentes de plataforma)
 *
 * Espelho em TypeScript da paleta canônica declarada em `app/globals.css`
 * (bloco `:root`). Existe porque o React Native não entende CSS variables:
 * o app de TV precisa dos mesmos valores como dados.
 *
 * ── REGRA ──
 * `globals.css` é a FONTE DA VERDADE. Este arquivo espelha.
 * No código web use `var(--gold)`; reserve `palette.gold` para
 * React Native, canvas, geração de imagem e qualquer contexto não-CSS.
 *
 * A divergência entre os dois é verificada por `npm run check:tokens`.
 *
 * Motion (easings, durations, springs, variants) NÃO vive aqui —
 * vive em `lib/motion.ts`, que é o sistema em uso.
 */

/** Paleta Fine Art. Espelha o `:root` de app/globals.css. */
export const palette = {
  // ── Voids & surfaces — pretos de cinema, nunca azulados ──
  void: '#040402',
  bg: '#080806',
  s1: '#0C0C0A',
  s2: '#121210',
  s3: '#1A1A17',
  s4: '#22221E',
  s5: '#2C2C27',

  // ── Film & muted — escala de cinzas quentes ──
  film: '#EDE8DC',
  m1: '#A3A098',
  m2: '#8C8880',
  m3: '#565450',
  m4: '#302E2A',
  m5: '#1C1B18',

  // ── Gold — a única cor quente de acento ──
  gold: '#BF8F3C',
  goldDeep: '#7A5A20',
  /** Resolvido de color-mix(in srgb, gold 65%, film) — literal para uso fora do CSS. */
  goldLight: '#D1B58E',

  // ── Qualidade — dessaturadas, fílmicas ──
  sage: '#6B9E84',
  terra: '#B87B5E',
  violet: '#8E7FA8',
  steel: '#6B8EA8',
  teal: '#7A9E9E',
  gray: '#6B6B6B',

  danger: '#B05050',
} as const

/** Cor por selo de qualidade. */
export const qualityColor = {
  REMUX: palette.sage,
  HDR: palette.terra,
  ATMOS: palette.violet,
  DV: palette.steel,
  IMAX: palette.teal,
  'WEB-DL': palette.gray,
  '4K': palette.gold,
} as const

/**
 * Famílias tipográficas. Pesos limitados aos carregados em app/layout.tsx:
 * Cormorant Garamond 300/400/600 · DM Mono 300/400/500 · DM Sans 300/400.
 * Pedir um peso fora dessa lista faz o browser sintetizar (e fica feio).
 */
export const fontFamily = {
  /** Títulos e pôsteres — alta cultura, Fine Art. */
  display: 'Cormorant Garamond',
  /** Textos de interface. */
  ui: 'DM Sans',
  /** Dados técnicos — ar analógico/diagnóstico. */
  data: 'DM Mono',
} as const

export const fontWeight = {
  display: [300, 400, 600],
  ui: [300, 400],
  data: [300, 400, 500],
} as const

export const spacing = {
  0: '0',
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
  16: '4rem',
  20: '5rem',
  24: '6rem',
  32: '8rem',
} as const

export const fontSize = {
  xs: '0.75rem',
  sm: '0.875rem',
  base: '1rem',
  lg: '1.125rem',
  xl: '1.25rem',
  '2xl': '1.563rem',
  '3xl': '1.953rem',
  '4xl': '2.441rem',
  '5xl': '3.052rem',
  '6xl': '3.815rem',
  '7xl': '4.768rem',
} as const

export type PaletteToken = keyof typeof palette
export type QualityTag = keyof typeof qualityColor
