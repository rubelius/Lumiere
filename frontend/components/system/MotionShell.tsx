'use client'

import { useState, useEffect, useRef, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

// Route depth for direction detection
const DEPTH: Record<string, number> = {
  '/': 0, '/search': 1, '/library': 1, '/session': 2,
  '/party': 2, '/profile': 1, '/settings': 1,
}

const getVariants = (dir: string) => {
  if (dir === 'forward')  return { i: { opacity: 0, x: 40, filter: 'blur(4px)' },  a: { opacity: 1, x: 0, filter: 'blur(0px)' }, e: { opacity: 0, x: -28, filter: 'blur(2px)' } }
  if (dir === 'backward') return { i: { opacity: 0, x: -40, filter: 'blur(4px)' }, a: { opacity: 1, x: 0, filter: 'blur(0px)' }, e: { opacity: 0, x: 28,  filter: 'blur(2px)' } }
  return { i: { opacity: 0, y: 20, filter: 'blur(3px)' }, a: { opacity: 1, y: 0, filter: 'blur(0px)' }, e: { opacity: 0, y: -12, filter: 'blur(2px)' } }
}

// ── Nav strip ──────────────────────────────────────────────────────────────────
const NAV = [
  { href: '/',          code: '01', label: 'Home',     abbr: 'HOM' },
  { href: '/search',    code: '02', label: 'Search',   abbr: 'SRC' },
  { href: '/library',   code: '03', label: 'Archive',  abbr: 'ARC' },
  { href: '/session',   code: '04', label: 'Screen',   abbr: 'SCR' },
  { href: '/party',     code: '05', label: 'Party',    abbr: 'PTY' },
  { href: '/profile',   code: '06', label: 'Profile',  abbr: 'PRF' },
  { href: '/settings',  code: '07', label: 'Settings', abbr: 'SET' },
]

function NavStrip({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false)

  return (
    <motion.nav
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      animate={{ width: open ? 210 : 42 }} // <-- Mais espaço de respiro (era 35 -> 196)
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} // Fine Art Ease
      style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100,
        overflow: 'hidden', flexShrink: 0, display: 'flex',
        flexDirection: 'column', 
        background: 'rgba(4, 4, 2, 0.75)', // <-- Mais transparente
        backdropFilter: 'blur(30px) saturate(1.2)', // <-- Vidro mais cinematográfico
        borderRight: '1px solid rgba(191,143,60,0.08)' // <-- Borda com leve tom dourado
      }}
      aria-label="Navigation"
    >
      {/* Gold accent line */}
      <motion.div
        animate={{ opacity: [0.15, 0.3, 0.15], top: ['-50%', '10%', '-50%'] }}
        transition={{ opacity: { duration: 6, repeat: Infinity }, top: { duration: 15, repeat: Infinity, ease: 'easeInOut' } }}
        style={{
          position: 'absolute', right: 0, bottom: 0, width: 1, height: '200%',
          background: 'linear-gradient(to bottom, transparent 0%, rgba(191,143,60,0.2) 20%, rgba(191,143,60,0.5) 50%, rgba(191,143,60,0.2) 80%, transparent 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Brand */}
      <div style={{ height: 64, display: 'flex', alignItems: 'center', paddingLeft: 18, gap: 14, flexShrink: 0 }}>
        <motion.svg animate={{ opacity: [0.7, 1, 0.7] }} transition={{ duration: 4, repeat: Infinity }} viewBox="0 0 20 20" fill="none" style={{ width: 16, height: 16, flexShrink: 0, filter: 'drop-shadow(0 0 6px rgba(191,143,60,0.4))' }}>
          <rect x="3" y="2" width="2.2" height="16" fill="#BF8F3C" />
          <rect x="3" y="15.8" width="9.5" height="2.2" fill="#BF8F3C" />
        </motion.svg>
        <AnimatePresence>
          {open && (
            <motion.span
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.15rem', fontWeight: 500, letterSpacing: '0.12em', color: '#EDE8DC', whiteSpace: 'nowrap' }}
            >
              LUMIÈRE
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Divisor Elegante (Fading Gradient) */}
      <div style={{ height: 1, background: 'linear-gradient(90deg, rgba(237,232,220,0.08) 0%, transparent 100%)', marginBottom: 12 }} />

      {/* Perforations (Efeito 3D de buraco) */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '4px 0', flexShrink: 0 }}>
        {[0,1,2,3].map(i => (
          <motion.div 
            whileHover={{ backgroundColor: 'rgba(191,143,60,0.6)', scale: 1.1 }} 
            key={i} 
            style={{ 
              width: 8, height: 5, 
              background: 'rgba(0,0,0,0.85)', // Fundo escuro
              boxShadow: 'inset 0 1px 3px rgba(0,0,0,1), 0 1px 0 rgba(255,255,255,0.03)', // Sombra interna (buraco real)
              borderRadius: '1px', transition: 'background-color 0.4s' 
            }} 
          />
        ))}
      </div>

      {/* Links */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4, padding: '12px 6px' }}>
        {NAV.map(item => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                position: 'relative', display: 'flex', alignItems: 'center',
                height: 42, gap: 14, padding: '0 8px', textDecoration: 'none',
                background: active ? 'linear-gradient(90deg, rgba(191,143,60,0.08) 0%, transparent 100%)' : 'transparent',
                borderRadius: '4px', transition: 'background 0.3s ease',
                overflow: 'hidden',
              }}
            >
              {active && (
                <motion.div
                  layoutId="nav-bar"
                  animate={{ opacity: [1, 0.7, 1] }}
                  transition={{ opacity: { duration: 3, repeat: Infinity }, type: 'spring', stiffness: 360, damping: 28 }}
                  style={{ position: 'absolute', left: 0, top: 8, bottom: 8, width: 2, background: '#BF8F3C', borderRadius: 2, boxShadow: '0 0 12px rgba(191,143,60,0.6)' }}
                />
              )}
              
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.1em', color: active ? '#BF8F3C' : '#4A4844', width: 16, textAlign: 'right', flexShrink: 0, zIndex: 1, transition: 'color 0.3s' }}>
                {item.code}
              </span>
              
              <AnimatePresence mode="wait">
                {open ? (
                  <motion.span key="full" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
                    style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: active ? '#EDE8DC' : '#7A7874', whiteSpace: 'nowrap', zIndex: 1, transition: 'color 0.3s' }}>
                    {item.label}
                  </motion.span>
                ) : (
                  <motion.span key="abbr" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
                    style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', letterSpacing: '0.08em', color: active ? '#BF8F3C' : '#3A3836', zIndex: 1 }}>
                    {item.abbr}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          )
        })}
      </div>

      {/* Bottom perfs */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '4px 0', flexShrink: 0 }}>
        {[0,1,2,3].map(i => (
          <motion.div 
            whileHover={{ backgroundColor: 'rgba(191,143,60,0.6)', scale: 1.1 }} 
            key={i} 
            style={{ 
              width: 8, height: 5, 
              background: 'rgba(0,0,0,0.85)', 
              boxShadow: 'inset 0 1px 3px rgba(0,0,0,1), 0 1px 0 rgba(255,255,255,0.03)', 
              borderRadius: '1px', transition: 'background-color 0.4s' 
            }} 
          />
        ))}
      </div>

      <div style={{ height: 1, background: 'linear-gradient(90deg, rgba(237,232,220,0.08) 0%, transparent 100%)', marginTop: 12 }} />

      {/* Footer dot */}
      <div style={{ height: 56, display: 'flex', alignItems: 'center', paddingLeft: 18, gap: 12, flexShrink: 0 }}>
        <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 4, repeat: Infinity }}
          style={{ width: 6, height: 6, borderRadius: '50%', background: '#BF8F3C', flexShrink: 0, boxShadow: '0 0 12px rgba(191,143,60,0.8)' }} />
        <AnimatePresence>
          {open && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#565450', whiteSpace: 'nowrap' }}>
              Personal Cinema · v1
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </motion.nav>
  )
}

// ── Ambient grain canvas (Protegido contra SSR) ──────────────────────────────
function GrainCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)
  const frame = useRef(0)
  const t = useRef(0)

  useEffect(() => {
    // Proteção rigorosa contra Server-Side Rendering (Next.js Hydration)
    if (typeof window === 'undefined') return;

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

  const isLoginPage = pathname === '/login';

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
      
      {/* Layer 3: nav (ESCONDIDA NA TELA DE LOGIN) */}
      {!isLoginPage && (
        <div style={{ position: 'relative', zIndex: 10, flexShrink: 0 }}>
          <NavStrip pathname={pathname} />
        </div>
      )}
      
      {/* Layer 4: page content (Espaçamento ajustado para compensar a nova largura de 42px) */}
      <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 5, marginLeft: isLoginPage ? 0 : 54 }}>
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