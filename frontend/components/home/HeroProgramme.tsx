'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'

/* ─────────────────────────────────────────────────────────────
   HERO CONCEPT:
   Inspired by the diagonal split between content/image in
   high-end film festival brochures. The poster BLEEDS past
   the right edge, rotated 2deg. Text occupies the left 58%.
   Background: the full-bleed still from the film, aggressively
   desaturated and darkened — it provides atmosphere, not info.
   
   Hierarchy:
   1. Programme number (DM Mono, tiny, gold — sets context)
   2. Title (Cormorant Garamond, enormous, italic — the art)
   3. Director + year (DM Mono, label size — the facts)
   4. Synopsis (DM Sans, body — the story)
   5. CTA pair (primary + ghost — the action)
   ───────────────────────────────────────────────────────────── */

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
  title,
  subtitle,
  director,
  year,
  country,
  runtime,
  synopsis,
  programmeNumber,
  backdropSrc,
  posterSrc,
  qualities,
  href,
}: HeroProps) {
  return (
    <section
      style={{
        position: 'relative',
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: '#040402',
      }}
    >
      {/* ── Full-bleed backdrop ───────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
        }}
      >
        <img
          src={backdropSrc}
          alt=""
          aria-hidden="true"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center 30%',
            filter: 'saturate(0.12) brightness(0.22) contrast(1.15)',
            transform: 'scale(1.06)',
          }}
        />

        {/* Gradient system: 4 layers for total control */}
        {/* 1. Left darkness — text legibility */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to right, rgba(4,4,2,0.98) 0%, rgba(4,4,2,0.85) 50%, rgba(4,4,2,0.30) 100%)',
        }} />
        {/* 2. Bottom fade — grounds the hero */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, #040402 0%, transparent 60%)',
        }} />
        {/* 3. Top vignette — breathing room */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, rgba(4,4,2,0.5) 0%, transparent 30%)',
        }} />
        {/* 4. Warm projector light — gold radial from center-left */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse 60% 60% at 30% 50%, rgba(191,143,60,0.04) 0%, transparent 70%)',
        }} />
      </div>

      {/* ── Content layout ─────────────────────────────────── */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          flex: 1,
          display: 'flex',
          alignItems: 'flex-end',
          padding: '0 72px 72px',
          gap: 0,
        }}
      >
        {/* Left: Editorial text block — 58% */}
        <div style={{ flex: '0 0 58%', maxWidth: '58%' }}>

          {/* Programme number — the archive context */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.30, 1] }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              marginBottom: 32,
            }}
          >
            <div style={{ width: 32, height: 1, background: '#BF8F3C' }} />
            <span className="label-gold">Programme Nº {programmeNumber}</span>
            <span
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 9,
                letterSpacing: '0.12em',
                color: '#302E2A',
                textTransform: 'uppercase',
              }}
            >
              {country} · {year}
            </span>
          </motion.div>

          {/* Title — the main event */}
          <div style={{ overflow: 'hidden', marginBottom: 8 }}>
            <motion.h1
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.1, delay: 0.2, ease: [0.16, 1, 0.30, 1] }}
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 'clamp(3.5rem, 7vw, 6.5rem)',
                fontWeight: 400,
                fontStyle: 'normal',
                lineHeight: 0.95,
                letterSpacing: '-0.02em',
                color: '#EDE8DC',
                marginBottom: 0,
              }}
            >
              {title}
            </motion.h1>
          </div>

          {/* Subtitle in italic — if exists */}
          {subtitle && (
            <div style={{ overflow: 'hidden', marginBottom: 28 }}>
              <motion.h2
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.0, delay: 0.32, ease: [0.16, 1, 0.30, 1] }}
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: 'clamp(2rem, 4vw, 3.8rem)',
                  fontWeight: 300,
                  fontStyle: 'italic',
                  lineHeight: 1,
                  color: '#BF8F3C',
                  marginBottom: 0,
                }}
              >
                {subtitle}
              </motion.h2>
            </div>
          )}

          {/* Thin rule */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.9, delay: 0.5, ease: [0.16, 1, 0.30, 1] }}
            style={{
              height: 1,
              background: 'rgba(237,232,220,0.08)',
              marginBottom: 24,
              transformOrigin: 'left',
              maxWidth: 480,
            }}
          />

          {/* Film metadata row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.55 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 20,
              marginBottom: 24,
            }}
          >
            <span className="label-md" style={{ color: '#8C8880' }}>
              {director}
            </span>
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#302E2A', display: 'block', flexShrink: 0 }} />
            <span className="label" style={{ color: '#565450' }}>{runtime}</span>
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#302E2A', display: 'block', flexShrink: 0 }} />
            {/* Quality badges */}
            <div style={{ display: 'flex', gap: 4 }}>
              {qualities.map(q => (
                <span
                  key={q}
                  className={`badge badge-${q.toLowerCase().replace(' ', '')}`}
                >
                  {q}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Synopsis */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.65 }}
            style={{
              fontFamily: "'DM Sans', system-ui, sans-serif",
              fontSize: '0.88rem',
              fontWeight: 300,
              lineHeight: 1.72,
              color: '#7A746A',
              maxWidth: 440,
              marginBottom: 40,
            }}
          >
            {synopsis}
          </motion.p>

          {/* CTA pair */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.75, ease: [0.16, 1, 0.30, 1] }}
            style={{ display: 'flex', alignItems: 'center', gap: 16 }}
          >
            <Link
              href={href}
              data-tv-focusable
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                height: 46,
                padding: '0 28px',
                background: '#BF8F3C',
                color: '#040402',
                fontFamily: "'DM Mono', monospace",
                fontSize: '10px',
                fontWeight: 500,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                borderRadius: 1,
                textDecoration: 'none',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#D4A94E' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#BF8F3C' }}
            >
              {/* Play icon */}
              <svg viewBox="0 0 12 12" fill="currentColor" style={{ width: 10, height: 10 }}>
                <path d="M2 1.5L10 6L2 10.5V1.5Z" />
              </svg>
              Projectar
            </Link>

            <Link
              href="/library"
              data-tv-focusable
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                height: 46,
                padding: '0 24px',
                border: '1px solid rgba(237,232,220,0.12)',
                color: '#8C8880',
                fontFamily: "'DM Mono', monospace",
                fontSize: '10px',
                fontWeight: 400,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                borderRadius: 1,
                textDecoration: 'none',
                transition: 'border-color 0.2s, color 0.2s',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement
                el.style.borderColor = 'rgba(191,143,60,0.30)'
                el.style.color = '#BF8F3C'
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement
                el.style.borderColor = 'rgba(237,232,220,0.12)'
                el.style.color = '#8C8880'
              }}
            >
              + Arquivo
            </Link>
          </motion.div>
        </div>

        {/* Right: Poster — bleeds off frame, angled */}
        <div
          style={{
            flex: '0 0 42%',
            maxWidth: '42%',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'flex-end',
            paddingBottom: 0,
            position: 'relative',
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 48 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.3, delay: 0.3, ease: [0.16, 1, 0.30, 1] }}
            style={{
              width: '75%',
              maxWidth: 320,
              transform: 'rotate(2deg) translateX(12%)',
              transformOrigin: 'bottom right',
              position: 'relative',
              boxShadow: '-40px 0 80px rgba(4,4,2,0.9), 0 40px 80px rgba(4,4,2,0.6)',
            }}
          >
            <div style={{ aspectRatio: '2/3', overflow: 'hidden', position: 'relative' }}>
              <img
                src={posterSrc}
                alt={title}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                  filter: 'saturate(0.75) contrast(1.08)',
                }}
              />
              {/* Poster inner shadow */}
              <div style={{
                position: 'absolute', inset: 0,
                boxShadow: 'inset 0 0 60px rgba(4,4,2,0.4)',
                pointerEvents: 'none',
              }} />
            </div>
          </motion.div>
        </div>
      </div>

      {/* Bottom programme line */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, delay: 1.0 }}
        style={{
          position: 'relative',
          zIndex: 10,
          borderTop: '1px solid rgba(237,232,220,0.05)',
          display: 'flex',
          alignItems: 'center',
          padding: '14px 72px',
          gap: 32,
        }}
      >
        <span className="label" style={{ color: '#302E2A' }}>Session présentée par Lumière</span>
        <div style={{ flex: 1, height: 1, background: 'rgba(237,232,220,0.04)' }} />
        <span className="label" style={{ color: '#302E2A' }}>
          Samedi ·{' '}
          {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
        </span>
      </motion.div>
    </section>
  )
}