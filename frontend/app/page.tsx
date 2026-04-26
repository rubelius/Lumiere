'use client'

import { FilmStripNav } from '@/components/layout/FilmStripNav'
import { HeroProgramme } from '@/components/home/HeroProgramme'
import { CinemaMarquee, FilmProgramme, FilmEntry } from '@/components/home/FilmProgramme'
import { NowProjecting, AdmitOne, LibraryCount } from '@/components/home/Sections'
import { motion } from 'framer-motion'
import Link from 'next/link'

/* ─────────────────────────────────────────────────────────────
   HOME PAGE
   
   Section sequence (deliberate rhythm):
   
   1. HERO — Full viewport. Dominant. Poster bleeds right.
   2. MARQUEE — Breathing pause. Film titles scroll past.
   3. PROGRAMME — The main list. Archival, editorial. 
   4. NOW PROJECTING — Continue watching. Screen metaphor.
   5. ADMIT ONE — Session ticket. Siena.film tribute.
   6. LIBRARY COUNT — Silence + scale. A single giant number.
   7. FOOTER — Minimal stamp.
   ───────────────────────────────────────────────────────────── */

const FEATURED_FILMS: FilmEntry[] = [
  {
    id: 1, number: '001',
    title: 'L\'Avventura', originalTitle: 'L\'Avventura',
    director: 'Antonioni', year: '1960', country: 'IT',
    runtime: '143m', qualities: ['REMUX', '4K'],
    posterSrc: '/images/posters/lavventura.png', genre: 'Drama',
  },
  {
    id: 2, number: '002',
    title: 'Stalker', originalTitle: 'Сталкер',
    director: 'Tarkovsky', year: '1979', country: 'USSR',
    runtime: '162m', qualities: ['REMUX'],
    posterSrc: '/images/posters/stalker.jpg', genre: 'Sci-Fi',
  },
  {
    id: 3, number: '003',
    title: 'Persona',
    director: 'Bergman', year: '1966', country: 'SE',
    runtime: '85m', qualities: ['REMUX', '4K'],
    posterSrc: '/images/posters/persona.jpg', genre: 'Drama',
  },
  {
    id: 4, number: '004',
    title: 'Barry Lyndon',
    director: 'Kubrick', year: '1975', country: 'UK',
    runtime: '185m', qualities: ['4K', 'HDR'],
    posterSrc: '/images/posters/barry-lyndon.jpg', genre: 'Period Drama',
  },
  {
    id: 5, number: '005',
    title: 'Jeanne Dielman', originalTitle: 'Jeanne Dielman, 23, quai du Commerce',
    director: 'Akerman', year: '1975', country: 'BE',
    runtime: '201m', qualities: ['REMUX'],
    posterSrc: '/images/posters/jeanne-dielman.jpg', genre: 'Drama',
  },
  {
    id: 6, number: '006',
    title: 'Mulholland Drive',
    director: 'Lynch', year: '2001', country: 'US',
    runtime: '147m', qualities: ['4K', 'ATMOS'],
    posterSrc: '/images/posters/mulholland.jpg', genre: 'Neo-Noir',
  },
  {
    id: 7, number: '007',
    title: 'Au Hasard Balthazar',
    director: 'Bresson', year: '1966', country: 'FR',
    runtime: '95m', qualities: ['REMUX'],
    posterSrc: '/images/posters/balthazar.jpg', genre: 'Drama',
  },
]

/* Weekly sessions preview */
const UPCOMING_SESSIONS = [
  { number: 'S·001', title: 'Noite Tarkovsky',        films: 2, duration: '5h 20m', date: 'Sáb · 20:00' },
  { number: 'S·002', title: 'Clássicos do Noir',       films: 3, duration: '6h 45m', date: 'Dom · 19:00' },
  { number: 'S·003', title: 'A Trilogia da Solidão',   films: 3, duration: '7h 10m', date: 'Sex · 21:00' },
]

