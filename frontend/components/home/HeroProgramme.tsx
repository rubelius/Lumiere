'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'

interface HeroProps {
  title: string
  subtitle?: string
  director: string
  year: string
  country: string
  runtime: string
  synopsis: string
  programmeNumber: string
  backdropSrc: string
  posterSrc: string
  qualities: string[]
  href: string
}

export function HeroProgramme({
  title, subtitle, director, year, country, runtime, synopsis, programmeNumber, backdropSrc, posterSrc, qualities, href
}: HeroProps) {
  
  const ease = [0.16, 1, 0.30, 1] as const

  return (
    <section 
      style={{ 
        position: 'relative', 
        width: '100%', 
        minHeight: '100dvh', 
        overflow: 'hidden', 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'flex-end',
        padding: '5vw 6vw', 
        boxSizing: 'border-box' 
      }}
    >
      {/* ── AMBIENT BACKDROP ────────────────────────────────────────────── */}
      <motion.div 
        initial={{ opacity: 0, scale: 1.05 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 2, ease: [0.25, 0.1, 0.1, 1] }}
        style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}
      >
        <img
          src={backdropSrc}
          alt=""
          style={{ 
            width: '100%', height: '100%', objectFit: 'cover', 
            filter: 'grayscale(100%) contrast(1.2)', 
            opacity: 0.15, mixBlendMode: 'luminosity' 
          }}
        />
        {/* Gradient overlays to merge with the #080806 background */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, #080806 20%, transparent 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #080806 10%, transparent 70%)' }} />
      </motion.div>

      {/* ── FOREGROUND CONTENT ──────────────────────────────────────────── */}
      <div style={{ position: 'relative', zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '4vw' }}>
        
        {/* LEFT COLUMN: EDITORIAL SCRIPT */}
        <div style={{ maxWidth: '65vw' }}>
          
          {/* Metadata Anchor */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.2, ease }}
            style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}
          >
            <div style={{ width: 40, height: 1, background: '#BF8F3C' }} />
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#BF8F3C' }}>
              Prog Nº {programmeNumber}
            </span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#7A5A20' }}>
              {country} // {year}
            </span>
          </motion.div>

          {/* Massive Display Title */}
          <div style={{ overflow: 'hidden', paddingBottom: 8 }}>
            <motion.h1 
              initial={{ y: '100%' }} animate={{ y: '0%' }} transition={{ duration: 1.2, delay: 0.3, ease }}
              style={{ 
                fontFamily: "'Cormorant Garamond', serif", 
                fontSize: 'clamp(4rem, 10vw, 9rem)', 
                fontWeight: 400, 
                lineHeight: 0.85, 
                letterSpacing: '-0.02em', 
                color: '#EDE8DC',
                margin: 0
              }}
            >
              {title}
            </motion.h1>
          </div>

          {/* Subtitle (If exists) */}
          {subtitle && (
            <div style={{ overflow: 'hidden', marginBottom: 32, marginTop: 8 }}>
              <motion.h2 
                initial={{ y: '100%' }} animate={{ y: '0%' }} transition={{ duration: 1.2, delay: 0.4, ease }}
                style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(1.5rem, 3vw, 3rem)', fontWeight: 300, fontStyle: 'italic', color: '#BF8F3C', margin: 0, lineHeight: 1 }}
              >
                {subtitle}
              </motion.h2>
            </div>
          )}

          {/* Director & Tags Row */}
          <motion.div 
            initial={{ opacity: 0, filter: 'blur(4px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }} transition={{ duration: 1, delay: 0.6, ease }}
            style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32, flexWrap: 'wrap' }}
          >
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#EDE8DC' }}>
              {director}
            </span>
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(237,232,220,0.15)' }} />
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.1em', color: '#7A5A20' }}>
              {runtime}
            </span>
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(237,232,220,0.15)' }} />
            <div style={{ display: 'flex', gap: 8 }}>
              {qualities.map(q => (
                <span key={q} style={{ 
                  fontFamily: "'DM Mono', monospace", fontSize: '8.5px', letterSpacing: '0.1em', padding: '3px 6px', 
                  border: '1px solid rgba(237,232,220,0.1)', borderRadius: 2, color: '#EDE8DC', textTransform: 'uppercase' 
                }}>
                  {q}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Synopsis */}
          <motion.p 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.5, delay: 0.8, ease }}
            style={{ 
              fontFamily: "'Cormorant Garamond', serif", fontSize: '1.2rem', lineHeight: 1.6, 
              color: 'rgba(237,232,220,0.6)', maxWidth: 500, margin: '0 0 40px 0' 
            }}
          >
            {synopsis}
          </motion.p>

          {/* Actions */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 1, ease }}
            style={{ display: 'flex', alignItems: 'center', gap: 24 }}
          >
            <Link 
              href={href}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 12, height: 44, padding: '0 24px', 
                background: '#BF8F3C', color: '#080806', textDecoration: 'none', borderRadius: 1,
                fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.15em', fontWeight: 600, textTransform: 'uppercase'
              }}
            >
              <svg viewBox="0 0 12 12" fill="currentColor" style={{ width: 10, height: 10 }}>
                <path d="M2 1.5L10 6L2 10.5V1.5Z" />
              </svg>
              Projectar
            </Link>

            <Link 
              href="/library"
              style={{
                display: 'inline-flex', alignItems: 'center', height: 44, padding: '0 24px', 
                border: '1px solid rgba(237,232,220,0.1)', color: '#EDE8DC', textDecoration: 'none', borderRadius: 1,
                fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase'
              }}
            >
              + Arquivo
            </Link>
          </motion.div>

        </div>

        {/* RIGHT COLUMN: THE BLEEDING POSTER */}
        <motion.div 
          initial={{ opacity: 0, x: 40, rotateY: 10 }}
          animate={{ opacity: 1, x: 0, rotateY: 0 }}
          transition={{ duration: 1.6, delay: 0.4, ease }}
          style={{ position: 'relative', width: '25vw', maxWidth: 360, perspective: 1000 }}
        >
          {/* Glass framing border */}
          <div style={{ position: 'absolute', inset: -8, border: '1px solid rgba(237,232,220,0.05)', borderRadius: 2, pointerEvents: 'none' }} />
          
          <div style={{ position: 'relative', aspectRatio: '2/3', overflow: 'hidden', borderRadius: 1, boxShadow: '-30px 0 60px rgba(8,8,6,0.9)' }}>
            <img
              src={posterSrc}
              alt={title}
              style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'saturate(0.85) contrast(1.1)' }}
            />
            {/* Inner shadow to blend the poster slightly */}
            <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 40px rgba(8,8,6,0.6)', pointerEvents: 'none' }} />
          </div>
        </motion.div>

      </div>

      {/* ── BOTTOM STRUCTURAL PERFORATIONS ── */}
      <div style={{ position: 'absolute', bottom: 0, left: '6vw', right: '6vw', height: 1, background: 'rgba(237,232,220,0.05)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: '6vw', display: 'flex', gap: 4, transform: 'translateY(50%)' }}>
        {[0,1,2].map(i => <div key={i} style={{ width: 4, height: 4, background: '#080806', border: '1px solid rgba(237,232,220,0.15)', borderRadius: '50%' }} />)}
      </div>

    </section>
  )
}