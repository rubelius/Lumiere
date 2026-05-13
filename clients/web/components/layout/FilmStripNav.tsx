'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

/* ─────────────────────────────────────────────────────────────
   NAVIGATION CONCEPT:
   A literal 35mm film strip running down the left edge.
   Perforations on both sides. Section names in the center,
   rotated 90°. The gold hairline on the right edge is the
   defining visual — it reappears throughout the UI as a motif.
   ───────────────────────────────────────────────────────────── */

const NAV_ITEMS = [
  { href: '/',           label: 'Index',    code: '01', abbr: 'IDX' },
  { href: '/library',   label: 'Archive',   code: '02', abbr: 'ARC' },
  { href: '/session',   label: 'Screening', code: '03', abbr: 'SCR' },
  { href: '/party',     label: 'Party',     code: '04', abbr: 'PTY' },
  { href: '/profile',   label: 'Profile',   code: '05', abbr: 'PRF' },
  { href: '/settings',  label: 'Settings',  code: '06', abbr: 'SET' },
]

// Film strip perforation squares
function Perforations({ count = 8 }: { count?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 0' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 9,
            height: 7,
            border: '1px solid rgba(237,232,220,0.06)',
            borderRadius: 1,
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  )
}

export function FilmStripNav() {
  const pathname = usePathname()
  const [expanded, setExpanded] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null

  const STRIP_W = 52     // collapsed
  const EXPAND_W = 216   // expanded

  return (
    <>
      {/* Film strip — fixed left */}
      <motion.nav
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        animate={{ width: expanded ? EXPAND_W : STRIP_W }}
        transition={{ duration: 0.45, ease: [0.25, 0.10, 0.10, 1.00] }}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 100,
          overflow: 'hidden',
          background: 'rgba(8,8,6,0.97)',
          backdropFilter: 'blur(20px)',
          display: 'flex',
          flexDirection: 'column',
        }}
        aria-label="Navigation principale"
      >
        {/* Gold hairline — right edge */}
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: 1,
            background: `linear-gradient(
              to bottom,
              transparent 0%,
              rgba(191,143,60,0.08) 10%,
              rgba(191,143,60,0.22) 30%,
              rgba(191,143,60,0.28) 50%,
              rgba(191,143,60,0.22) 70%,
              rgba(191,143,60,0.08) 90%,
              transparent 100%
            )`,
            pointerEvents: 'none',
          }}
        />

        {/* Brand mark */}
        <div
          style={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 14,
            gap: 14,
            flexShrink: 0,
            borderBottom: '1px solid rgba(237,232,220,0.05)',
          }}
        >
          {/* L lettermark */}
          <div
            style={{
              width: 24,
              height: 24,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg viewBox="0 0 20 20" fill="none" style={{ width: 18, height: 18 }}>
              <rect x="3" y="2" width="2.5" height="16" fill="#BF8F3C" />
              <rect x="3" y="15.5" width="11" height="2.5" fill="#BF8F3C" />
            </svg>
          </div>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}
              >
                <span
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: '1.15rem',
                    fontWeight: 500,
                    letterSpacing: '0.10em',
                    color: '#EDE8DC',
                  }}
                >
                  LUMIÈRE
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Top perforations */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '12px 0 8px',
            flexShrink: 0,
            borderBottom: '1px solid rgba(237,232,220,0.04)',
          }}
        >
          <Perforations count={4} />
        </div>

        {/* Navigation links */}
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 2,
            padding: '8px 8px',
          }}
        >
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                data-tv-focusable
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  height: 38,
                  gap: 12,
                  padding: '0 6px',
                  position: 'relative',
                  background: active ? 'rgba(191,143,60,0.06)' : 'transparent',
                  transition: 'background 0.25s',
                  textDecoration: 'none',
                  cursor: 'pointer',
                  borderRadius: 1,
                }}
                onMouseEnter={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(237,232,220,0.03)'
                }}
                onMouseLeave={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'
                }}
              >
                {/* Active bar */}
                {active && (
                  <motion.div
                    layoutId="active-bar"
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 4,
                      bottom: 4,
                      width: 2,
                      background: '#BF8F3C',
                      borderRadius: 1,
                    }}
                  />
                )}

                {/* Code */}
                <span
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: '9px',
                    letterSpacing: '0.08em',
                    color: active ? '#BF8F3C' : '#302E2A',
                    flexShrink: 0,
                    width: 16,
                    textAlign: 'right',
                    transition: 'color 0.25s',
                    userSelect: 'none',
                  }}
                >
                  {item.code}
                </span>

                {/* Collapsed: abbr rotated. Expanded: full label */}
                <div
                  style={{
                    flex: 1,
                    overflow: 'hidden',
                    position: 'relative',
                    height: 38,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <AnimatePresence mode="wait">
                    {expanded ? (
                      <motion.span
                        key="full"
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        transition={{ duration: 0.18 }}
                        style={{
                          position: 'absolute',
                          fontFamily: "'DM Mono', monospace",
                          fontSize: '10px',
                          fontWeight: 400,
                          letterSpacing: '0.16em',
                          textTransform: 'uppercase',
                          color: active ? '#EDE8DC' : '#565450',
                          whiteSpace: 'nowrap',
                          transition: 'color 0.25s',
                        }}
                      >
                        {item.label}
                      </motion.span>
                    ) : (
                      <motion.span
                        key="abbr"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        style={{
                          position: 'absolute',
                          fontFamily: "'DM Mono', monospace",
                          fontSize: '8px',
                          letterSpacing: '0.06em',
                          color: active ? '#BF8F3C' : '#302E2A',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.abbr}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </Link>
            )
          })}
        </div>

        {/* Bottom perforations */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '8px 0 12px',
            flexShrink: 0,
            borderTop: '1px solid rgba(237,232,220,0.04)',
          }}
        >
          <Perforations count={4} />
        </div>

        {/* Footer stamp */}
        <div
          style={{
            height: 48,
            borderTop: '1px solid rgba(237,232,220,0.05)',
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 14,
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#BF8F3C',
              opacity: 0.6,
              flexShrink: 0,
            }}
          />
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: '9px',
                  letterSpacing: '0.12em',
                  color: '#302E2A',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                }}
              >
                Personal Cinema · v1.0
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.nav>

      {/* Spacer for layout */}
      <div style={{ width: STRIP_W, flexShrink: 0 }} aria-hidden="true" />
    </>
  )
}