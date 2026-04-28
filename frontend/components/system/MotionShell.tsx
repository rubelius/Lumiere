'use client'

import { useState, useEffect, useRef, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

// Route depth for direction detection
const DEPTH: Record<string, number> = {
  '/': 0, '/library': 1, '/session': 2,
  '/party': 2, '/profile': 1, '/settings': 1,
}

const getVariants = (dir: string) => {
  if (dir === 'forward')  return { i: { opacity: 0, x: 40, filter: 'blur(4px)' },  a: { opacity: 1, x: 0, filter: 'blur(0px)' }, e: { opacity: 0, x: -28, filter: 'blur(2px)' } }
  if (dir === 'backward') return { i: { opacity: 0, x: -40, filter: 'blur(4px)' }, a: { opacity: 1, x: 0, filter: 'blur(0px)' }, e: { opacity: 0, x: 28,  filter: 'blur(2px)' } }
  return { i: { opacity: 0, y: 20, filter: 'blur(3px)' }, a: { opacity: 1, y: 0, filter: 'blur(0px)' }, e: { opacity: 0, y: -12, filter: 'blur(2px)' } }
}

// ── Nav strip ──────────────────────────────────────────────────────────────────
const NAV = [
  { href: '/',          code: '01', label: 'Index',    abbr: 'IDX' },
  { href: '/library',   code: '02', label: 'Archive',  abbr: 'ARC' },
  { href: '/session',   code: '03', label: 'Screen',   abbr: 'SCR' },
  { href: '/party',     code: '04', label: 'Party',    abbr: 'PTY' },
  { href: '/profile',   code: '05', label: 'Profile',  abbr: 'PRF' },
  { href: '/settings',  code: '06', label: 'Settings', abbr: 'SET' },
]

function NavStrip({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false)

  return (
    <motion.nav
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      animate={{ width: open ? 196 : 35 }}
      transition={{ duration: 0.38, ease: [0.25, 0.10, 0.10, 1] }}
      style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100,
        overflow: 'hidden', flexShrink: 0, display: 'flex',
        flexDirection: 'column', background: 'rgba(6,6,4,0.97)',
        backdropFilter: 'blur(20px)',
      }}
      aria-label="Navigation"
    >
      {/* Gold accent line */}
      <motion.div
        animate={{ opacity: [0.2, 0.38, 0.2] }}
        transition={{ duration: 5, repeat: Infinity }}
        style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: 1,
          background: 'linear-gradient(to bottom, transparent 0%, #BF8F3C33 20%, #BF8F3C55 50%, #BF8F3C33 80%, transparent 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Brand */}
      <div style={{ height: 54, display: 'flex', alignItems: 'center', paddingLeft: 14, gap: 12, flexShrink: 0, borderBottom: '1px solid rgba(237,232,220,0.05)' }}>
        <svg viewBox="0 0 20 20" fill="none" style={{ width: 15, height: 15, flexShrink: 0 }}>
          <rect x="3" y="2" width="2.2" height="16" fill="#BF8F3C" />
          <rect x="3" y="15.8" width="9.5" height="2.2" fill="#BF8F3C" />
        </svg>
        <AnimatePresence>
          {open && (
            <motion.span
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.05rem', fontWeight: 500, letterSpacing: '0.10em', color: '#EDE8DC', whiteSpace: 'nowrap' }}
            >
              LUMIÈRE
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Perforations */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '9px 0', borderBottom: '1px solid rgba(237,232,220,0.04)', flexShrink: 0 }}>
        {[0,1,2,3].map(i => <div key={i} style={{ width: 8, height: 6, border: '1px solid rgba(237,232,220,0.07)', borderRadius: 1 }} />)}
      </div>

      {/* Links */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 1, padding: '6px' }}>
        {NAV.map(item => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                position: 'relative', display: 'flex', alignItems: 'center',
                height: 36, gap: 9, padding: '0 5px', textDecoration: 'none',
                background: active ? 'rgba(191,143,60,0.06)' : 'transparent',
                borderRadius: 1, transition: 'background 0.22s',
                overflow: 'hidden',
              }}
            >
              {active && (
                <motion.div
                  layoutId="nav-bar"
                  style={{ position: 'absolute', left: 0, top: 4, bottom: 4, width: 2, background: '#BF8F3C', borderRadius: 1 }}
                  transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                />
              )}
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '8.5px', letterSpacing: '0.08em', color: active ? '#BF8F3C' : '#1C1B18', width: 15, textAlign: 'right', flexShrink: 0, zIndex: 1, transition: 'color 0.22s' }}>
                {item.code}
              </span>
              <AnimatePresence mode="wait">
                {open ? (
                  <motion.span key="full" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}
                    style={{ fontFamily: "'DM Mono', monospace", fontSize: '9.5px', letterSpacing: '0.15em', textTransform: 'uppercase', color: active ? '#EDE8DC' : '#3A3836', whiteSpace: 'nowrap', zIndex: 1, transition: 'color 0.22s' }}>
                    {item.label}
                  </motion.span>
                ) : (
                  <motion.span key="abbr" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.13 }}
                    style={{ fontFamily: "'DM Mono', monospace", fontSize: '7.5px', letterSpacing: '0.06em', color: active ? '#7A5A20' : '#1C1B18', zIndex: 1 }}>
                    {item.abbr}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          )
        })}
      </div>

      {/* Bottom perfs */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '9px 0', borderTop: '1px solid rgba(237,232,220,0.04)', flexShrink: 0 }}>
        {[0,1,2,3].map(i => <div key={i} style={{ width: 8, height: 6, border: '1px solid rgba(237,232,220,0.07)', borderRadius: 1 }} />)}
      </div>

      {/* Footer dot */}
      <div style={{ height: 42, borderTop: '1px solid rgba(237,232,220,0.05)', display: 'flex', alignItems: 'center', paddingLeft: 14, gap: 10, flexShrink: 0 }}>
        <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 3, repeat: Infinity }}
          style={{ width: 5, height: 5, borderRadius: '50%', background: '#BF8F3C', flexShrink: 0 }} />
        <AnimatePresence>
          {open && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#2A2826', whiteSpace: 'nowrap' }}>
              Personal Cinema · v1
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </motion.nav>
  )
}

