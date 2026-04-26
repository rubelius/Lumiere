'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

/* ─────────────────────────────────────────────────────────────
   MARQUEE — Horizontal scrolling film titles.
   Like a cinema marquee sign or end credits crawl.
   Inspired by meesverberne.com's "Movement / Emotion / 
   Storytelling / Intention" kinetic text sequence.
   ───────────────────────────────────────────────────────────── */

const MARQUEE_ITEMS = [
  'Persona', 'L\'Avventura', 'Stalker', 'Barry Lyndon',
  'Satantango', 'Shoah', 'Jeanne Dielman', '2001',
  'Tokyo Story', 'Mulholland Drive', 'Au Hasard Balthazar',
  'Aguirre', 'Sans Soleil', 'The Tree of Life',
]

export function CinemaMarquee() {
  const items = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS] // duplicate for seamless loop

  return (
    <div
      style={{
        borderTop: '1px solid rgba(237,232,220,0.05)',
        borderBottom: '1px solid rgba(237,232,220,0.05)',
        background: 'rgba(12,11,8,0.80)',
        padding: '14px 0',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Left fade */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: 80, zIndex: 2,
        background: 'linear-gradient(to right, #080806, transparent)',
        pointerEvents: 'none',
      }} />
      {/* Right fade */}
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0,
        width: 80, zIndex: 2,
        background: 'linear-gradient(to left, #080806, transparent)',
        pointerEvents: 'none',
      }} />

      <div
        className="marquee-track"
        style={{ display: 'flex', gap: 0, whiteSpace: 'nowrap', width: 'max-content' }}
      >
        {items.map((film, i) => (
          <span
            key={i}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 24,
              padding: '0 24px',
            }}
          >
            <span
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: '10px',
                fontWeight: 400,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: i % 7 === 0 ? '#BF8F3C' : '#302E2A',
              }}
            >
              {film}
            </span>
            {/* Separator — diamond */}
            <span
              style={{
                display: 'inline-block',
                width: 3,
                height: 3,
                background: '#1C1B18',
                transform: 'rotate(45deg)',
                flexShrink: 0,
              }}
            />
          </span>
        ))}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   FILM PROGRAMME — The main film list.
   Inspired by cinema programme brochures and siena.film's 
   architectural list view. NOT a grid of cards.
   
   Each row is a programme entry:
   [number] [title]          [director]  [year] [runtime] [badges]
   
   On hover: a thumbnail preview reveals on the right.
   ───────────────────────────────────────────────────────────── */

export interface FilmEntry {
  id: string | number
  number: string
  title: string
  originalTitle?: string
  director: string
  year: string
  country: string
  runtime: string
  qualities: string[]
  posterSrc: string
  genre?: string
}

interface FilmProgrammeProps {
  title: string
  subtitle?: string
  films: FilmEntry[]
}

function QualityDots({ qualities }: { qualities: string[] }) {
  const colorMap: Record<string, string> = {
    '4K': '#BF8F3C', 'REMUX': '#5E8872', 'HDR': '#9E6858',
    'ATMOS': '#7E6E9A', 'IMAX': '#5E8888', 'WEB-DL': '#607898', 'DV': '#607898',
  }
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {qualities.slice(0, 3).map(q => (
        <span
          key={q}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '1px 6px',
            border: `1px solid ${colorMap[q] || '#302E2A'}33`,
            background: `${colorMap[q] || '#302E2A'}0D`,
            fontFamily: "'DM Mono', monospace",
            fontSize: '8.5px',
            fontWeight: 400,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: colorMap[q] || '#302E2A',
            borderRadius: 1,
          }}
        >
          {q}
        </span>
      ))}
    </div>
  )
}