export default function HomePage() {
  return (
    <div
      style={{
        background: '#080806',
        color: '#EDE8DC',
        minHeight: '100dvh',
        display: 'flex',
      }}
    >
      {/* Film strip nav — fixed left */}
      <FilmStripNav />

      {/* Main content */}
      <main
        style={{
          flex: 1,
          minWidth: 0,
          marginLeft: 52, // film strip width
        }}
      >
        {/* ── 1. HERO ───────────────────────────────────── */}
        <HeroProgramme
          programmeNumber="001"
          title="2001"
          subtitle="Uma Odisseia no Espaço"
          director="Stanley Kubrick"
          year="1968"
          country="UK / US"
          runtime="149m"
          synopsis="Uma jornada do ser humano primitivo ao limiar da transcendência, mediada por monólitos silenciosos e uma inteligência artificial que aprendeu a temer a morte."
          qualities={['4K', 'REMUX', 'ATMOS']}
          backdropSrc="/images/backdrops/2001.jpg"
          posterSrc="/images/posters/2001.jpg"
          href="/player"
        />

        {/* ── 2. MARQUEE ────────────────────────────────── */}
        <CinemaMarquee />

        {/* ── 3. PROGRAMME ──────────────────────────────── */}
        <FilmProgramme
          subtitle="Curadoria desta semana"
          title="Programme de la Semaine"
          films={FEATURED_FILMS}
        />

        {/* ── 4. NOW PROJECTING ─────────────────────────── */}
        <NowProjecting
          title="Stalker"
          director="Andrei Tarkovsky"
          year="1979"
          progress={34}
          remainingTime="1h 47m"
          frameSrc="/images/backdrops/stalker.jpg"
          href="/player"
        />

        {/* ── 5. SESSIONS ───────────────────────────────── */}
        <section style={{ padding: '72px 72px 0' }}>

          {/* Section header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              marginBottom: 32,
              paddingBottom: 24,
              borderBottom: '1px solid rgba(237,232,220,0.05)',
            }}
          >
            <div>
              <div className="label-gold" style={{ marginBottom: 10 }}>Sessões programadas</div>
              <h2
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: '2.4rem',
                  fontWeight: 400,
                  color: '#EDE8DC',
                  lineHeight: 1,
                  letterSpacing: '-0.01em',
                }}
              >
                Próximas Projeções
              </h2>
            </div>
            <Link href="/session" style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: '10px',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: '#565450',
              textDecoration: 'none',
              borderBottom: '1px solid rgba(237,232,220,0.07)',
              paddingBottom: 2,
            }}>
              Ver todas →
            </Link>
          </div>

          {/* Session rows — not cards, a programme list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 40 }}>
            {UPCOMING_SESSIONS.map((s, i) => (
              <motion.div
                key={s.number}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.08, duration: 0.6 }}
              >
                <Link
                  href="/session"
                  data-tv-focusable
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '20px 0',
                    borderBottom: '1px solid rgba(237,232,220,0.04)',
                    textDecoration: 'none',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(237,232,220,0.015)'
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'transparent'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                    <span style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: '9px',
                      letterSpacing: '0.1em',
                      color: '#1C1B18',
                      width: 44,
                    }}>
                      {s.number}
                    </span>
                    <div
                      style={{
                        width: 1,
                        height: 32,
                        background: 'rgba(237,232,220,0.05)',
                        flexShrink: 0,
                      }}
                    />
                    <div>
                      <div
                        style={{
                          fontFamily: "'Cormorant Garamond', serif",
                          fontSize: '1.3rem',
                          fontWeight: 400,
                          color: '#C4BEB4',
                          lineHeight: 1.2,
                          marginBottom: 3,
                        }}
                      >
                        {s.title}
                      </div>
                      <div className="label" style={{ color: '#302E2A' }}>
                        {s.films} filmes · {s.duration}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                    <span className="label-gold">{s.date}</span>
                    <div style={{ color: '#302E2A' }}>
                      <svg viewBox="0 0 16 16" fill="none" style={{ width: 12, height: 12 }}>
                        <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                      </svg>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── 6. ADMIT ONE ──────────────────────────────── */}
        <AdmitOne
          sessionTitle="Noite Tarkovsky"
          filmCount={2}
          totalDuration="5h 20m"
          date="Sáb · 16 Ago · 20:00"
          sessionNumber="001"
          href="/session"
        />

        {/* ── 7. LIBRARY COUNT ──────────────────────────── */}
        <LibraryCount count={128} />

        {/* ── FOOTER ────────────────────────────────────── */}
        <footer
          style={{
            padding: '20px 72px',
            borderTop: '1px solid rgba(237,232,220,0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: '9px',
            letterSpacing: '0.12em',
            color: '#1C1B18',
            textTransform: 'uppercase',
          }}>
            © 2026 Lumière
          </span>
          <span style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: '9px',
            letterSpacing: '0.12em',
            color: '#1C1B18',
            textTransform: 'uppercase',
          }}>
            Personal Cinema Platform
          </span>
        </footer>
      </main>
    </div>
  )
}