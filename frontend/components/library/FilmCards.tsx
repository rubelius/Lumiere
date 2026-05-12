"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const FINE_ART_EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

// 1. Exportamos a Interface para o page.tsx poder usar também
export interface Movie {
  id: string | number;
  number: string;
  title: string;
  year: string;
  img: string;
  backgroundSrc: string;
  director: string;
  qualities: string[];
  runtime: string;
  synopsis: string;
}

// ============================================================================
// COMPONENTE: ROW (Visão em Lista)
// ============================================================================
export function FilmRow({ film, isHovered, isDimmed, isExpanded, onHover, onClick, router }: any) {
  return (
    <div
      onClick={() => {
        if (!isExpanded) {
          onClick(film.id);
          setTimeout(() => { router.push(`/movie/${film.id}`); }, 800); 
        }
      }}
      onMouseEnter={() => !isExpanded && onHover(film.id)}
      onMouseLeave={() => !isExpanded && onHover(null)}
      style={{ 
        display: 'block', position: 'relative', zIndex: isHovered || isExpanded ? 10 : 1, cursor: isExpanded ? 'default' : 'crosshair',
        contentVisibility: 'auto', containIntrinsicSize: '70px'
      }}
    >
      <motion.div
        layout initial={false}
        animate={{
          height: isExpanded ? '100vh' : isHovered ? 240 : 70, 
          opacity: isDimmed ? 0.15 : 1, 
          backgroundColor: isHovered ? 'rgba(237,232,220,0.01)' : 'rgba(237,232,220,0)',
        }}
        transition={{ duration: 0.85, ease: FINE_ART_EASE }}
        style={{ borderBottom: '1px solid rgba(237,232,220,0.03)', overflow: 'hidden', position: 'relative' }}
      >
        <motion.div
          initial={false}
          animate={{ opacity: isExpanded ? 1 : isHovered ? 0.10 : 0, width: isExpanded ? '100%' : isHovered ? '50%' : '0%' }}
          transition={{ duration: 0.85, ease: FINE_ART_EASE }}
          style={{ position: 'absolute', top: 0, bottom: 0, right: 0, overflow: 'hidden', zIndex: -1, filter: 'grayscale(100%)', transformOrigin: 'right' }}
        >
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, #080806 0%, transparent 100%)', zIndex: 1 }} />
          <img src={film.img} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" loading="lazy" />
        </motion.div>

        <motion.div animate={{ color: isHovered ? '#BF8F3C' : '#302E2A' }} style={{ position: 'absolute', left: 40, top: 28, fontFamily: "'DM Mono', monospace", fontSize: '10px' }}>
          {film.number}
        </motion.div>

        <AnimatePresence>
          {isHovered && !isExpanded && (
            <motion.div
              initial={{ opacity: 0, filter: 'blur(10px)', scale: 0.95 }} animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }} exit={{ opacity: 0, filter: 'blur(10px)', scale: 0.95 }}
              style={{ position: 'absolute', left: 90, top: 35, width: 110, height: 160, zIndex: 5 }}
            >
              <img src={film.img} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(25%) contrast(1.1)' }} alt="" />
            </motion.div>
          )}
        </AnimatePresence>

        <motion.h3
          animate={{
            scale: isExpanded ? 2.5 : isHovered ? 1.35 : 1,
            color: isExpanded ? '#FFFFFF' : isHovered ? '#EDE8DC' : '#8C8880',
            y: isExpanded ? '30vh' : isHovered ? 12 : 0,
            x: isExpanded ? '10vw' : 0
          }}
          transition={{ duration: 0.85, ease: FINE_ART_EASE }}
          style={{ position: 'absolute', left: 240, top: 22, fontFamily: "'Cormorant Garamond', serif", fontSize: '1.6rem', fontWeight: 400, margin: 0, lineHeight: 1, letterSpacing: '-0.01em', transformOrigin: 'left top', zIndex: 10 }}
        >
          {film.title}
        </motion.h3>

        <AnimatePresence>
          {isHovered && !isExpanded && (
            <div style={{ position: 'absolute', left: 240, top: 100, display: 'flex', gap: 24, maxWidth: 720 }}>
              <motion.div initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} exit={{ scaleY: 0 }} transition={{ duration: 0.9, delay: 0.1, ease: FINE_ART_EASE }} style={{ width: 1, backgroundColor: 'rgba(191,143,60,0.3)', transformOrigin: 'top' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden', paddingBottom: 10 }}>
                <motion.div initial={{ y: '100%' }} animate={{ y: '0%' }} style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', color: '#7A5A20', textTransform: 'uppercase' }}>
                  {film.director} // {film.year}
                </motion.div>
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.2rem', lineHeight: 1.6, color: 'rgba(237,232,220,0.55)', fontStyle: 'italic', margin: 0 }}>
                  {film.synopsis}
                </motion.p>
              </div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {!isHovered && !isExpanded && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'absolute', right: 40, top: 28, display: 'flex', gap: 40, color: '#302E2A', fontFamily: "'DM Mono', monospace", fontSize: '10px', textTransform: 'uppercase' }}
            >
              <span>{film.director}</span>
              <span>{film.year}</span>
              <span>{film.runtime}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}

// ============================================================================
// COMPONENTE: GRID CARD (Visão em Grade)
// ============================================================================
export function FilmGridCard({ film, router, setExpandedId, onHover }: { film: Movie, router: any, setExpandedId: (id: string | number | null) => void, onHover: (id: string | number | null) => void }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      onMouseEnter={() => { setIsHovered(true); onHover(film.id); }}
      onMouseLeave={() => { setIsHovered(false); onHover(null); }}
      onClick={() => { 
        setExpandedId(film.id); 
        setTimeout(() => router.push(`/movie/${film.id}`), 800); 
      }}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 1, ease: FINE_ART_EASE }}
      style={{ 
        cursor: 'crosshair', display: 'flex', flexDirection: 'column', position: 'relative',
        contentVisibility: 'auto', containIntrinsicSize: '400px'
      }}
    >
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: isHovered ? '#BF8F3C' : '#302E2A', letterSpacing: '0.2em', marginBottom: 12, transition: 'color 0.4s ease' }}>
        [{film.number}]
      </div>

      <div style={{ position: 'relative', aspectRatio: '2/3', overflow: 'hidden', backgroundColor: '#040402', border: isHovered ? '1px solid rgba(191,143,60,0.3)' : '1px solid rgba(237,232,220,0.05)', transition: 'border-color 0.6s ease' }}>
        <motion.img
          src={film.img}
          animate={{ scale: isHovered ? 1.05 : 1, filter: isHovered ? 'grayscale(0%) contrast(1.1)' : 'grayscale(35%) contrast(1)' }}
          transition={{ duration: 0.8, ease: FINE_ART_EASE }}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          loading="lazy"
        />

        <motion.div
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.6, ease: FINE_ART_EASE }}
          style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #080806 0%, rgba(8,8,6,0.9) 35%, transparent 100%)', pointerEvents: 'none' }}
        />

        <motion.div
          initial={false}
          animate={{ y: isHovered ? 0 : 20, opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.6, ease: FINE_ART_EASE }}
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '32px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}
        >
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {film.qualities.map((q) => (
              <span key={q} style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', letterSpacing: '0.15em', padding: '4px 8px', border: '1px solid rgba(191,143,60,0.4)', color: '#BF8F3C', backgroundColor: 'rgba(8,8,6,0.6)' }}>
                {q}
              </span>
            ))}
          </div>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.25rem', color: '#EDE8DC', fontStyle: 'italic', margin: 0, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {film.synopsis}
          </p>
        </motion.div>
      </div>

      <div style={{ marginTop: 24 }}>
        <motion.div animate={{ color: isHovered ? '#FFFFFF' : '#EDE8DC' }} transition={{ duration: 0.4 }} style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.8rem', lineHeight: 1.1, marginBottom: 8, letterSpacing: '-0.01em' }}>
          {film.title}
        </motion.div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', color: '#565450', textTransform: 'uppercase' }}>
          {film.director} // <span style={{ color: isHovered ? '#BF8F3C' : '#302E2A', transition: 'color 0.4s' }}>{film.year}</span>
        </div>
      </div>
    </motion.div>
  );
}