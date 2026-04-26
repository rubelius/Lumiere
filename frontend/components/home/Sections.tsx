'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'

/* ─────────────────────────────────────────────────────────────
   NOW PROJECTING — Continue watching.
   Not a "card grid". A cinema screen metaphor:
   - The film appears PROJECTED on a surface
   - The still frame is desaturated, with a warm glow center
   - Progress is shown as a film strip with filled frames
   ───────────────────────────────────────────────────────────── */

interface NowProjectingProps {
  title: string
  director: string
  year: string
  progress: number        // 0-100
  remainingTime: string
  frameSrc: string
  href: string
}

export function NowProjecting({
  title, director, year, progress, remainingTime, frameSrc, href
}: NowProjectingProps) {
  const totalDots = 20
  const filledDots = Math.round((progress / 100) * totalDots)

  return (
    <section
      style={{
        background: '#0C0B08',
        borderTop: '1px solid rgba(237,232,220,0.05)',
        borderBottom: '1px solid rgba(237,232,220,0.05)',
        padding: '64px 72px',
      }}
    >
      <div className="label-gold" style={{ marginBottom: 32 }}>
        — Em Projeção
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 380px',
          gap: 48,
          alignItems: 'center',
        }}
      >
        {/* Left: Screen simulation */}
        <div style={{ position: 'relative' }}>

          {/* Film frame indicator — top */}
          <div
            style={{
              display: 'flex',
              gap: 2,
              marginBottom: 8,
              paddingLeft: 2,
            }}
          >
            {Array.from({ length: totalDots }).map((_, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: 2,
                  background: i < filledDots
                    ? '#BF8F3C'
                    : i === filledDots
                    ? 'rgba(191,143,60,0.4)'
                    : 'rgba(237,232,220,0.06)',
                  borderRadius: 1,
                }}
              />
            ))}
          </div>

          {/* Screen */}
          <div
            style={{
              position: 'relative',
              overflow: 'hidden',
              aspectRatio: '2.39/1',
              background: '#040402',
            }}
          >
            <img
              src={frameSrc}
              alt={title}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
                filter: 'saturate(0.55) brightness(0.65) contrast(1.10)',
              }}
            />

            {/* Projector light simulation — radial warm center */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'radial-gradient(ellipse 70% 70% at 50% 50%, rgba(191,143,60,0.04) 0%, transparent 70%)',
              pointerEvents: 'none',
            }} />

            {/* Scan line — subtle */}
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: 'repeating-linear-gradient(0deg, rgba(4,4,2,0.06) 0px, rgba(4,4,2,0.06) 1px, transparent 1px, transparent 3px)',
              pointerEvents: 'none',
            }} />

            {/* Vignette */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'radial-gradient(ellipse 90% 90% at 50% 50%, transparent 40%, rgba(4,4,2,0.7) 100%)',
              pointerEvents: 'none',
            }} />

            {/* Progress % */}
            <div
              style={{
                position: 'absolute',
                bottom: 12,
                right: 12,
                fontFamily: "'DM Mono', monospace",
                fontSize: '9px',
                letterSpacing: '0.1em',
                color: 'rgba(237,232,220,0.5)',
                background: 'rgba(4,4,2,0.7)',
                padding: '3px 8px',
                borderRadius: 1,
              }}
            >
              {progress}%
            </div>
          </div>

          {/* Film frame indicator — bottom (continuation) */}
          <div style={{
            height: 3,
            background: '#040402',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingTop: 4,
          }}>
            <span style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: '8px',
              letterSpacing: '0.1em',
              color: '#1C1B18',
            }}>
              Frame {Math.round((progress / 100) * 168000)} / 168000
            </span>
          </div>
        </div>

        {/* Right: Film info */}
        <div>
          <div className="label" style={{ marginBottom: 16, color: '#302E2A' }}>
            {director} · {year}
          </div>

          <h3
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: '2.4rem',
              fontWeight: 400,
              color: '#EDE8DC',
              lineHeight: 1.05,
              marginBottom: 32,
              letterSpacing: '-0.01em',
            }}
          >
            {title}
          </h3>

          {/* Progress bar text */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <span className="label" style={{ color: '#565450' }}>Tempo restante</span>
            <span className="label-gold">{remainingTime}</span>
          </div>

          {/* Progress track */}
          <div
            style={{
              height: 2,
              background: 'rgba(237,232,220,0.05)',
              marginBottom: 36,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <motion.div
              initial={{ width: '0%' }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1.2, delay: 0.5, ease: [0.16, 1, 0.30, 1] }}
              style={{
                position: 'absolute',
                top: 0, left: 0,
                height: '100%',
                background: '#BF8F3C',
              }}
            />
          </div>

          {/* CTA */}
          <Link
            href={href}
            data-tv-focusable
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              height: 44,
              padding: '0 24px',
              background: 'transparent',
              border: '1px solid rgba(237,232,220,0.10)',
              color: '#8C8880',
              fontFamily: "'DM Mono', monospace",
              fontSize: '10px',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              borderRadius: 1,
              textDecoration: 'none',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement
              el.style.borderColor = 'rgba(191,143,60,0.35)'
              el.style.color = '#BF8F3C'
              el.style.background = 'rgba(191,143,60,0.05)'
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement
              el.style.borderColor = 'rgba(237,232,220,0.10)'
              el.style.color = '#8C8880'
              el.style.background = 'transparent'
            }}
          >
            <svg viewBox="0 0 12 12" fill="currentColor" style={{ width: 9, height: 9 }}>
              <path d="M2 1.5L10 6L2 10.5V1.5Z" />
            </svg>
            Retomar
          </Link>
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────
   ADMIT ONE — Session ticket.
   Directly inspired by siena.film's "ADMIT ONE 004" stamp.
   A ticket stub aesthetic: perforated edges, bold stamp type,
   numbered serial, used as the sessions entry point.
   ───────────────────────────────────────────────────────────── */

