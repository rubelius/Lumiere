'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'

const FINE_ART_EASE = [0.22, 1, 0.36, 1] as [number, number, number, number]

interface NowProjectingProps {
  title: string
  director: string
  year: string
  progress: number
  remainingTime: string
  frameSrc: string
  href: string
}

export function NowProjecting({
  title, director, year, progress, remainingTime, frameSrc, href
}: NowProjectingProps) {
  const [isHovered, setIsHovered] = useState(false)
  const totalDots = 20
  const filledDots = Math.round((progress / 100) * totalDots)

  return (
    <section
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        background: '#080806', // Fundo um pouco mais profundo
        borderTop: '1px solid rgba(237,232,220,0.03)',
        borderBottom: '1px solid rgba(237,232,220,0.03)',
        padding: '80px 72px',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 400px', // Um pouco mais de respiro para o texto
          gap: 64,
          alignItems: 'center',
        }}
      >
        {/* ── ESQUERDA: O VISOR DO PROJETOR ── */}
        <div style={{ position: 'relative' }}>

          {/* Perfuração Superior (Rolo de Filme) */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 12, paddingLeft: 4, paddingRight: 4 }}>
            {Array.from({ length: totalDots }).map((_, i) => (
              <motion.div
                key={i}
                animate={{
                  backgroundColor: i < filledDots
                    ? (isHovered ? '#BF8F3C' : 'rgba(191,143,60,0.6)')
                    : 'rgba(237,232,220,0.04)'
                }}
                transition={{ duration: 0.8, ease: FINE_ART_EASE }}
                style={{ flex: 1, height: 2, borderRadius: 1 }}
              />
            ))}
          </div>

          {/* A Tela (Screen) */}
          <motion.div
            animate={{
              borderColor: isHovered ? 'rgba(237,232,220,0.1)' : 'rgba(237,232,220,0.03)',
              boxShadow: isHovered ? '0 20px 40px rgba(0,0,0,0.5)' : '0 10px 20px rgba(0,0,0,0.3)'
            }}
            transition={{ duration: 0.8, ease: FINE_ART_EASE }}
            style={{
              position: 'relative',
              overflow: 'hidden',
              aspectRatio: '2.39/1',
              background: '#040402',
              border: '1px solid',
              borderRadius: 2
            }}
          >
            {/* Imagem com Foco Óptico */}
            <motion.img
              src={frameSrc}
              alt={title}
              animate={{
                filter: isHovered 
                  ? 'saturate(0.7) brightness(0.8) contrast(1.1)' // Focado
                  : 'saturate(0.1) brightness(0.4) contrast(1.2)', // Repouso
                scale: isHovered ? 1 : 1.02 // Levíssimo respiro na lente
              }}
              transition={{ duration: 1.2, ease: FINE_ART_EASE }}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />

            {/* Simulação da Lâmpada (Flicker infinito) */}
            <motion.div 
              animate={{ opacity: isHovered ? [0.4, 0.5, 0.45, 0.5] : [0.1, 0.15, 0.1, 0.12] }}
              transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
              style={{
                position: 'absolute', inset: 0,
                background: 'radial-gradient(ellipse 70% 70% at 50% 50%, rgba(191,143,60,0.08) 0%, transparent 80%)',
                pointerEvents: 'none',
                mixBlendMode: 'screen'
              }} 
            />

            {/* Scanline Estético */}
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: 'repeating-linear-gradient(0deg, rgba(4,4,2,0.08) 0px, rgba(4,4,2,0.08) 1px, transparent 1px, transparent 3px)',
              pointerEvents: 'none',
            }} />

            {/* Vinheta Dinâmica */}
            <motion.div 
              animate={{ background: isHovered ? 'radial-gradient(ellipse 100% 100% at 50% 50%, transparent 50%, rgba(4,4,2,0.6) 100%)' : 'radial-gradient(ellipse 90% 90% at 50% 50%, transparent 30%, rgba(4,4,2,0.9) 100%)' }}
              transition={{ duration: 1.2, ease: FINE_ART_EASE }}
              style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} 
            />

            {/* Timecode (Substitui o % antigo) */}
            <motion.div
              animate={{ opacity: isHovered ? 1 : 0.4 }}
              transition={{ duration: 0.8 }}
              style={{
                position: 'absolute', bottom: 16, right: 16,
                fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em',
                color: '#BF8F3C', background: 'rgba(4,4,2,0.8)',
                padding: '4px 10px', border: '1px solid rgba(191,143,60,0.2)'
              }}
            >
              TC {progress.toString().padStart(2, '0')}:00 // PLAYING
            </motion.div>
          </motion.div>

          {/* Dados do Rolo (Inferior) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, paddingLeft: 4, paddingRight: 4 }}>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', letterSpacing: '0.2em', color: '#565450', textTransform: 'uppercase' }}>
              Rolo 01 / 35MM
            </span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', letterSpacing: '0.2em', color: '#565450' }}>
              FRAME {Math.round((progress / 100) * 168000).toLocaleString('pt-BR')} / 168.000
            </span>
          </div>
        </div>

        {/* ── DIREITA: DADOS DO FILME E CTA ── */}
        <div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', color: '#7A5A20', textTransform: 'uppercase', marginBottom: 16 }}>
            {director} // {year}
          </div>

          <motion.h3
            animate={{ color: isHovered ? '#FFFFFF' : '#EDE8DC' }}
            transition={{ duration: 0.8 }}
            style={{
              fontFamily: "'Cormorant Garamond', serif", fontSize: '2.8rem', fontWeight: 400,
              lineHeight: 1.05, marginBottom: 32, letterSpacing: '-0.01em', margin: '0 0 32px 0'
            }}
          >
            {title}
          </motion.h3>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.1em', color: '#565450', textTransform: 'uppercase' }}>Restante</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.1em', color: '#BF8F3C' }}>{remainingTime}</span>
          </div>

          {/* Barra de Progresso Contínua */}
          <div style={{ height: 1, background: 'rgba(237,232,220,0.05)', marginBottom: 40, position: 'relative', overflow: 'hidden' }}>
            <motion.div
              initial={{ width: '0%' }}
              whileInView={{ width: `${progress}%` }}
              viewport={{ once: true }}
              transition={{ duration: 1.5, delay: 0.2, ease: FINE_ART_EASE }}
              style={{ position: 'absolute', top: 0, left: 0, height: '100%', background: isHovered ? '#BF8F3C' : 'rgba(191,143,60,0.5)' }}
            />
          </div>

          {/* Botão de Ação Editorial */}
          <Link
            href={href}
            data-tv-focusable
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 12, height: 48, padding: '0 32px',
              background: isHovered ? 'rgba(191,143,60,0.05)' : 'transparent',
              border: `1px solid ${isHovered ? 'rgba(191,143,60,0.4)' : 'rgba(237,232,220,0.1)'}`,
              color: isHovered ? '#BF8F3C' : '#8C8880',
              fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em',
              textTransform: 'uppercase', textDecoration: 'none', transition: 'all 0.4s ease',
            }}
          >
            <motion.svg 
              animate={{ x: isHovered ? 4 : 0 }} 
              transition={{ duration: 0.4, ease: FINE_ART_EASE }}
              viewBox="0 0 12 12" fill="currentColor" style={{ width: 8, height: 8 }}
            >
              <path d="M2 1.5L10 6L2 10.5V1.5Z" />
            </motion.svg>
            [ RETOMAR_PROJEÇÃO ]
          </Link>
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────
   ADMIT ONE — Session ticket.
   Directly inspired by siena.film's "ADMIT ONE 004" stamp.
   A ticket stub aesthetic: perforated edges, bold stamp type,
   numbered serial, used as the sessions entry point.
   ───────────────────────────────────────────────────────────── */