function FilmRow({ film, index }: { film: FilmEntry; index: number }) {
  const [hovered, setHovered] = useState(false)
  const [imagePos, setImagePos] = useState({ x: 0, y: 0 })

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setImagePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
  }

  return (
    <Link
      href={`/movie/${film.id}`}
      data-tv-focusable
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseMove={handleMouseMove}
      style={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: '52px 1fr 200px 64px 64px 120px',
        alignItems: 'center',
        gap: 0,
        padding: '18px 0',
        borderBottom: '1px solid rgba(237,232,220,0.04)',
        textDecoration: 'none',
        cursor: 'pointer',
        background: hovered ? 'rgba(237,232,220,0.018)' : 'transparent',
        transition: 'background 0.3s',
      }}
    >
      {/* Index number */}
      <span
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: '10px',
          letterSpacing: '0.08em',
          color: hovered ? '#BF8F3C' : '#1C1B18',
          transition: 'color 0.3s',
          userSelect: 'none',
          paddingRight: 16,
          textAlign: 'right',
        }}
      >
        {film.number}
      </span>

      {/* Title */}
      <div style={{ padding: '0 16px 0 0' }}>
        <div
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: '1.18rem',
            fontWeight: 400,
            color: hovered ? '#EDE8DC' : '#B4AFA4',
            lineHeight: 1.2,
            letterSpacing: '-0.01em',
            transition: 'color 0.3s',
            marginBottom: film.originalTitle ? 2 : 0,
          }}
        >
          {film.title}
        </div>
        {film.originalTitle && film.originalTitle !== film.title && (
          <div
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: '9px',
              letterSpacing: '0.1em',
              color: '#302E2A',
              textTransform: 'uppercase',
            }}
          >
            {film.originalTitle}
          </div>
        )}
      </div>

      {/* Director */}
      <span
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: '10px',
          letterSpacing: '0.12em',
          color: hovered ? '#8C8880' : '#565450',
          textTransform: 'uppercase',
          transition: 'color 0.3s',
          textAlign: 'left',
        }}
      >
        {film.director}
      </span>

      {/* Year */}
      <span
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: '10px',
          letterSpacing: '0.10em',
          color: '#302E2A',
          textAlign: 'center',
        }}
      >
        {film.year}
      </span>

      {/* Runtime */}
      <span
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: '10px',
          letterSpacing: '0.08em',
          color: '#302E2A',
          textAlign: 'center',
        }}
      >
        {film.runtime}
      </span>

      {/* Quality indicators */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <QualityDots qualities={film.qualities} />
      </div>

      {/* Hover: floating poster thumbnail */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.30, 1] }}
            style={{
              position: 'fixed',
              top: imagePos.y - 140,
              left: 'calc(52px + 120px + 24px)', // always on the left side
              width: 100,
              height: 150,
              zIndex: 999,
              pointerEvents: 'none',
              boxShadow: '0 24px 60px rgba(4,4,2,0.8)',
              overflow: 'hidden',
              borderRadius: 1,
            }}
          >
            <img
              src={film.posterSrc}
              alt=""
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                filter: 'saturate(0.80)',
                display: 'block',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </Link>
  )
}

export function FilmProgramme({ title, subtitle, films }: FilmProgrammeProps) {
  return (
    <section style={{ padding: '80px 72px' }}>

      {/* Section header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          marginBottom: 48,
          paddingBottom: 28,
          borderBottom: '1px solid rgba(237,232,220,0.05)',
        }}
      >
        <div>
          {subtitle && (
            <div className="label-gold" style={{ marginBottom: 10 }}>{subtitle}</div>
          )}
          <h2
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 'clamp(2rem, 3vw, 2.8rem)',
              fontWeight: 400,
              color: '#EDE8DC',
              lineHeight: 1,
              letterSpacing: '-0.01em',
            }}
          >
            {title}
          </h2>
        </div>
        <Link
          href="/library"
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: '10px',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: '#565450',
            textDecoration: 'none',
            borderBottom: '1px solid rgba(237,232,220,0.08)',
            paddingBottom: 2,
            transition: 'color 0.2s, border-color 0.2s',
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLElement
            el.style.color = '#BF8F3C'
            el.style.borderColor = 'rgba(191,143,60,0.3)'
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLElement
            el.style.color = '#565450'
            el.style.borderColor = 'rgba(237,232,220,0.08)'
          }}
        >
          Arquivo completo →
        </Link>
      </div>

      {/* Column headers */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '52px 1fr 200px 64px 64px 120px',
          gap: 0,
          padding: '0 0 16px',
          marginBottom: 4,
        }}
      >
        {['#', 'Título', 'Realizador', 'Ano', 'Dur.', 'Qualidade'].map((h) => (
          <span
            key={h}
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: '9px',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: '#1C1B18',
              textAlign: h === '#' ? 'right' : h === 'Qualidade' ? 'right' : h === 'Ano' || h === 'Dur.' ? 'center' : 'left',
              paddingRight: h === '#' ? 16 : 0,
            }}
          >
            {h}
          </span>
        ))}
      </div>

      {/* Films */}
      <div>
        {films.map((film, i) => (
          <motion.div
            key={film.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.5, ease: [0.16, 1, 0.30, 1] }}
          >
            <FilmRow film={film} index={i} />
          </motion.div>
        ))}
      </div>
    </section>
  )
}