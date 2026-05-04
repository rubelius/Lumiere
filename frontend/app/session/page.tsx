'use client';

import { AnimatePresence, motion } from "framer-motion";
import { Play, Cast, SlidersHorizontal, ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const FINE_ART_EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

function TelemetryStep({ step, index }: any) {
  const isActive = step.status === 'active';
  const isDone = step.status === 'done';
  const [telemetry, setTelemetry] = useState("0x000000");

  // Motor de Telemetria: Gera códigos seriais muito rápido para o passo ativo
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      setTelemetry("0x" + Math.floor(Math.random()*16777215).toString(16).toUpperCase().padStart(6, '0'));
    }, 80); 
    return () => clearInterval(interval);
  }, [isActive]);

  return (
    <motion.div 
      variants={{
        hidden: { opacity: 0, y: 15 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: FINE_ART_EASE } }
      }}
      style={{ position: 'relative' }}
    >
      {/* 1. EIXO ESTRUTURAL (Nó + Linha) */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        {/* Nó Conector (LED Quadrado) */}
        <motion.div
          animate={
            isActive ? { backgroundColor: ['#BF8F3C', 'rgba(191,143,60,0.2)', '#BF8F3C'], scale: [1, 1.2, 1] } :
            isDone ? { backgroundColor: 'rgba(191,143,60,0.5)' } :
            { backgroundColor: 'rgba(237,232,220,0.1)' }
          }
          transition={isActive ? { repeat: Infinity, duration: 1.5, ease: "easeInOut" } : {}}
          style={{ width: 4, height: 4, marginRight: 8, flexShrink: 0 }}
        />
        
        {/* Linha com Tráfego Ótico */}
        <div style={{ position: 'relative', height: 1, flex: 1, backgroundColor: 'rgba(237,232,220,0.05)', overflow: 'hidden' }}>
          {/* Base fixa dourada para os concluídos */}
          {isDone && (
            <div style={{ width: '100%', height: '100%', backgroundColor: '#BF8F3C', opacity: 0.3 }} />
          )}
          
          {/* O Feixe de luz forte do ativo */}
          {isActive && (
            <motion.div
              animate={{ x: ['-100%', '200%'] }}
              transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
              style={{ position: 'absolute', top: 0, left: 0, width: '40%', height: '100%', background: 'linear-gradient(90deg, transparent, #BF8F3C, transparent)', boxShadow: '0 0 8px rgba(191,143,60,0.8)' }}
            />
          )}
          
          {/* Ghost Pings: Validação de integridade nos passos concluídos */}
          {isDone && (
            <motion.div
              animate={{ x: ['-100%', '500%'] }}
              transition={{ repeat: Infinity, duration: 4, ease: 'linear', delay: index * 0.7 }}
              style={{ position: 'absolute', top: 0, left: 0, width: '20%', height: '100%', background: 'linear-gradient(90deg, transparent, rgba(237,232,220,0.8), transparent)' }}
            />
          )}
        </div>
      </div>

      {/* 2. CABEÇALHO DO PASSO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        <motion.div
           animate={isActive ? { textShadow: ['0 0 0px #BF8F3C', '0 0 8px rgba(191,143,60,0.5)', '0 0 0px #BF8F3C'] } : {}}
           transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
           style={{ color: isActive ? '#BF8F3C' : isDone ? '#EDE8DC' : '#565450' }}
        >
          <span style={{ opacity: 0.5, marginRight: 8 }}>0{index + 1}</span>
          {step.label}
        </motion.div>
        
        {/* Relógio pulsante se ativo */}
        <motion.div
           animate={isActive ? { opacity: [0.4, 1, 0.4] } : {}}
           transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
           style={{ color: isActive ? '#BF8F3C' : '#565450' }}
        >
           {step.time}
        </motion.div>
      </div>

      {/* 3. STATUS E TELEMETRIA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontFamily: "'DM Mono', monospace", fontSize: '8px', letterSpacing: '0.2em' }}>
        <div style={{ color: isActive ? '#BF8F3C' : '#565450', display: 'flex', alignItems: 'center', height: 10 }}>
          {isDone ? 'CONCLUÍDO' : isActive ? (
            <>
              EM ANDAMENTO
              {/* O Cursor de Terminal piscando */}
              <motion.span
                animate={{ opacity: [1, 1, 0, 0, 1] }}
                transition={{ repeat: Infinity, duration: 0.8, ease: "linear", times: [0, 0.49, 0.5, 0.99, 1] }}
                style={{ display: 'inline-block', width: 4, height: 9, backgroundColor: '#BF8F3C', marginLeft: 6 }}
              />
            </>
          ) : 'AGUARDANDO'}
        </div>
        
        {/* A Mágica: Hex Code mudando insanamente rápido */}
        {isActive && (
          <div style={{ color: '#8C8880', opacity: 0.7 }}>
            {telemetry}
          </div>
        )}
      </div>
    </motion.div>
  )
}

