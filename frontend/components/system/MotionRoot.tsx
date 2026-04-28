'use client'

/**
 * MOTION ROOT
 *
 * This is the RUNTIME of the interface.
 * Every page, every screen, every element lives inside this.
 *
 * It owns:
 * 1. The ambient canvas (always alive)
 * 2. The film strip nav (always present, layoutId transitions)
 * 3. AnimatePresence (catches ALL route changes)
 * 4. The page transition orchestrator
 *
 * Remove this file → the app breaks visually and structurally.
 * That is the test.
 */

import {
  useEffect, useRef, useState, useCallback, createContext, useContext, type ReactNode
} from 'react'
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

// ─── Motion Context ────────────────────────────────────────────────────────────
// Shared state available to ALL child components
interface MotionCtx {
  pathname: string
  prevPathname: string
  direction: 'forward' | 'backward' | 'neutral'
  mouseX: number
  mouseY: number
}

const MotionContext = createContext<MotionCtx>({
  pathname: '/',
  prevPathname: '/',
  direction: 'neutral',
  mouseX: 0,
  mouseY: 0,
})

export const useMotionContext = () => useContext(MotionContext)

// ─── Route order for direction detection ──────────────────────────────────────
const ROUTE_DEPTH: Record<string, number> = {
  '/':          0,
  '/library':   1,
  '/session':   2,
  '/party':     2,
  '/profile':   1,
  '/settings':  1,
}

// ─── Page transition variants keyed by direction ───────────────────────────────
const getTransitionVariants = (direction: string) => {
  if (direction === 'forward') return {
    initial:   { opacity: 0, x: 48, filter: 'blur(4px)' },
    animate:   { opacity: 1, x: 0,  filter: 'blur(0px)' },
    exit:      { opacity: 0, x: -32, filter: 'blur(2px)' },
    transition:{ duration: 0.65, ease: [0.16, 1, 0.30, 1] },
  }
  if (direction === 'backward') return {
    initial:   { opacity: 0, x: -48, filter: 'blur(4px)' },
    animate:   { opacity: 1, x: 0,   filter: 'blur(0px)' },
    exit:      { opacity: 0, x: 32,  filter: 'blur(2px)' },
    transition:{ duration: 0.65, ease: [0.16, 1, 0.30, 1] },
  }
  // Neutral (home enter / settings / etc)
  return {
    initial:   { opacity: 0, y: 24, filter: 'blur(3px)' },
    animate:   { opacity: 1, y: 0,  filter: 'blur(0px)' },
    exit:      { opacity: 0, y: -16, filter: 'blur(2px)' },
    transition:{ duration: 0.75, ease: [0.16, 1, 0.30, 1] },
  }
}

// ─── Navigation items ──────────────────────────────────────────────────────────
const NAV = [
  { href: '/',          code: '01', abbr: 'IDX', label: 'Index'    },
  { href: '/library',   code: '02', abbr: 'ARC', label: 'Archive'  },
  { href: '/session',   code: '03', abbr: 'SCR', label: 'Screen'   },
  { href: '/party',     code: '04', abbr: 'PTY', label: 'Party'    },
  { href: '/profile',   code: '05', abbr: 'PRF', label: 'Profile'  },
  { href: '/settings',  code: '06', abbr: 'SET', label: 'Settings' },
]

// ─── Film strip perforation ────────────────────────────────────────────────────
function Perf() {
  return (
    <div style={{ width: 9, height: 6, border: '1px solid rgba(237,232,220,0.065)', borderRadius: 1, flexShrink: 0 }} />
  )
}