interface AdmitOneProps {
  sessionTitle: string
  filmCount: number
  totalDuration: string
  date: string
  sessionNumber: string
  href: string
}

export function AdmitOne({
  sessionTitle, filmCount, totalDuration, date, sessionNumber, href
}: AdmitOneProps) {
  return (
    <section style={{ padding: '0 72px 80px' }}>

      <Link
        href={href}
        data-tv-focusable
        style={{
          display: 'block',
          textDecoration: 'none',
          border: '1px solid rgba(237,232,220,0.07)',
          background: '#0C0B08',
          position: 'relative',
          overflow: 'hidden',
          cursor: 'pointer',
          transition: 'border-color 0.3s',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(191,143,60,0.20)'
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(237,232,220,0.07)'
        }}
      >
        {/* Ticket layout: 3 columns */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '56px 1fr 180px',
            minHeight: 140,
          }}
        >
          {/* Left perforation strip */}
          <div
            style={{
              borderRight: '1px dashed rgba(237,232,220,0.06)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '16px 0',
            }}
          >
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: 10,
                  height: 8,
                  border: '1px solid rgba(237,232,220,0.06)',
                  borderRadius: 1,
                }}
              />
            ))}
          </div>

          {/* Main content */}
          <div
            style={{
              padding: '32px 40px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div className="label" style={{ color: '#302E2A', marginBottom: 12 }}>
              Lumière Personal Cinema · Sessão Programada
            </div>

            {/* ADMIT ONE — the stamp */}
            <div>
              <div
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: 'clamp(2rem, 4vw, 3.5rem)',
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  color: '#EDE8DC',
                  lineHeight: 1,
                  marginBottom: 4,
                }}
              >
                ADMIT ONE
              </div>
              <div
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: '1.4rem',
                  fontWeight: 300,
                  fontStyle: 'italic',
                  color: '#BF8F3C',
                  lineHeight: 1,
                }}
              >
                {sessionTitle}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                gap: 24,
                alignItems: 'center',
              }}
            >
              <span className="label" style={{ color: '#565450' }}>{filmCount} filmes</span>
              <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#1C1B18', display: 'block' }} />
              <span className="label" style={{ color: '#565450' }}>{totalDuration}</span>
              <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#1C1B18', display: 'block' }} />
              <span className="label-gold">{date}</span>
            </div>
          </div>

          {/* Right stub: number + CTA */}
          <div
            style={{
              borderLeft: '1px dashed rgba(237,232,220,0.06)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              padding: '24px 16px',
            }}
          >
            <div
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: '2.5rem',
                fontWeight: 700,
                color: 'rgba(237,232,220,0.06)',
                lineHeight: 1,
                letterSpacing: '-0.02em',
              }}
            >
              {sessionNumber}
            </div>
            <div
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: '9px',
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: '#302E2A',
                textAlign: 'center',
              }}
            >
              Ver Sessão
            </div>
            <svg viewBox="0 0 16 16" fill="none" style={{ width: 14, height: 14, color: '#302E2A' }}>
              <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
            </svg>
          </div>
        </div>
      </Link>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────
   LIBRARY COUNT — Full-bleed typographic statement.
   Inspired by how design studios use a single giant number
   to anchor a section. Creates "silence" and scale contrast.
   ───────────────────────────────────────────────────────────── */

export function LibraryCount({ count }: { count: number }) {
  return (
    <section
      style={{
        padding: '64px 72px',
        borderTop: '1px solid rgba(237,232,220,0.05)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 48,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Giant ghost number */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          right: 72,
          top: '50%',
          transform: 'translateY(-50%)',
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 'clamp(8rem, 18vw, 18rem)',
          fontWeight: 700,
          lineHeight: 1,
          color: 'rgba(237,232,220,0.025)',
          letterSpacing: '-0.05em',
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      >
        {count}
      </div>

      {/* Text */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div className="label-gold" style={{ marginBottom: 16 }}>Arquivo Pessoal</div>
        <div
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 'clamp(1.8rem, 3vw, 2.6rem)',
            fontWeight: 400,
            color: '#EDE8DC',
            lineHeight: 1.15,
            marginBottom: 20,
          }}
        >
          {count} títulos curados.<br />
          <span style={{ fontStyle: 'italic', color: '#565450' }}>Cinema de primeira ordem.</span>
        </div>
        <Link
          href="/library"
          data-tv-focusable
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            fontFamily: "'DM Mono', monospace",
            fontSize: '10px',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: '#BF8F3C',
            textDecoration: 'none',
            borderBottom: '1px solid rgba(191,143,60,0.25)',
            paddingBottom: 3,
            transition: 'border-color 0.2s',
          }}
        >
          Explorar arquivo
        </Link>
      </div>
    </section>
  )
}