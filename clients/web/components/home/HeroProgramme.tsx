'use client'

import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useState } from 'react'

interface HeroProps {
  title: string
  subtitle?: string
  director: string
  year: string
  country: string
  runtime: string
  synopsis: string
  programmeNumber: string
  backgroundSrc: string
  posterSrc: string
  qualities: string[]
  href: string
  trailerUrl?: string    
  accentColor?: string   
  logoUrl?: string      
  cinematographer?: string 
  onNext?: () => void   
  onPrev?: () => void   
}

export function HeroProgramme({
  title, subtitle, director, year, country, runtime, synopsis, programmeNumber, 
  backgroundSrc, posterSrc, qualities, href, trailerUrl, accentColor = '#BF8F3C',
  logoUrl, cinematographer, onNext, onPrev
}: HeroProps) {
  
  const ease = [0.16, 1, 0.30, 1] as const
  const isFallback = !backgroundSrc || backgroundSrc === posterSrc
  const finalBg = backgroundSrc || posterSrc

  // Setas discretas - controle de hover
  const [isHovered, setIsHovered] = useState(false);

  const getYoutubeId = (url?: string) => {
    if (!url) return null;
    const match = url.match(/[?&]v=([^&]+)/);
    return match ? match[1] : null;
  }
  const ytId = getYoutubeId(trailerUrl);

  // Extrai o ID do filme da string "/movie/{id}" para plugar no botão de Projetar
  const movieId = href.split('/').pop();

  return (
    <section 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ 
        position: 'relative', width: '100%', minHeight: '100dvh', overflow: 'hidden', 
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        padding: '5vw 6vw', boxSizing: 'border-box' 
      }}
    >
      <AnimatePresence mode="wait">
        <motion.div 
          key={title} 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease }} 
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        >
          {/* ── BACKGROUND AMBIENTE & KINETIC ── */}
          <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden', backgroundColor: '#040402' }}>
            
            <motion.img
              initial={{ scale: 1.05, opacity: isFallback ? 0.3 : 0.2 }} 
              animate={{ 
                scale: 1, 
                opacity: ytId ? 0 : (isFallback ? 0.3 : 0.2) 
              }} 
              transition={{ 
                scale: { duration: 30, ease: 'linear' },
                opacity: { delay: ytId ? 5 : 0, duration: 2 } 
              }}
              src={finalBg} alt=""
              style={{ 
                position: 'absolute', inset: 0,
                width: '100%', height: '100%', objectFit: 'cover', 
                filter: isFallback ? 'blur(40px) grayscale(60%) contrast(1.2)' : 'grayscale(100%) contrast(1.2)',
                transform: isFallback ? 'scale(1.1)' : 'none',
                mixBlendMode: 'luminosity' 
              }}
            />

            {ytId && (
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 0.35 }} 
                transition={{ duration: 3, delay: 4 }} 
                style={{ position: 'absolute', inset: 0, width: '100vw', height: '100vh', scale: 1.35 }}
              >
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&mute=1&controls=0&disablekb=1&modestbranding=1&rel=0&iv_load_policy=3&loop=1&playlist=${ytId}&start=15&playsinline=1`}
                  style={{ width: '100%', height: '100%', border: 'none', pointerEvents: 'none' }}
                  allow="autoplay; encrypted-media"
                />
              </motion.div>
            )}
            
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, #080806 15%, transparent 100%)' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #080806 5%, rgba(8,8,6,0.5) 40%, transparent 100%)' }} />
          </div>

          {/* ── FOREGROUND CONTENT ──────────────────────────────────────────── */}
          <div style={{ position: 'relative', zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '4vw', width: '100%', height: '100%', padding: '5vw 6vw' }}>
            
            <div style={{ maxWidth: '65vw' }}>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.2, ease }} style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                <motion.div animate={{ backgroundColor: accentColor }} transition={{ duration: 2 }} style={{ width: 40, height: 1 }} />
                <motion.span animate={{ color: accentColor }} transition={{ duration: 2 }} style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase' }}>Prog Nº {programmeNumber}</motion.span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#8C8880' }}>{country} // {year}</span>
              </motion.div>

              <div style={{ overflow: 'hidden', paddingBottom: 24, marginBottom: -16, minHeight: '120px', display: 'flex', alignItems: 'flex-end' }}>
                {logoUrl ? (
                  <motion.img 
                    initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 1.2, delay: 0.3, ease }}
                    src={logoUrl} alt={title} 
                    style={{ maxHeight: '140px', maxWidth: '100%', objectFit: 'contain', objectPosition: 'left bottom', filter: 'drop-shadow(0px 10px 20px rgba(0,0,0,0.8))' }}
                  />
                ) : (
                  <motion.h1 initial={{ y: '100%' }} animate={{ y: '0%' }} transition={{ duration: 1.2, delay: 0.3, ease }} style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(4rem, 10vw, 9rem)', fontWeight: 400, lineHeight: 0.85, letterSpacing: '-0.02em', color: '#EDE8DC', margin: 0 }}>
                    {title}
                  </motion.h1>
                )}
              </div>

              {subtitle && subtitle !== title && (
                <div style={{ overflow: 'hidden', paddingBottom: 24, marginBottom: 16, marginTop: 16 }}>
                  <motion.h2 initial={{ y: '100%' }} animate={{ y: '0%' }} transition={{ duration: 1.2, delay: 0.4, ease }} style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(1.5rem, 3vw, 3rem)', fontWeight: 300, fontStyle: 'italic', color: '#8C8880', margin: 0, lineHeight: 1 }}>
                    {subtitle}
                  </motion.h2>
                </div>
              )}

              <motion.div initial={{ opacity: 0, filter: 'blur(4px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }} transition={{ duration: 1, delay: 0.6, ease }} style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#EDE8DC' }}>{director}</span>
                
                {cinematographer && (
                  <>
                    <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(237,232,220,0.15)' }} />
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.1em', color: '#8C8880', textTransform: 'uppercase' }}>DP: {cinematographer}</span>
                  </>
                )}

                <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(237,232,220,0.15)' }} />
                <motion.span animate={{ color: accentColor }} transition={{ duration: 2 }} style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.1em' }}>{runtime}</motion.span>
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(237,232,220,0.15)' }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  {qualities.map(q => (
                    <span key={q} style={{ fontFamily: "'DM Mono', monospace", fontSize: '8.5px', letterSpacing: '0.1em', padding: '3px 6px', border: '1px solid rgba(237,232,220,0.1)', borderRadius: 2, color: '#EDE8DC', textTransform: 'uppercase' }}>{q}</span>
                  ))}
                </div>
              </motion.div>

              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.5, delay: 0.8, ease }} style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.2rem', lineHeight: 1.6, color: 'rgba(237,232,220,0.6)', maxWidth: 500, margin: '0 0 40px 0' }}>
                {synopsis}
              </motion.p>

              {/* ── BOTÕES DE COMANDO ATUALIZADOS ── */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 1, ease }} style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                
                {/* Botão Primário: Vai para o Player */}
                <Link href={`/player?id=${movieId}`}>
                  <motion.div 
                    animate={{ backgroundColor: accentColor }} transition={{ duration: 2 }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 12, height: 44, padding: '0 24px', color: '#080806', borderRadius: 1, fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.15em', fontWeight: 600, textTransform: 'uppercase' }}
                  >
                    <svg viewBox="0 0 12 12" fill="currentColor" style={{ width: 10, height: 10 }}><path d="M2 1.5L10 6L2 10.5V1.5Z" /></svg> Projetar
                  </motion.div>
                </Link>

                {/* Botão Secundário: Vai para a página do Filme em si */}
                <Link href={href} style={{ display: 'inline-flex', alignItems: 'center', height: 44, padding: '0 24px', border: '1px solid rgba(237,232,220,0.1)', color: '#EDE8DC', textDecoration: 'none', borderRadius: 1, fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                  Analisar Detalhes da Obra
                </Link>
                
              </motion.div>
            </div>

            <motion.div initial={{ opacity: 0, x: 40, rotateY: 10 }} animate={{ opacity: 1, x: 0, rotateY: 0 }} transition={{ duration: 1.6, delay: 0.4, ease }} style={{ position: 'relative', width: '25vw', maxWidth: 360, perspective: 1000 }}>
              <div style={{ position: 'absolute', inset: -8, border: '1px solid rgba(237,232,220,0.05)', borderRadius: 2, pointerEvents: 'none' }} />
              <div style={{ position: 'relative', aspectRatio: '2/3', overflow: 'hidden', borderRadius: 1, boxShadow: '-30px 0 60px rgba(8,8,6,0.9)' }}>
                <img src={posterSrc} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'saturate(0.85) contrast(1.1)' }} />
                <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 40px rgba(8,8,6,0.6)', pointerEvents: 'none' }} />
              </div>
            </motion.div>

          </div>
        </motion.div>
      </AnimatePresence>

      {/* ── SETAS DE NAVEGAÇÃO LATERAIS ── */}
      <AnimatePresence>
        {isHovered && onPrev && (
          <motion.button 
            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
            onClick={onPrev}
            style={{ position: 'absolute', left: '2vw', top: '50%', transform: 'translateY(-50%)', zIndex: 50, background: 'transparent', border: 'none', color: 'rgba(237,232,220,0.3)', cursor: 'pointer', padding: 20 }}
          >
            <svg width="24" height="40" viewBox="0 0 24 40" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="22 2 2 20 22 38" /></svg>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isHovered && onNext && (
          <motion.button 
            initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
            onClick={onNext}
            style={{ position: 'absolute', right: '2vw', top: '50%', transform: 'translateY(-50%)', zIndex: 50, background: 'transparent', border: 'none', color: 'rgba(237,232,220,0.3)', cursor: 'pointer', padding: 20 }}
          >
            <svg width="24" height="40" viewBox="0 0 24 40" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="2 2 22 20 2 38" /></svg>
          </motion.button>
        )}
      </AnimatePresence>

      <div style={{ position: 'absolute', bottom: 0, left: '6vw', right: '6vw', height: 1, background: 'rgba(237,232,220,0.05)', zIndex: 20 }} />
      <div style={{ position: 'absolute', bottom: 0, left: '6vw', display: 'flex', gap: 4, transform: 'translateY(50%)', zIndex: 20 }}>
        {[0,1,2].map(i => <div key={i} style={{ width: 4, height: 4, background: '#080806', border: '1px solid rgba(237,232,220,0.15)', borderRadius: '50%' }} />)}
      </div>
    </section>
  )
}