interface AdmitOneProps {
  sessionTitle: string
  filmCount: number
  totalDuration: string
  date: string
  sessionNumber: string
  href: string
  filmList?: string[] // NOVO: Array com os títulos dos filmes
}

export function AdmitOne({
  sessionTitle, filmCount, totalDuration, date, sessionNumber, href, filmList = []
}: AdmitOneProps) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <section style={{ padding: '0 72px 80px' }}>
      <Link
        href={href}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        data-tv-focusable
        style={{
          display: 'block',
          textDecoration: 'none',
          background: '#080806',
          position: 'relative',
          overflow: 'hidden',
          cursor: 'pointer',
        }}
      >
        <motion.div
          animate={{
            borderColor: isHovered ? 'rgba(191,143,60,0.25)' : 'rgba(237,232,220,0.06)',
            backgroundColor: isHovered ? 'rgba(237,232,220,0.01)' : 'rgba(237,232,220,0)',
            y: isHovered ? -2 : 0 
          }}
          transition={{ duration: 0.8, ease: FINE_ART_EASE }}
          style={{
            display: 'grid',
            gridTemplateColumns: '64px 1fr 200px',
            minHeight: 160,
            border: '1px solid',
            borderRadius: 2
          }}
        >
          {/* ── CANHOTO ESQUERDO (Picote do Ingresso) ── */}
          <div
            style={{
              borderRight: '1px dashed rgba(237,232,220,0.08)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 8, padding: '20px 0', background: 'rgba(0,0,0,0.2)'
            }}
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <motion.div
                key={i}
                animate={{
                  borderColor: isHovered ? 'rgba(191,143,60,0.3)' : 'rgba(237,232,220,0.1)',
                  scale: isHovered ? 1.1 : 1
                }}
                transition={{ duration: 0.6, delay: i * 0.03 }}
                style={{ width: 12, height: 6, border: '1px solid', borderRadius: 1 }}
              />
            ))}
          </div>

          {/* ── CONTEÚDO PRINCIPAL (Carimbo e Lista de Filmes) ── */}
          <div
            style={{
              padding: '32px 48px', // Leve ajuste no padding para alinhar com a lista
              display: 'flex',
              justifyContent: 'space-between', // Separa o bloco esquerdo do direito
              position: 'relative'
            }}
          >
            {/* Gloss sutil de iluminação */}
            <motion.div 
              animate={{ opacity: isHovered ? 1 : 0, x: isHovered ? 0 : -20 }}
              style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to right, rgba(191,143,60,0.03) 0%, transparent 40%)',
                pointerEvents: 'none'
              }}
            />

            {/* Bloco da Esquerda: O Carimbo */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', color: '#565450', textTransform: 'uppercase' }}>
                Lumière Personal Archive // Curadoria Especial
              </div>

              <div style={{ margin: '16px 0' }}>
                <motion.div
                  animate={{
                    color: isHovered ? '#EDE8DC' : '#B4AFA4',
                    letterSpacing: isHovered ? '0.08em' : '0.06em'
                  }}
                  transition={{ duration: 1, ease: FINE_ART_EASE }}
                  style={{
                    fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(2.5rem, 5vw, 4rem)',
                    fontWeight: 600, textTransform: 'uppercase', lineHeight: 0.9, marginBottom: 8,
                  }}
                >
                  ADMIT ONE
                </motion.div>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.4rem', fontWeight: 300, fontStyle: 'italic', color: '#BF8F3C', lineHeight: 1 }}>
                  {sessionTitle}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#565450', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{filmCount} títulos</span>
                <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#1C1B18' }} />
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#565450', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{totalDuration}</span>
                <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#1C1B18' }} />
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#BF8F3C', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{date}</span>
              </div>
            </div>

            {/* Bloco da Direita: O Tracklist dos Filmes */}
            {filmList.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-end', gap: 8, zIndex: 1 }}>
                {filmList.map((film, index) => (
                  <motion.div
                    key={index}
                    animate={{ 
                      color: isHovered ? '#EDE8DC' : '#565450',
                      x: isHovered ? 0 : 4 // Efeito cascata para a esquerda
                    }}
                    transition={{ duration: 0.6, ease: FINE_ART_EASE, delay: index * 0.05 }}
                    style={{
                      fontFamily: "'Cormorant Garamond', serif", fontSize: '1.25rem', fontStyle: 'italic',
                      lineHeight: 1, display: 'flex', alignItems: 'baseline', gap: 12
                    }}
                  >
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', color: '#BF8F3C', fontStyle: 'normal', letterSpacing: '0.15em' }}>
                      {String(index + 1).padStart(2, '0')} //
                    </span>
                    {film}
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* ── CANHOTO DIREITO (Serial Number) ── */}
          <div
            style={{
              borderLeft: '1px dashed rgba(237,232,220,0.08)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 16, padding: '24px', position: 'relative', background: 'rgba(0,0,0,0.1)'
            }}
          >
            <motion.div
              animate={{ 
                color: isHovered ? 'rgba(191,143,60,0.15)' : 'rgba(237,232,220,0.04)',
                scale: isHovered ? 1.05 : 1
              }}
              style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '4.5rem', fontWeight: 700, lineHeight: 1, letterSpacing: '-0.05em', position: 'absolute', zIndex: 0 }}
            >
              {sessionNumber}
            </motion.div>
            
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', color: isHovered ? '#BF8F3C' : '#302E2A', textAlign: 'center', zIndex: 1, transition: 'color 0.4s' }}>
              [ VALIDAR_ENTRADA ]
            </div>
            
            <motion.svg 
              animate={{ y: isHovered ? [0, -4, 0] : 0 }}
              transition={{ repeat: isHovered ? Infinity : 0, duration: 2 }}
              viewBox="0 0 16 16" fill="none" 
              style={{ width: 14, height: 14, color: isHovered ? '#BF8F3C' : '#302E2A', zIndex: 1, transition: 'color 0.4s' }}
            >
              <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </motion.svg>
          </div>
        </motion.div>
      </Link>
    </section>
  )
}