// ─── The Nav Strip ─────────────────────────────────────────────────────────────
function FilmStrip({ pathname }: { pathname: string }) {
  const [hovered, setHovered] = useState(false)

  return (
    <motion.aside
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      animate={{ width: hovered ? 200 : 52 }}
      transition={{ duration: 0.42, ease: [0.25, 0.10, 0.10, 1.00] }}
      style={{
        position: 'fixed', top: 0, left: 0, bottom: 0,
        zIndex: 100, overflow: 'hidden', flexShrink: 0,
        display: 'flex', flexDirection: 'column',
        background: 'rgba(6,6,4,0.97)',
        backdropFilter: 'blur(24px)',
      }}
    >
      {/* Gold hairline — the pulse is structural */}
      <motion.div
        animate={{ opacity: [0.25, 0.45, 0.25] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: 1,
          background: 'linear-gradient(to bottom, transparent 0%, rgba(191,143,60,0.22) 20%, rgba(191,143,60,0.40) 50%, rgba(191,143,60,0.22) 80%, transparent 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Brand */}
      <div style={{ height: 56, display: 'flex', alignItems: 'center', paddingLeft: 14, gap: 12, flexShrink: 0, borderBottom: '1px solid rgba(237,232,220,0.05)' }}>
        <motion.div animate={{ rotate: [0, 0, 0] }} style={{ flexShrink: 0 }}>
          <svg viewBox="0 0 20 20" fill="none" style={{ width: 16, height: 16 }}>
            <rect x="3" y="2" width="2.5" height="16" fill="#BF8F3C" />
            <rect x="3" y="15.5" width="10" height="2.5" fill="#BF8F3C" />
          </svg>
        </motion.div>
        <AnimatePresence>
          {hovered && (
            <motion.span
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.05rem', fontWeight: 500, letterSpacing: '0.10em', color: '#EDE8DC', whiteSpace: 'nowrap' }}
            >
              LUMIÈRE
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Perforations top */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '10px 0', borderBottom: '1px solid rgba(237,232,220,0.04)' }}>
        <Perf /><Perf /><Perf /><Perf />
      </div>

      {/* Nav links */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 1, padding: '8px 6px' }}>
        {NAV.map((item) => {
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                position: 'relative',
                display: 'flex', alignItems: 'center', gap: 10,
                height: 38, padding: '0 5px',
                background: active ? 'rgba(191,143,60,0.06)' : 'transparent',
                textDecoration: 'none',
                borderRadius: 1,
                transition: 'background 0.25s',
                overflow: 'hidden',
              }}
            >
              {/* The shared layoutId active bar — this is the layoutId that morphs */}
              {active && (
                <motion.div
                  layoutId="nav-active-bar"
                  style={{
                    position: 'absolute', left: 0, top: 4, bottom: 4, width: 2,
                    background: '#BF8F3C', borderRadius: 1,
                  }}
                  transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                />
              )}

              {/* The active background glow — also shares layout */}
              {active && (
                <motion.div
                  layoutId="nav-active-bg"
                  style={{
                    position: 'absolute', inset: 0,
                    background: 'rgba(191,143,60,0.06)',
                    borderRadius: 1,
                  }}
                  transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                />
              )}

              <span style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: '8.5px', letterSpacing: '0.08em',
                color: active ? '#BF8F3C' : '#1C1B18',
                width: 16, textAlign: 'right', flexShrink: 0, zIndex: 1,
                transition: 'color 0.25s',
              }}>
                {item.code}
              </span>

              <AnimatePresence>
                {hovered ? (
                  <motion.span
                    key="full"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: '9.5px', letterSpacing: '0.16em', textTransform: 'uppercase',
                      color: active ? '#EDE8DC' : '#565450',
                      whiteSpace: 'nowrap', zIndex: 1,
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
                      fontFamily: "'DM Mono', monospace",
                      fontSize: '7.5px', letterSpacing: '0.06em',
                      color: active ? '#7A5A20' : '#1C1B18',
                      zIndex: 1,
                    }}
                  >
                    {item.abbr}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          )
        })}
      </nav>

      {/* Perforations bottom */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '10px 0', borderTop: '1px solid rgba(237,232,220,0.04)' }}>
        <Perf /><Perf /><Perf /><Perf />
      </div>

      {/* Footer */}
      <div style={{ height: 44, borderTop: '1px solid rgba(237,232,220,0.05)', display: 'flex', alignItems: 'center', paddingLeft: 14, gap: 10 }}>
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 3, repeat: Infinity }}
          style={{ width: 5, height: 5, borderRadius: '50%', background: '#BF8F3C', flexShrink: 0 }}
        />
        <AnimatePresence>
          {hovered && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ fontFamily: "'DM Mono', monospace", fontSize: '8.5px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#2A2826', whiteSpace: 'nowrap' }}
            >
              Personal Cinema · v1.0
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  )
}

