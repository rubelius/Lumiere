'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence, useAnimationFrame, useMotionValue, useTransform, useSpring } from 'framer-motion'
/* ─────────────────────────────────────────────────────────────
   MARQUEE — Horizontal scrolling film titles.
   Like a cinema marquee sign or end credits crawl.
   Inspired by meesverberne.com's "Movement / Emotion / 
   Storytelling / Intention" kinetic text sequence.
   ───────────────────────────────────────────────────────────── */

const MARQUEE_ITEMS = [
  'Persona', 'L\'Avventura', 'Stalker', 'Barry Lyndon',
  'Satantango', 'Shoah', 'Jeanne Dielman', '2001',
  'Tokyo Story', 'Mulholland Drive', 'Au Hasard Balthazar',
  'Aguirre', 'Sans Soleil', 'The Tree of Life',
]



export function CinemaMarquee() {
  const items = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS]

  const baseX = useMotionValue(0)
  const x = useTransform(baseX, (v) => `${v}%`)
  const directionFactor = useRef<number>(-1)
  const isHovered = useRef(false)

  useAnimationFrame((t, delta) => {
    // MELHORIA 3: Pausa suave no hover
    if (isHovered.current) return
    
    // Deixei o letreiro significativamente mais lento (0.8 em vez de 4)
    let moveBy = directionFactor.current * (delta / 1000) * 0.8 
    if (baseX.get() <= -50) baseX.set(0)
    baseX.set(baseX.get() + moveBy)
  })


  return (
    <div
      onMouseEnter={() => (isHovered.current = true)}
      onMouseLeave={() => (isHovered.current = false)}
      style={{
        borderTop: '1px solid rgba(237,232,220,0.05)',
        borderBottom: '1px solid rgba(237,232,220,0.05)',
        background: 'rgba(12,11,8,0.80)',
        padding: '14px 0',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Left fade */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: 80, zIndex: 2,
        background: 'linear-gradient(to right, #080806, transparent)',
        pointerEvents: 'none',
      }} />
      {/* Right fade */}
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0,
        width: 80, zIndex: 2,
        background: 'linear-gradient(to left, #080806, transparent)',
        pointerEvents: 'none',
      }} />

      <motion.div
        className="marquee-track"
        style={{ 
          x: x, // <-- AQUI! Isso liga o cálculo matemático ao elemento visual
          display: 'flex', 
          gap: 0, 
          whiteSpace: 'nowrap', 
          width: 'max-content' 
        }}
      >
        {items.map((film, i) => (
          <span
            key={i}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 24,
              padding: '0 24px',
            }}
          >
            <span
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: '10px',
                fontWeight: 400,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: i % 7 === 0 ? '#BF8F3C' : '#302E2A',
              }}
            >
              {film}
            </span>
            {/* Separator — diamond */}
            <span
              style={{
                display: 'inline-block',
                width: 3,
                height: 3,
                background: '#1C1B18',
                transform: 'rotate(45deg)',
                flexShrink: 0,
              }}
            />
          </span>
        ))}
      </motion.div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   FILM PROGRAMME — The main film list.
   Inspired by cinema programme brochures and siena.film's 
   architectural list view. NOT a grid of cards.
   
   Each row is a programme entry:
   [number] [title]          [director]  [year] [runtime] [badges]
   
   On hover: a thumbnail preview reveals on the right.
   ───────────────────────────────────────────────────────────── */

export interface FilmEntry {
  id: string | number
  number: string
  title: string
  originalTitle?: string
  director: string
  year: string
  country: string
  runtime: string
  qualities: string[]
  posterSrc: string
  backgroundSrc: string
  genre?: string
  synopsis: string
}

interface FilmProgrammeProps {
  title: string
  subtitle?: string
  films: FilmEntry[]
}

function QualityDots({ qualities }: { qualities: string[] }) {
  const colorMap: Record<string, string> = {
    '4K': '#BF8F3C', 'REMUX': '#5E8872', 'HDR': '#9E6858',
    'ATMOS': '#7E6E9A', 'IMAX': '#5E8888', 'WEB-DL': '#607898', 'DV': '#607898',
  }
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {qualities.slice(0, 3).map(q => (
        <span
          key={q}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '1px 6px',
            border: `1px solid ${colorMap[q] || '#302E2A'}33`,
            background: `${colorMap[q] || '#302E2A'}0D`,
            fontFamily: "'DM Mono', monospace",
            fontSize: '8.5px',
            fontWeight: 400,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: colorMap[q] || '#302E2A',
            borderRadius: 1,
          }}
        >
          {q}
        </span>
      ))}
    </div>
  )
}

const FINE_ART_EASE = [0.22, 1, 0.36, 1] as [number, number, number, number]