function SessionMovieRow({ movie, index, router }: any) {
  const [isHovered, setIsHovered] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(14.2);

  // O "Motor de Vida": Flutua a velocidade do download para parecer real
  useEffect(() => {
    if (movie.status !== 'downloading') return;
    const interval = setInterval(() => {
      setCurrentSpeed(prev => {
        const fluctuation = (Math.random() * 1.5) - 0.5; 
        return Math.max(9.5, Math.min(18.4, prev + fluctuation)); 
      });
    }, 1200);
    return () => clearInterval(interval);
  }, [movie.status]);

  return (
    <motion.div 
      layout
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      initial={{ opacity: 0, x: -20 }} 
      animate={{ opacity: 1, x: 0 }} 
      transition={{ delay: 0.5 + (index * 0.1), duration: 0.8, ease: FINE_ART_EASE }}
      style={{ 
        display: 'grid', 
        gridTemplateColumns: '40px 90px 1fr 240px', // LARGURAS AUMENTADAS (Evita os cortes)
        gap: 40, alignItems: 'center', 
        padding: '32px 24px', // PADDING INSERIDO (O conteúdo agora respira)
        borderBottom: '1px solid rgba(237,232,220,0.05)',
        backgroundColor: isHovered ? 'rgba(237,232,220,0.02)' : movie.status === 'downloading' ? 'rgba(237,232,220,0.01)' : 'transparent',
        borderRadius: 16, marginLeft: -24, marginRight: -24 // Truque ótico para o hover não espremer o grid original
      }}
    >
      {/* 1. Número */}
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#565450' }}>
        {String(index + 1).padStart(3, '0')}
      </div>
      
      {/* 2. Pôster Geométrico */}
      <motion.div 
        animate={{ scale: isHovered ? 1.05 : 1 }} transition={{ duration: 0.6, ease: FINE_ART_EASE }}
        style={{ aspectRatio: '2/3', overflow: 'hidden', backgroundColor: '#040402', border: '1px solid rgba(237,232,220,0.05)' }}
      >
        <motion.img 
          src={movie.poster} alt={movie.title} 
          animate={{ filter: isHovered ? 'grayscale(0%) contrast(1.1)' : movie.status === 'pending' ? 'grayscale(100%) opacity(0.3)' : 'grayscale(30%) contrast(1)' }}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
        />
      </motion.div>
      
      {/* 3. Título, Progressão e Expansão Técnica */}
      <div style={{ display: 'flex', flexDirection: 'column', paddingRight: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
          <motion.h3 
            animate={{ color: isHovered ? '#FFFFFF' : movie.status === 'pending' ? '#565450' : '#EDE8DC', x: isHovered ? 4 : 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', margin: 0, lineHeight: 1 }}
          >
            {movie.title}
          </motion.h3>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#565450', letterSpacing: '0.15em' }}>
            {movie.size}
          </span>
        </div>
        
        {/* Progress Bar Shimmer */}
        <div style={{ width: '100%', height: 1, backgroundColor: 'rgba(237,232,220,0.1)', position: 'relative', overflow: 'hidden' }}>
          <motion.div 
            initial={{ width: 0 }} animate={{ width: `${movie.progress}%` }} transition={{ duration: 1.5, ease: FINE_ART_EASE }}
            style={{ 
              position: 'absolute', top: 0, left: 0, height: 1, 
              backgroundColor: movie.status === 'ready' ? '#EDE8DC' : '#BF8F3C',
              boxShadow: movie.status === 'downloading' ? '0 0 10px rgba(191,143,60,0.5)' : 'none'
            }} 
          />
          {movie.status === 'downloading' && (
            <motion.div 
              animate={{ x: ['-100%', '300%'] }} transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
              style={{ position: 'absolute', top: 0, left: 0, width: '30%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent)' }}
            />
          )}
        </div>

        {/* Expansão do Console de Metadados */}
        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.6, ease: FINE_ART_EASE }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ 
                marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(191,143,60,0.2)',
                display: 'flex', flexDirection: 'column', gap: 8,
                fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em'
              }}>
                <span style={{ color: '#8C8880' }}>[STREAM_DATA] {movie.specs}</span>
                <span style={{ color: '#BF8F3C' }}>[DIRETÓRIO] //SRV/MEDIA/CINEMA/{movie.title.replace(/\s/g, '_').toUpperCase()}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 4. Status e Botão PRONTO */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
        <motion.span 
          animate={movie.status === 'downloading' ? { opacity: [1, 0.5, 1] } : { opacity: 1 }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.1em', color: movie.status === 'ready' ? '#EDE8DC' : movie.status === 'downloading' ? '#BF8F3C' : '#565450', textTransform: 'uppercase', textAlign: 'right' }}
        >
          {movie.status === 'ready' ? 'INTEGRIDADE VERIFICADA' : movie.status === 'downloading' ? `AQUISIÇÃO... ${movie.progress}%` : 'AGUARDANDO'}
        </motion.span>
        
        {/* A Mágica do Speed: O número flutua no HTML! */}
        {movie.status === 'downloading' && (
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', color: '#8C8880', letterSpacing: '0.2em' }}>
            {currentSpeed.toFixed(1)} MB/S
          </span>
        )}

        {movie.status === 'ready' && (
          <motion.button 
            onClick={() => router.push(`/player?id=${movie.id}`)}
            whileHover={{ backgroundColor: '#EDE8DC', color: '#080806', scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            style={{ 
              background: 'transparent', border: '1px solid rgba(237,232,220,0.2)', color: '#EDE8DC', 
              padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
              fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em',
            }}
          >
            <Play style={{ width: 10, height: 10 }} /> PRONTO
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

export default function Session() {

  const router = useRouter();

  const steps = [
    { label: "Planejamento", status: "done", time: "19:00" },
    { label: "Busca de Mídia", status: "done", time: "19:02" },
    { label: "Download", status: "active", time: "Agora" },
    { label: "Sessão Pronta", status: "pending", time: "~19:45" },
  ];

  const movies = [
    { id: 1, title: "L'Avventura", poster: "/images/posters/lavventura.jpg", status: "ready", progress: 100, size: "86.4 GB", specs: "VIDEO: 4K REMUX HEVC 10-BIT // AUDIO: DTS-HD MA 1.0 Mono" },
    { id: 2, title: "Stalker", poster: "/images/posters/stalker.jpg", status: "downloading", progress: 68, size: "75.2 GB", specs: "VIDEO: 4K HDR10 HEVC // AUDIO: RUSSIAN LPCM 2.0" },
    { id: 3, title: "Persona", poster: "/images/posters/persona.jpg", status: "pending", progress: 0, size: "45.1 GB", specs: "VIDEO: 1080P REMUX AVC // AUDIO: SWEDISH LPCM 2.0" },
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#080806', color: '#EDE8DC', paddingBottom: 120 }}>
      {/* Ruído Cinematográfico */}
      <div className="fixed inset-0 bg-noise opacity-[0.03] mix-blend-overlay pointer-events-none z-50" />
      
      {/* Note que a <Sidebar /> foi removida para evitar duplicação com o layout.tsx, como fizemos na Library */}

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '120px 72px 0' }}>
        
        {/* ── CABEÇALHO DA SESSÃO (Manifesto) ── */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, ease: FINE_ART_EASE }}
          style={{ display: 'flex', flexDirection: 'column', marginBottom: 80 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid rgba(237,232,220,0.05)', paddingBottom: 32 }}>
            <div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#BF8F3C', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 16 }}>
                [ MANIFESTO DA SESSÃO ]
              </div>
              <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(4rem, 6vw, 5.5rem)', fontWeight: 400, margin: 0, lineHeight: 1, letterSpacing: '-0.02em' }}>
                Noite Atmosférica.
              </h1>
            </div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#565450', letterSpacing: '0.15em', textTransform: 'uppercase', textAlign: 'right' }}>
              <div>PROJEÇÃO AGENDADA</div>
              <div style={{ color: '#EDE8DC', marginTop: 4 }}>HOJE, 19:45</div>
            </div>
          </div>
          
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.8rem', color: '#8C8880', fontStyle: 'italic', margin: '32px 0 0 0', maxWidth: 800 }}>
            Uma jornada por filmes contemplativos e visualmente impressionantes.
          </p>
        </motion.div>

        {/* ── TIMELINE (Telemetria do Sistema) ── */}
        <motion.div 
          initial="hidden" 
          animate="visible"
          variants={{
            visible: { transition: { staggerChildren: 0.2 } }
          }}
          style={{ marginBottom: 100 }}
        >
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#565450', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 24 }}>
            [ PROGRESSO DA ORQUESTRAÇÃO ]
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
            {steps.map((step, i) => (
              <TelemetryStep key={i} step={step} index={i} />
            ))}
          </div>
        </motion.div>

        {/* ── FILA DE MÍDIA (O Rolo de Filme) ── */}
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4, duration: 1, ease: FINE_ART_EASE }}
          style={{ marginBottom: 80 }}
        >
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#565450', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 24, borderBottom: '1px solid rgba(237,232,220,0.05)', paddingBottom: 16 }}>
            [ FILA DE EXIBIÇÃO ]
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
            {movies.map((movie, i) => (
              <SessionMovieRow 
                key={movie.id} 
                movie={movie} 
                index={i} 
                router={router} 
              />
            ))}
          </div>
          </div>
        </motion.div>

        {/* ── BARRA DE COMANDO PRINCIPAL (Action Bar Animada) ── */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8, duration: 1, ease: FINE_ART_EASE }}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(237,232,220,0.05)', paddingTop: 40 }}
        >
          {/* Botão Primário (Agora funciona e tem gravidade) */}
          <motion.button 
            onClick={() => router.push('/player')}
            whileHover={{ scale: 1.02, backgroundColor: '#d4a34b' }}
            whileTap={{ scale: 0.98 }}
            style={{ 
              backgroundColor: '#BF8F3C', color: '#080806', border: 'none', padding: '16px 32px', cursor: 'pointer',
              fontFamily: "'DM Mono', monospace", fontSize: '11px', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase',
              display: 'flex', alignItems: 'center', gap: 12
            }}
          >
            [ INICIAR PROJEÇÃO ] 
            <motion.div animate={{ x: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}>
              <ArrowRight style={{ width: 14, height: 14 }} />
            </motion.div>
          </motion.button>

          {/* Configurações de Sistema (Com hover sutil de escala e cor) */}
          <div style={{ display: 'flex', gap: 32 }}>
            <motion.button 
              whileHover={{ color: '#EDE8DC', y: -2 }}
              whileTap={{ scale: 0.95 }}
              style={{ 
                background: 'transparent', border: 'none', color: '#565450', cursor: 'pointer',
                fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase',
                display: 'flex', alignItems: 'center', gap: 8
              }}
            >
              <Cast style={{ width: 12, height: 12 }} /> CAST DE TELA
            </motion.button>
            <motion.button 
              whileHover={{ color: '#EDE8DC', y: -2 }}
              whileTap={{ scale: 0.95 }}
              style={{ 
                background: 'transparent', border: 'none', color: '#565450', cursor: 'pointer',
                fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase',
                display: 'flex', alignItems: 'center', gap: 8
              }}
            >
              <SlidersHorizontal style={{ width: 12, height: 12 }} /> AUTO-QUALITY
            </motion.button>
            <motion.button 
              whileHover={{ color: '#EDE8DC', y: -2 }}
              whileTap={{ scale: 0.95 }}
              style={{ 
                background: 'transparent', border: 'none', color: '#565450', cursor: 'pointer',
                fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase'
              }}
            >
              [ SYNC PLEX ]
            </motion.button>
          </div>
        </motion.div>

      </main>
    </div>
  );
}