// ─── Ambient Canvas ────────────────────────────────────────────────────────────
function AmbientCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<number>(0)
  const timeRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const draw = () => {
      const { width, height } = canvas
      const imageData = ctx.createImageData(width, height)
      const d = imageData.data
      const flicker = 6 + Math.sin(timeRef.current * 1.1) * 2.2 + Math.sin(timeRef.current * 2.3) * 1.1

      for (let i = 0; i < d.length; i += 4) {
        const n = Math.random() * 255
        d[i]     = n
        d[i + 1] = n
        d[i + 2] = Math.round(n * 0.94)
        d[i + 3] = flicker
      }
      ctx.putImageData(imageData, 0, 0)
      timeRef.current += 0.016
      frameRef.current = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(frameRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed', inset: 0, zIndex: 1,
        width: '100%', height: '100%',
        pointerEvents: 'none',
        mixBlendMode: 'overlay',
      }}
      aria-hidden="true"
    />
  )
}

// ─── The breathing background gradient ────────────────────────────────────────
function AmbientGlow() {
  return (
    <motion.div
      aria-hidden="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 0,
        pointerEvents: 'none',
        background: '#080806',
      }}
    >
      {/* Slow-moving warm bloom */}
      <motion.div
        animate={{
          opacity:  [0.035, 0.065, 0.040, 0.070, 0.035],
          x:        [0, 40, -20, 30, 0],
          y:        [0, -20, 30, 10, 0],
          scale:    [1, 1.12, 0.95, 1.08, 1],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute',
          width: '70%', height: '70%',
          top: '15%', left: '15%',
          borderRadius: '50%',
          background: 'radial-gradient(ellipse at center, rgba(191,143,60,1) 0%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />

      {/* Scan lines */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'repeating-linear-gradient(0deg, rgba(4,4,2,0.04) 0px, rgba(4,4,2,0.04) 1px, transparent 1px, transparent 4px)',
        pointerEvents: 'none',
      }} />
    </motion.div>
  )
}

// ─── THE MOTION ROOT ──────────────────────────────────────────────────────────
export function MotionRoot({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [prev, setPrev] = useState(pathname)
  const [direction, setDirection] = useState<'forward' | 'backward' | 'neutral'>('neutral')
  const [mouseX, setMouseX] = useState(0)
  const [mouseY, setMouseY] = useState(0)

  // Track route changes → compute direction
  useEffect(() => {
    if (pathname === prev) return
    const prevDepth = ROUTE_DEPTH[prev] ?? 1
    const nextDepth = ROUTE_DEPTH[pathname] ?? 1
    if (nextDepth > prevDepth) setDirection('forward')
    else if (nextDepth < prevDepth) setDirection('backward')
    else setDirection('neutral')
    setPrev(pathname)
  }, [pathname, prev])

  // Global mouse tracker for ambient effects
  useEffect(() => {
    const h = (e: MouseEvent) => { setMouseX(e.clientX); setMouseY(e.clientY) }
    window.addEventListener('mousemove', h, { passive: true })
    return () => window.removeEventListener('mousemove', h)
  }, [])

  const variants = getTransitionVariants(direction)

  return (
    <MotionContext.Provider value={{ pathname, prevPathname: prev, direction, mouseX, mouseY }}>
      {/* Layer 0: The breathing void */}
      <AmbientGlow />

      {/* Layer 1: Film grain — always alive */}
      <AmbientCanvas />

      {/* Layer 2: Navigation — fixed, persistent */}
      <FilmStrip pathname={pathname} />

      {/* Layer 3: Page content — animated on every route change */}
      <div style={{ position: 'relative', zIndex: 5, marginLeft: 52 }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={pathname}
            initial={variants.initial}
            animate={variants.animate}
            exit={variants.exit}
            transition={variants.transition as any}
            style={{ minHeight: '100dvh', position: 'relative' }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </MotionContext.Provider>
  )
}