function FilmRow({ film, isHovered, isDimmed, isExpanded, onHover, onClick, router }: any) {
  return (
    <div
      onClick={() => {
        if (!isExpanded) {
          onClick(film.id);
          // A MÁGICA DA NAVEGAÇÃO ATRASADA:
          // Espera a animação de expansão terminar (800ms) antes de ir pra página do filme
          setTimeout(() => {
            router.push(`/movie/${film.id}`);
          }, 800); 
        }
      }}
      onMouseEnter={() => !isExpanded && onHover(film.id)}
      onMouseLeave={() => !isExpanded && onHover(null)}
      style={{
        display: 'block', position: 'relative', 
        zIndex: isHovered || isExpanded ? 10 : 1,
        cursor: isExpanded ? 'default' : 'crosshair'
      }}
    >
      <motion.div
        layout
        initial={false}
        animate={{
          height: isExpanded ? '100vh' : isHovered ? 300 : 70, 
          opacity: isDimmed ? 0.15 : 1, 
          backgroundColor: isHovered ? 'rgba(237,232,220,0.01)' : 'rgba(237,232,220,0)',
        }}
        transition={{ duration: 0.85, ease: FINE_ART_EASE }}
        style={{
          borderBottom: '1px solid rgba(237,232,220,0.03)',
          overflow: 'hidden',
          position: 'relative' 
        }}
      >

        {/* ── 0. IMAGEM DE FUNDO (O retorno da animação charmosa) ── */}
        <motion.div
          // ATENÇÃO: Removi a prop 'layout' daqui! É isso que tira o "engasgo".
          initial={false}
          animate={{ 
            opacity: isExpanded ? 1 : isHovered ? 0.10 : 0, 
            // Voltamos para a expansão original da largura que você gostou!
            width: isExpanded ? '100%' : isHovered ? '50%' : '0%',
          }}
          transition={{ duration: 0.85, ease: FINE_ART_EASE }}
          style={{
            position: 'absolute', top: 0, bottom: 0, right: 0,
            overflow: 'hidden', zIndex: -1,
            filter: 'grayscale(100%)', 
            // Avisa a placa de vídeo para focar nisso
            willChange: 'width, opacity' 
          }}
        >
          {/* O gradiente escuro que protege a leitura do texto */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, #080806 0%, transparent 100%)', zIndex: 1 }} />
          
          {/* A lógica purista do fundo vazio se não houver imagem */}
          {film.backgroundSrc ? (
            <img 
              src={film.backgroundSrc} 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
              alt=""
            />
          ) : null}
        </motion.div>

        {/* ── 1. NÚMERO DO ÍNDICE ── */}
        <motion.div
          animate={{ color: isHovered ? '#BF8F3C' : '#565450' }}
          transition={{ duration: 0.8 }}
          style={{ position: 'absolute', left: 40, top: 28, fontFamily: "'DM Mono', monospace", fontSize: '10px' }}
        >
          {film.number}
        </motion.div>

        {/* ── 2. O PÔSTER (Revelação Óptica por Desfoque) ── */}
        <AnimatePresence>
          {isHovered && !isExpanded && ( // Esconde o mini-poster se expandir
            <motion.div
              initial={{ opacity: 0, filter: 'blur(10px)', scale: 0.95 }}
              animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
              exit={{ opacity: 0, filter: 'blur(10px)', scale: 0.95 }}
              transition={{ duration: 0.85, ease: FINE_ART_EASE }}
              style={{
                position: 'absolute', left: 90, top: 35, width: 110, height: 160, 
              }}
            >
              <img 
                src={film.posterSrc} 
                style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(25%) contrast(1.1)' }} 
                alt=""
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── 3. TÍTULO (Escala Vetorial) ── */}
        <motion.h3
          animate={{
            scale: isExpanded ? 2.5 : isHovered ? 1.35 : 1, // Cresce ainda mais no clique
            color: isExpanded ? '#FFFFFF' : isHovered ? '#EDE8DC' : '#8C8880',
            y: isExpanded ? '30vh' : isHovered ? 12 : 0, // Desce para o meio da tela no clique
            x: isExpanded ? '10vw' : 0
          }}
          transition={{ duration: 0.85, ease: FINE_ART_EASE }}
          style={{
            position: 'absolute', left: 240, top: 22, 
            fontFamily: "'Cormorant Garamond', serif", fontSize: '1.6rem', fontWeight: 400,
            margin: 0, lineHeight: 1, letterSpacing: '-0.01em',
            transformOrigin: 'left top',
            willChange: 'transform, color',
            zIndex: 10
          }}
        >
          {film.title}
        </motion.h3>

        {/* ── 4. A SINOPSE EDITORIAL ── */}
        <AnimatePresence>
          {isHovered && !isExpanded && ( // Esconde a sinopse se expandir
            <div style={{ position: 'absolute', left: 240, top: 100, display: 'flex', gap: 24, maxWidth: 1120 }}>
              
              {/* A Linha Dourada */}
              <motion.div
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                exit={{ scaleY: 0 }}
                transition={{ duration: 0.9, delay: 0.1, ease: FINE_ART_EASE }}
                style={{ width: 1, backgroundColor: 'rgba(191,143,60,0.3)', transformOrigin: 'top' }}
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden', paddingBottom: 10 }}>
                <div style={{ overflow: 'hidden' }}>
                  <motion.div
                    initial={{ y: '100%', filter: 'blur(4px)' }}
                    animate={{ y: '0%', filter: 'blur(0px)' }}
                    exit={{ y: '100%', filter: 'blur(4px)' }}
                    transition={{ duration: 0.8, delay: 0.15, ease: FINE_ART_EASE }}
                    style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', color: '#7A5A20', textTransform: 'uppercase' }}
                  >
                    {film.director} // {film.year} // {film.genre}
                  </motion.div>
                </div>

                <div style={{ overflow: 'hidden' }}>
                  <motion.p
                    initial={{ y: '100%', filter: 'blur(8px)', opacity: 0 }}
                    animate={{ y: '0%', filter: 'blur(0px)', opacity: 1 }}
                    exit={{ y: '50%', filter: 'blur(4px)', opacity: 0 }}
                    transition={{ duration: 0.9, delay: 0.2, ease: FINE_ART_EASE }}
                    style={{ 
                      fontFamily: "'Cormorant Garamond', serif", fontSize: '1.2rem', lineHeight: 1.6, 
                      color: 'rgba(237,232,220,0.55)', fontStyle: 'italic', margin: 0 
                    }}
                  >
                    {film.synopsis}
                  </motion.p>
                </div>
              </div>
            </div>
          )}
        </AnimatePresence>

        {/* ── 5. DADOS DA TABELA DE REPOUSO ── */}
        <AnimatePresence>
          {!isHovered && !isExpanded && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              style={{ position: 'absolute', right: 40, top: 28, display: 'flex', gap: 40, color: '#565450', fontFamily: "'DM Mono', monospace", fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }}
            >
              <span>{film.director}</span>
              <span>{film.year}</span>
              <span style={{ width: 80, textAlign: 'right' }}>{film.runtime}</span>
            </motion.div>
          )}
        </AnimatePresence>

      </motion.div>
    </div>
  )
}

export function FilmProgramme({ title, subtitle, films }: any) {
  const [hoveredId, setHoveredId] = useState<string | number | null>(null)
  const [expandedId, setExpandedId] = useState<string | number | null>(null)
  
  // Pegamos o router do Next.js para fazer a navegação manual
  const router = useRouter() 

  return (
    <section style={{ padding: '80px 72px' }}>
      
      {/* CABEÇALHO */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 48, paddingBottom: 28, borderBottom: '1px solid rgba(237,232,220,0.05)' }}>
        <div>
          {subtitle && (
            <div style={{ overflow: 'hidden', marginBottom: 10 }}>
              <motion.div initial={{ y: '100%' }} whileInView={{ y: '0%' }} viewport={{ once: true }} transition={{ duration: 1, ease: FINE_ART_EASE }} className="label-gold" style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#BF8F3C' }}>
                {subtitle}
              </motion.div>
            </div>
          )}
          {/* Adicionamos paddingBottom para a perna do 'g' não bater no fundo da caixa */}
          <div style={{ overflow: 'hidden', paddingBottom: 16 }}> 
            <motion.h2
              initial={{ y: '100%' }} whileInView={{ y: '0%' }} viewport={{ once: true }} transition={{ duration: 1.2, ease: FINE_ART_EASE }}
              // Mudamos o lineHeight de 1 para 1.1 para dar respiro interno
              style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(2rem, 3vw, 2.8rem)', fontWeight: 400, color: '#EDE8DC', lineHeight: 1.1, letterSpacing: '-0.01em', margin: 0 }}
            >
              {title}
            </motion.h2>
          </div>
        </div>
        
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 1, delay: 0.4 }}>
          <Link href="/library" style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#565450', textDecoration: 'none', borderBottom: '1px solid rgba(237,232,220,0.08)', paddingBottom: 2, transition: 'color 0.2s, border-color 0.2s' }}>
            Arquivo completo →
          </Link>
        </motion.div>
      </div>

      <div style={{ position: 'relative' }}>
        {films.map((film: any, i: number) => (
          <motion.div
            key={film.id}
            initial={{ opacity: 0, y: 12 }} 
            whileInView={{ opacity: 1, y: 0 }} 
            viewport={{ once: true, margin: "-5%" }} 
            transition={{ delay: i * 0.08, duration: 0.8, ease: FINE_ART_EASE }}
          >
            <FilmRow 
              film={film} 
              isHovered={hoveredId === film.id && expandedId === null}
              isDimmed={(hoveredId !== null && hoveredId !== film.id) || (expandedId !== null && expandedId !== film.id)}
              isExpanded={expandedId === film.id}
              onHover={setHoveredId}
              onClick={setExpandedId} 
              router={router} // Passamos o router para o FilmRow poder navegar
            />
          </motion.div>
        ))}
      </div>
    </section>
  )
}