export function SessionRow({ session, isHovered, isDimmed, onHover }: any) {
  return (
    <div
      onMouseEnter={() => onHover(session.number)}
      onMouseLeave={() => onHover(null)}
      style={{
        display: 'block',
        position: 'relative',
        zIndex: isHovered ? 10 : 1,
        cursor: 'crosshair',
        borderBottom: '1px solid rgba(237,232,220,0.03)',
      }}
    >
      <motion.div
        layout
        initial={false}
        animate={{
          // A MÁGICA: A linha abre de 90px para 200px no hover
          height: isHovered ? 200 : 90,
          opacity: isDimmed ? 0.15 : 1,
        }}
        transition={{ duration: 0.85, ease: FINE_ART_EASE }}
        style={{
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        {/* ── 0. IMAGEM DE FUNDO REVELADA ── */}
        <motion.div
          layout
          initial={false}
          animate={{ 
            opacity: isHovered ? 1 : 0,
            scale: isHovered ? 1 : 1.05,
            filter: isHovered ? 'grayscale(80%) brightness(0.6)' : 'grayscale(100%) brightness(0)'
          }}
          transition={{ duration: 0.85, ease: FINE_ART_EASE }}
          style={{
            position: 'absolute', inset: 0, zIndex: -1,
            pointerEvents: 'none',
          }}
        >
          {/* Gradiente para garantir a leitura do texto */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, #080806 0%, rgba(8,8,6,0.8) 40%, transparent 100%)', zIndex: 1 }} />
          
          {/* Se você tiver uma imagem no objeto session, ela aparece aqui */}
          {session.image && (
            <img 
              src={session.image} 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
              alt=""
            />
          )}
        </motion.div>

        {/* ── CONTEÚDO DA LINHA ── */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '120px 1fr 200px', 
          alignItems: 'center', 
          width: '100%',
          position: 'relative', 
          zIndex: 1 
        }}>
          
          {/* 1. NÚMERO DA SESSÃO */}
          <motion.div 
            animate={{ 
              color: isHovered ? '#BF8F3C' : '#302E2A',
              scale: isHovered ? 1.2 : 1,
              x: isHovered ? 12 : 0
            }}
            transition={{ duration: 0.85, ease: FINE_ART_EASE }}
            style={{ 
              fontFamily: "'Cormorant Garamond', serif", fontSize: '2.8rem', fontStyle: 'italic', transformOrigin: 'left center'
            }}
          >
            {session.number}
          </motion.div>

          {/* 2. TÍTULO E METADADOS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <motion.h3
              animate={{ 
                color: isHovered ? '#FFFFFF' : '#8C8880',
                y: isHovered ? -4 : 0
              }}
              transition={{ duration: 0.85, ease: FINE_ART_EASE }}
              style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', fontWeight: 400, margin: 0, lineHeight: 1, letterSpacing: '-0.01em' }}
            >
              {session.title}
            </motion.h3>
            
            <motion.div 
              animate={{ color: isHovered ? '#B4AFA4' : '#565450' }}
              style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase' }}
            >
              {session.films} FILMES // {session.duration}
            </motion.div>
          </div>

          {/* 3. DATA E CTA */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 24, paddingRight: 40 }}>
            <motion.span
              animate={{ 
                color: isHovered ? '#BF8F3C' : '#565450',
                y: isHovered ? -2 : 0
              }}
              style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase' }}
            >
              {session.date}
            </motion.span>
            
            {/* O botão/seta só se revela totalmente no hover */}
            <Link href="/session" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
              <motion.div
                animate={{ 
                  x: isHovered ? 0 : -16, 
                  opacity: isHovered ? 1 : 0,
                }}
                transition={{ duration: 0.6, ease: FINE_ART_EASE }}
                style={{ 
                  fontFamily: "'DM Mono', monospace", fontSize: '8px', letterSpacing: '0.2em', color: '#BF8F3C', textTransform: 'uppercase', marginRight: 12
                }}
              >
                 RESERVAR 
              </motion.div>
              <motion.svg
                animate={{ 
                  color: isHovered ? '#BF8F3C' : '#302E2A',
                  opacity: isHovered ? 1 : 0.3
                }}
                viewBox="0 0 16 16" fill="none" style={{ width: 16, height: 16 }}
              >
                <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </motion.svg>
            </Link>
          </div>

        </div>
      </motion.div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   LIBRARY COUNT — Full-bleed typographic statement.
   Inspired by how design studios use a single giant number
   to anchor a section. Creates "silence" and scale contrast.
   ───────────────────────────────────────────────────────────── */

export function LibraryCount({ count }: { count: number }) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <section
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        padding: '120px 72px', // Aumentei o padding para dar ar de "grand finale"
        borderTop: '1px solid rgba(237,232,220,0.05)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 48,
        overflow: 'hidden',
        position: 'relative',
        background: '#080806',
        cursor: 'pointer' // Convida o usuário a clicar em qualquer lugar da área
      }}
    >
      {/* ── O NÚMERO FANTASMA (O Monólito) ── */}
      <motion.div
        aria-hidden="true"
        initial={{ opacity: 0, x: 50 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: "-10%" }}
        animate={{
          color: isHovered ? 'rgba(191,143,60,0.06)' : 'rgba(237,232,220,0.02)',
          scale: isHovered ? 1.05 : 1,
          x: isHovered ? -20 : 0
        }}
        transition={{ duration: 1.5, ease: FINE_ART_EASE }}
        style={{
          position: 'absolute',
          right: 72,
          top: '50%',
          marginTop: '-4%', // Leve ajuste óptico para centralizar a fonte serifa
          transform: 'translateY(-50%)',
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 'clamp(12rem, 25vw, 28rem)', // Ainda maior e mais dramático
          fontWeight: 700,
          lineHeight: 0.8,
          letterSpacing: '-0.05em',
          userSelect: 'none',
          pointerEvents: 'none',
          zIndex: 0
        }}
      >
        {count}
      </motion.div>

      {/* ── CONTEÚDO EDITORIAL ── */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>
        
        {/* Label Dourada com Máscara */}
        <div style={{ overflow: 'hidden' }}>
          <motion.div 
            initial={{ y: '100%' }}
            whileInView={{ y: '0%' }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: FINE_ART_EASE }}
            style={{ 
              fontFamily: "'DM Mono', monospace", fontSize: '10px', 
              letterSpacing: '0.2em', textTransform: 'uppercase', color: '#BF8F3C' 
            }}
          >
            [ ACESSO AO COFRE ]
          </motion.div>
        </div>

        {/* Título Principal */}
        <div style={{ overflow: 'hidden', paddingBottom: 8 }}>
          <motion.div
            initial={{ y: '100%' }}
            whileInView={{ y: '0%' }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 0.1, ease: FINE_ART_EASE }}
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 'clamp(2.5rem, 4vw, 3.5rem)',
              fontWeight: 400,
              color: isHovered ? '#FFFFFF' : '#EDE8DC',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              transition: 'color 0.8s ease'
            }}
          >
            {count} títulos curados.<br />
            <span style={{ fontStyle: 'italic', color: '#8C8880' }}>Cinema de primeira ordem.</span>
          </motion.div>
        </div>

        {/* Link / CTA de Arquivo */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay: 0.2, ease: FINE_ART_EASE }}
        >
          <Link
            href="/library"
            data-tv-focusable
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 16,
              marginTop: 16,
              fontFamily: "'DM Mono', monospace",
              fontSize: '11px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: isHovered ? '#BF8F3C' : '#565450',
              textDecoration: 'none',
              transition: 'color 0.4s ease',
            }}
          >
            <motion.div 
              animate={{ 
                width: isHovered ? 40 : 20, 
                backgroundColor: isHovered ? '#BF8F3C' : '#565450' 
              }}
              transition={{ duration: 0.6, ease: FINE_ART_EASE }}
              style={{ height: 1 }} 
            />
            Explorar o arquivo completo
            <motion.svg 
              animate={{ x: isHovered ? 8 : 0 }}
              transition={{ duration: 0.6, ease: FINE_ART_EASE }}
              viewBox="0 0 16 16" fill="none" style={{ width: 14, height: 14 }}
            >
              <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </motion.svg>
          </Link>
        </motion.div>
      </div>

      {/* ── VÍNCULO DE CLIQUE (Faz a seção inteira ser clicável) ── */}
      <Link href="/library" style={{ position: 'absolute', inset: 0, zIndex: 10 }} aria-label="Explorar o arquivo completo" />
    </section>
  )
}