// ── Ambient grain canvas ────────────────────────────────────────────────────
function GrainCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)
  const frame = useRef(0)
  const t = useRef(0)

  useEffect(() => {
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d'); if (!ctx) return
    const resize = () => { c.width = window.innerWidth; c.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)
    const draw = () => {
      const { width, height } = c
      const img = ctx.createImageData(width, height)
      const d = img.data
      const op = 6 + Math.sin(t.current * 1.1) * 2 + Math.sin(t.current * 2.2) * 1.2
      for (let i = 0; i < d.length; i += 4) {
        const n = Math.random() * 255
        d[i] = n; d[i+1] = n; d[i+2] = Math.round(n * 0.94); d[i+3] = op
      }
      ctx.putImageData(img, 0, 0)
      t.current += 0.016
      frame.current = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(frame.current); window.removeEventListener('resize', resize) }
  }, [])

  return (
    <canvas ref={ref} aria-hidden="true"
      style={{ position: 'fixed', inset: 0, zIndex: 2, width: '100%', height: '100%', pointerEvents: 'none', mixBlendMode: 'overlay' }}
    />
  )
}

// ── THE SHELL ──────────────────────────────────────────────────────────────────
export function MotionShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [prev, setPrev] = useState(pathname)
  const [dir, setDir] = useState<'forward' | 'backward' | 'neutral'>('neutral')

  useEffect(() => {
    if (pathname === prev) return
    const pd = DEPTH[prev] ?? 1, nd = DEPTH[pathname] ?? 1
    setDir(nd > pd ? 'forward' : nd < pd ? 'backward' : 'neutral')
    setPrev(pathname)
  }, [pathname, prev])

  const v = getVariants(dir)
  const ease = [0.16, 1, 0.30, 1] as const

  return (
    <div style={{ background: '#080806', color: '#EDE8DC', minHeight: '100dvh', display: 'flex' }}>
      {/* Layer 0: breathing warm bloom */}
      <motion.div aria-hidden="true"
        animate={{ opacity: [0.03, 0.06, 0.03] }}
        transition={{ duration: 12, repeat: Infinity }}
        style={{
          position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 55% 50% at 50% 50%, #BF8F3C 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
      {/* Layer 1: scanlines */}
      <div aria-hidden="true" style={{
        position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none',
        backgroundImage: 'repeating-linear-gradient(0deg, rgba(4,4,2,0.04) 0px, rgba(4,4,2,0.04) 1px, transparent 1px, transparent 4px)',
      }} />
      {/* Layer 2: grain */}
      <GrainCanvas />
      {/* Layer 3: nav */}
      <div style={{ position: 'relative', zIndex: 10, flexShrink: 0 }}>
        <NavStrip pathname={pathname} />
      </div>
      {/* Layer 4: page content */}
      <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 5, marginLeft: 52 }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={pathname}
            initial={v.i} animate={v.a} exit={v.e}
            transition={{ duration: 0.62, ease }}
            style={{ minHeight: '100dvh', position: 'relative' }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}