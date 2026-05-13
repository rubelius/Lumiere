'use client';
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { 
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, 
  Maximize, Minimize, Settings2, MessageSquare, Info, SignalHigh,
  ChevronLeft, ArrowLeft
} from "lucide-react";
import { useRouter } from "next/navigation";

const FINE_ART_EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];



// ── 1. DEFINIÇÃO DE VARIANTS (Coreografia de Vida) ──

const panelVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1, 
    transition: { 
      duration: 0.6, 
      ease: FINE_ART_EASE, 
      staggerChildren: 0.08, 
      delayChildren: 0.1 
    } 
  },
  exit: { opacity: 0, transition: { duration: 0.4, ease: FINE_ART_EASE } }
};

const barVariants: Variants = {
  hidden: { y: -20, opacity: 0 },
  visible: { 
    y: 0, opacity: 1, 
    transition: { duration: 0.8, ease: FINE_ART_EASE, staggerChildren: 0.1 } 
  },
  exit: { y: -10, opacity: 0, transition: { duration: 0.4, ease: FINE_ART_EASE } }
};

const bottomVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: { 
    y: 0, opacity: 1, 
    transition: { duration: 0.8, ease: FINE_ART_EASE, staggerChildren: 0.1 } 
  },
  exit: { y: 10, opacity: 0, transition: { duration: 0.4, ease: FINE_ART_EASE } }
};

const itemVariants: Variants = {
  hidden: { y: 10, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { duration: 0.6, ease: FINE_ART_EASE } }
};

const settingsItemVariants: Variants = {
  hidden: { x: -10, opacity: 0 },
  visible: { x: 0, opacity: 1, transition: { duration: 0.5, ease: FINE_ART_EASE } }
};


export default function Player() {
  const router = useRouter();
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [progress, setProgress] = useState(35);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSubtitles, setShowSubtitles] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState("Original (4K HDR REMUX)");
  const [selectedAudio, setSelectedAudio] = useState("English (TrueHD 7.1)");
  const [selectedSubtitle, setSelectedSubtitle] = useState("Português (Brasil)");
  
  // Terminal Tabs (Substitui as "abas de iOS")
  const [activeTab, setActiveTab] = useState<"video" | "audio" | "sub">("video"); 
  
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-hide controls
  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      
      if (isPlaying) {
        controlsTimeoutRef.current = setTimeout(() => {
          if (!showSettings) {
            setShowControls(false);
          }
        }, 3000);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [isPlaying, showSettings]);

  const togglePlay = () => setIsPlaying(!isPlaying);
  const toggleMute = () => setIsMuted(!isMuted);
  const toggleFullscreen = () => setIsFullscreen(!isFullscreen);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const totalTime = 8580; // 2h 23m
  const currentTime = (progress / 100) * totalTime;

  return (
    <div className={`fixed inset-0 bg-[#040402] text-[#EDE8DC] overflow-hidden ${!showControls && isPlaying ? 'cursor-none' : ''}`} style={{ fontFamily: "'DM Mono', monospace" }}>
      
      {/* Fake Video Background (Litográfico) */}
      <div className="absolute inset-0">
        <img 
          src={"/images/backgrounds/chefao.jpg"}
          alt="Movie" 
          className="w-full h-full object-cover"
          style={{
            transform: isPlaying ? 'scale(1.02)' : 'scale(1)',
            transition: 'transform 30s ease-linear',
            filter: 'grayscale(30%) contrast(1.1) brightness(0.6)'
          }}
        />
        {/* Vignette mais dramática para as bordas e ruído */}
        <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at center, transparent 30%, rgba(4,4,2,0.8) 100%)' }} />
        <div className="absolute inset-0 bg-noise opacity-[0.04] mix-blend-overlay pointer-events-none" />
      </div>

      {/* Network / Buffer Warning (Telemetria) */}
      {!isPlaying && progress === 0 && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-6 z-40">
          <motion.div 
            animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
            style={{ width: 40, height: 40, border: '1px solid rgba(237,232,220,0.1)', borderTop: '1px solid #BF8F3C', borderRadius: '50%' }} 
          />
          <div style={{ fontSize: '9px', letterSpacing: '0.2em', color: '#BF8F3C', textTransform: 'uppercase' }}>
            AQUISIÇÃO DE STREAM... [86.4 GB]
          </div>
        </div>
      )}

      {/* TOP BAR (Identificação do Rolo de Filme com Cascata) */}
      <AnimatePresence>
        {showControls && (
          <motion.div 
            initial="hidden" animate="visible" exit="exit" variants={barVariants}
            className="absolute top-0 left-0 right-0 p-12 flex items-start justify-between z-50"
            style={{ background: 'linear-gradient(to bottom, rgba(4,4,2,0.9) 0%, transparent 100%)', display: 'flex', gap: 24 }}
          >
            {/* Bloco Esquerdo: Título e Retorno */}
            <motion.div variants={itemVariants} className="flex items-center gap-8">
              <motion.button 
                onClick={() => router.back()}
                whileHover={{ borderColor: '#BF8F3C', color: '#BF8F3C', scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                style={{ background: 'transparent', border: '1px solid rgba(237,232,220,0.2)', width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EDE8DC', cursor: 'pointer' }}
              >
                <ArrowLeft style={{ width: 16, height: 16 }} />
              </motion.button>
              
              <div>
                <motion.h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.5rem', fontWeight: 400, margin: '0 0 8px 0', lineHeight: 1 }}>
                  L'Avventura
                </motion.h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: '9px', letterSpacing: '0.15em', color: '#8C8880' }}>
                  <span style={{ color: '#BF8F3C', border: '1px solid rgba(191,143,60,0.4)', padding: '2px 6px', background: 'rgba(191,143,60,0.1)' }}>4K HDR REMUX</span>
                  <span>1960</span>
                  <span>MICHELANGELO ANTONIONI</span>
                </div>
              </div>
            </motion.div>

            {/* Bloco Direito: Telemetria de Rede */}
            <motion.div variants={itemVariants} className="flex items-center gap-6">
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '8px 16px', border: '1px solid rgba(237,232,220,0.1)', background: 'rgba(4,4,2,0.6)', fontSize: '9px', letterSpacing: '0.1em' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#BF8F3C' }}>
                  <SignalHigh style={{ width: 12, height: 12 }} /> 145 MBPS
                </div>
                <div style={{ width: 1, height: 12, backgroundColor: 'rgba(237,232,220,0.2)' }} />
                <span style={{ color: '#8C8880' }}>DIRECT PLAY</span>
              </div>
              <button style={{ background: 'transparent', border: 'none', color: '#565450', cursor: 'pointer' }}>
                <Info style={{ width: 16, height: 16 }} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MAIN CONTROLS (Mesa de Corte com Cascata) */}
      <AnimatePresence>
        {showControls && (
          <motion.div 
            initial="hidden" animate="visible" exit="exit" variants={bottomVariants}
            className="absolute bottom-0 left-0 right-0 p-12 z-50 flex flex-col gap-8"
            style={{ background: 'linear-gradient(to top, rgba(4,4,2,0.95) 0%, transparent 100%)' }}
          >
            {/* Timeline (Precision Scrubber com Shimmer Vivo) */}
            <motion.div variants={itemVariants} className="flex items-center gap-6 group">
              <span style={{ fontSize: '10px', letterSpacing: '0.1em', color: '#BF8F3C', width: 48, textAlign: 'right' }}>
                {formatTime(currentTime)}
              </span>
              
              <div className="flex-1 relative cursor-pointer flex items-center" style={{ height: 24 }} onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const percent = ((e.clientX - rect.left) / rect.width) * 100;
                setProgress(Math.max(0, Math.min(100, percent)));
              }}>
                {/* Linha de Base (1px) */}
                <div style={{ position: 'absolute', top: 11, left: 0, right: 0, height: 1, backgroundColor: 'rgba(237,232,220,0.1)' }} />
                
                {/* Linha de Buffer com Shimmer Vivo */}
                <div style={{ position: 'absolute', top: 11, left: 0, height: 1, backgroundColor: 'rgba(237,232,220,0.25)', width: `${progress + 15}%`, overflow: 'hidden' }}>
                    <motion.div 
                      animate={{ x: ['-100%', '300%'] }} transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                      style={{ position: 'absolute', top: 0, left: 0, width: '30%', height: '100%', background: 'linear-gradient(90deg, transparent, rgba(237,232,220,0.4), transparent)' }}
                    />
                </div>
                
                {/* Linha de Progresso (Dourada) */}
                <div style={{ position: 'absolute', top: 11, left: 0, height: 1, backgroundColor: '#BF8F3C', width: `${progress}%` }} />
                
                {/* Playhead Marker (Cirúrgico e Pulsante) */}
                <motion.div 
                  animate={{ boxShadow: ['0 0 10px rgba(237,232,220,0.8)', '0 0 15px rgba(237,232,220,1)', '0 0 10px rgba(237,232,220,0.8)'] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  style={{ 
                    position: 'absolute', top: 6, width: 2, height: 12, backgroundColor: '#EDE8DC', 
                    left: `${progress}%`, transform: 'translateX(-50%)',
                  }}
                />
                
                {/* Marcadores de Capítulo (Marcas de Corte) */}
                <div style={{ position: 'absolute', top: 8, left: '25%', width: 1, height: 8, backgroundColor: '#565450' }} />
                <div style={{ position: 'absolute', top: 8, left: '60%', width: 1, height: 8, backgroundColor: '#565450' }} />
              </div>
              
              <span style={{ fontSize: '10px', letterSpacing: '0.1em', color: '#565450', width: 48 }}>
                {formatTime(totalTime)}
              </span>
            </motion.div>

            {/* Controls Row (Hardware Buttons com Cascata) */}
            <div className="flex items-center justify-between">
              
              {/* Bloco Esquerdo: Transporte */}
              <motion.div variants={itemVariants} className="flex items-center gap-10">
                <div className="flex items-center gap-6">
                  <button style={{ background: 'transparent', border: 'none', color: '#8C8880', cursor: 'pointer', transition: 'color 0.3s' }} onMouseEnter={e => e.currentTarget.style.color = '#EDE8DC'} onMouseLeave={e => e.currentTarget.style.color = '#8C8880'}>
                    <SkipBack style={{ width: 16, height: 16 }} />
                  </button>
                  
                  {/* Botão Play Gigante, Geométrico e com Feedback Físico */}
                  <motion.button 
                    onClick={togglePlay} 
                    whileHover={{ backgroundColor: '#BF8F3C', color: '#040402', scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{ 
                      width: 56, height: 56, border: '1px solid #BF8F3C', background: 'rgba(191,143,60,0.1)', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#BF8F3C', cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                      {isPlaying ? <Pause style={{ width: 20, height: 20 }} /> : <Play style={{ width: 20, height: 20, marginLeft: 4 }} />}
                    </div>
                  </motion.button>
                  
                  <button style={{ background: 'transparent', border: 'none', color: '#8C8880', cursor: 'pointer', transition: 'color 0.3s' }} onMouseEnter={e => e.currentTarget.style.color = '#EDE8DC'} onMouseLeave={e => e.currentTarget.style.color = '#8C8880'}>
                    <SkipForward style={{ width: 16, height: 16 }} />
                  </button>
                </div>

                {/* Bloco de Volume Estilo Mesa de Som (Fader Vertical) */}
                <motion.div whileHover="hover" initial="rest" animate="rest" className="flex items-center gap-4 cursor-pointer">
                  <motion.button 
                    onClick={toggleMute} 
                    variants={{ rest: { color: '#565450', scale: 1 }, hover: { color: '#EDE8DC', scale: 1.1 } }}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    {isMuted || volume === 0 ? <VolumeX style={{ width: 14, height: 14 }} /> : <Volume2 style={{ width: 14, height: 14 }} />}
                  </motion.button>
                  
                  {/* Slider de Volume Interativo */}
                  <div style={{ width: 60, height: 24, display: 'flex', alignItems: 'center', position: 'relative' }}>
                     {/* Linha de Base Fixa (1px) */}
                     <div style={{ width: '100%', height: 1, backgroundColor: 'rgba(237,232,220,0.1)' }} />
                     
                     {/* Linha de Progresso (Dourada e Engrossa no hover) */}
                     <motion.div 
                       variants={{ rest: { height: 1 }, hover: { height: 2 } }}
                       style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: `${isMuted ? 0 : volume}%`, backgroundColor: '#BF8F3C' }} 
                     />
                     
                     {/* Pino de Ajuste: Linha Vertical */}
                     <motion.div 
                       variants={{ rest: { opacity: 0, scaleY: 0 }, hover: { opacity: 1, scaleY: 1 } }}
                       transition={{ duration: 0.3 }}
                       style={{ 
                         position: 'absolute', left: `${isMuted ? 0 : volume}%`, top: 6, 
                         width: 1, height: 12, backgroundColor: '#EDE8DC', 
                         transform: 'translateX(-50%)', // Centraliza o pino
                         boxShadow: '0 0 5px rgba(237,232,220,0.8)' 
                       }}
                     />
                  </div>
                  <motion.span variants={{ rest: { color: '#565450' }, hover: { color: '#EDE8DC' } }} style={{ fontSize: '9px', width: 20, textAlign: 'left' }}>
                    {isMuted ? '00' : volume.toString().padStart(2, '0')}
                  </motion.span>
                </motion.div>
              </motion.div>

              {/* Bloco Direito: Ferramentas */}
              <motion.div variants={itemVariants} className="flex items-center gap-8">
                
                {/* Telemetria de Nó Cacheado (Real-Debrid) */}
                <motion.div 
                  whileHover={{ backgroundColor: 'rgba(191,143,60,0.1)', borderColor: 'rgba(191,143,60,0.5)', scale: 1.02 }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', border: '1px solid rgba(191,143,60,0.2)', fontSize: '8px', letterSpacing: '0.2em', color: '#BF8F3C', cursor: 'default' }}
                >
                  <motion.div animate={{ opacity: [1, 0, 1] }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }} style={{ width: 4, height: 4, backgroundColor: '#BF8F3C' }} />
                  RD CACHE // SECURE
                </motion.div>

                <div style={{ display: 'flex', gap: 24 }}>
                  <motion.button 
                    onClick={() => setShowSubtitles(!showSubtitles)}
                    whileHover={{ scale: 1.15, color: showSubtitles ? '#BF8F3C' : '#EDE8DC', y: -2 }}
                    whileTap={{ scale: 0.9 }}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: showSubtitles ? '#BF8F3C' : '#565450', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
                  >
                    <MessageSquare style={{ width: 16, height: 16 }} />
                    {showSubtitles && <div style={{ width: 2, height: 2, backgroundColor: '#BF8F3C' }} />}
                  </motion.button>
                  
                  <motion.button 
                    onClick={() => setShowSettings(!showSettings)}
                    whileHover={{ scale: 1.15, color: showSettings ? '#BF8F3C' : '#EDE8DC', y: -2 }}
                    whileTap={{ scale: 0.9 }}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: showSettings ? '#BF8F3C' : '#565450', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
                  >
                    <Settings2 style={{ width: 16, height: 16 }} />
                    {showSettings && <div style={{ width: 2, height: 2, backgroundColor: '#BF8F3C' }} />}
                  </motion.button>

                  <motion.button 
                    onClick={toggleFullscreen}
                    whileHover={{ scale: 1.15, color: '#EDE8DC', y: -2 }}
                    whileTap={{ scale: 0.9 }}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#8C8880' }}
                  >
                    {isFullscreen ? <Minimize style={{ width: 16, height: 16 }} /> : <Maximize style={{ width: 16, height: 16 }} />}
                  </motion.button>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PAINEL DE DIAGNÓSTICO (Agora Orquestrado com Cascata) */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial="hidden" animate="visible" exit="exit" variants={panelVariants}
            className="absolute bottom-40 right-12 z-50"
            style={{ width: 400, background: 'rgba(4,4,2,0.98)', border: '1px solid rgba(237,232,220,0.1)', padding: 32 }}
          >
            {/* Navegação Interna (Tabs) */}
            <motion.div variants={settingsItemVariants} style={{ display: 'flex', gap: 24, borderBottom: '1px solid rgba(237,232,220,0.05)', paddingBottom: 16, marginBottom: 24 }}>
              {['video', 'audio', 'sub'].map(tab => (
                <button 
                  key={tab} onClick={() => setActiveTab(tab as any)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: activeTab === tab ? '#BF8F3C' : '#565450', padding: 0 }}
                >
                  [{tab}]
                </button>
              ))}
            </motion.div>
            
            {/* Conteúdo Técnico (Com interatividade real) */}
            <motion.div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 24, paddingRight: 10 }} className="scrollbar-terminal">
              
              {activeTab === 'video' && (
                <>
                  <motion.div variants={settingsItemVariants}>
                    <div style={{ fontSize: '8px', color: '#565450', letterSpacing: '0.2em', marginBottom: 12 }}>// FONTE DE REPRODUÇÃO</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {["Original (4K HDR REMUX)", "1080P (TRANSCODE)", "720P (TRANSCODE)"].map((quality, i) => {
                        const isSelected = selectedQuality === quality;
                        return (
                          <motion.button 
                            key={quality}
                            onClick={() => setSelectedQuality(quality)}
                            whileHover={{ borderColor: isSelected ? '#BF8F3C' : 'rgba(237,232,220,0.3)', backgroundColor: isSelected ? 'rgba(191,143,60,0.05)' : 'rgba(237,232,220,0.02)', x: 4 }}
                            whileTap={{ scale: 0.98 }}
                            style={{ 
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', 
                                border: isSelected ? '1px solid #BF8F3C' : '1px solid rgba(237,232,220,0.05)', 
                                backgroundColor: isSelected ? 'rgba(191,143,60,0.05)' : 'transparent',
                                cursor: 'pointer', transition: 'border-color 0.3s',
                                fontFamily: "'DM Mono', monospace", width: '100%'
                            }}
                          >
                            <span style={{ fontSize: '10px', color: isSelected ? '#EDE8DC' : '#8C8880', textTransform: 'uppercase' }}>{quality}</span>
                            <span style={{ fontSize: '9px', color: isSelected ? '#BF8F3C' : '#565450' }}>
                                {i === 0 ? "145 MBPS" : i === 1 ? "20 MBPS" : "8 MBPS"}
                            </span>
                          </motion.button>
                        )
                      })}
                    </div>
                  </motion.div>
                  
                  <motion.div variants={settingsItemVariants} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '10px', color: '#EDE8DC', marginBottom: 4 }}>HDR TONE MAPPING</div>
                      <div style={{ fontSize: '8px', color: '#565450', letterSpacing: '0.1em' }}>AUTO-DIAGNOSTIC</div>
                    </div>
                    {/* Switch Geométrico */}
                    <motion.div 
                      whileHover={{ scale: 1.1 }}
                      style={{ width: 32, height: 16, border: '1px solid #BF8F3C', position: 'relative', cursor: 'pointer', transition: 'all 0.3s', backgroundColor: 'rgba(191,143,60,0.1)' }}
                    >
                      <motion.div animate={{ x: [-2, 0, -2] }} transition={{ repeat: Infinity, duration: 1.5 }} style={{ position: 'absolute', top: 2, right: 2, width: 10, height: 10, backgroundColor: '#BF8F3C' }} />
                    </motion.div>
                  </motion.div>
                </>
              )}
              
              {activeTab === 'audio' && (
                <>
                  <motion.div variants={settingsItemVariants} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[ { name: "English (TrueHD 7.1)", specs: "DIRECT PLAY // MASTER AUDIO" }, { name: "Italiano (AC3 5.1)", specs: "COMPATIBILIDADE // TRANSCODE" } ].map(audio => {
                        const isSelected = selectedAudio === audio.name;
                        return (
                            <motion.button 
                              key={audio.name}
                              onClick={() => setSelectedAudio(audio.name)}
                              whileHover={{ borderColor: isSelected ? '#BF8F3C' : 'rgba(237,232,220,0.1)', x: 4 }}
                              whileTap={{ scale: 0.98 }}
                              style={{ 
                                display: 'flex', gap: 12, padding: '12px', border: isSelected ? '1px solid #BF8F3C' : '1px solid rgba(237,232,220,0.05)', 
                                backgroundColor: isSelected ? 'rgba(191,143,60,0.05)' : 'transparent',
                                cursor: 'pointer', textAlign: 'left', width: '100%', fontFamily: "'DM Mono', monospace", transition: 'border-color 0.3s'
                              }}
                            >
                                <div style={{ width: 4, height: 4, backgroundColor: isSelected ? '#BF8F3C' : 'transparent', border: isSelected ? 'none' : '1px solid #565450', marginTop: 4, flexShrink: 0 }} />
                                <div>
                                    <div style={{ fontSize: '10px', color: isSelected ? '#EDE8DC' : '#8C8880', marginBottom: 4, textTransform: 'uppercase' }}>{audio.name}</div>
                                    <div style={{ fontSize: '8px', color: isSelected ? '#BF8F3C' : '#565450', letterSpacing: '0.1em' }}>{audio.specs}</div>
                                </div>
                            </motion.button>
                        )
                    })}
                  </motion.div>
                  
                  <motion.div variants={settingsItemVariants}>
                    <div style={{ fontSize: '8px', color: '#565450', letterSpacing: '0.2em', marginBottom: 12 }}>// OFFSET (SYNC PLEX)</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <motion.button whileHover={{ backgroundColor: 'rgba(237,232,220,0.1)', borderColor: 'rgba(237,232,220,0.3)' }} whileTap={{ scale: 0.9 }} style={{ background: 'transparent', border: '1px solid rgba(237,232,220,0.2)', color: '#EDE8DC', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>-</motion.button>
                      <div style={{ flex: 1, textAlign: 'center', fontSize: '10px', color: '#BF8F3C' }}>0 MS</div>
                      <motion.button whileHover={{ backgroundColor: 'rgba(237,232,220,0.1)', borderColor: 'rgba(237,232,220,0.3)' }} whileTap={{ scale: 0.9 }} style={{ background: 'transparent', border: '1px solid rgba(237,232,220,0.2)', color: '#EDE8DC', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>+</motion.button>
                    </div>
                  </motion.div>
                </>
              )}

              {activeTab === 'sub' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[ "Desativado", "Português (Brasil)", "Português (Portugal)", "English (SDH)" ].map(sub => {
                    const isSelected = selectedSubtitle === sub;
                    return (
                      <motion.button 
                        key={sub}
                        onClick={() => setSelectedSubtitle(sub)}
                        whileHover={{ borderColor: isSelected ? '#BF8F3C' : 'rgba(237,232,220,0.15)', x: 4 }}
                        whileTap={{ scale: 0.98 }}
                        style={{ 
                          display: 'flex', gap: 12, padding: '12px', 
                          // A borda agora depende estritamente do isSelected
                          border: isSelected ? '1px solid #BF8F3C' : '1px solid rgba(237,232,220,0.05)', 
                          backgroundColor: isSelected ? 'rgba(191,143,60,0.05)' : 'transparent',
                          cursor: 'pointer', textAlign: 'left', width: '100%', fontFamily: "'DM Mono', monospace", transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ 
                          width: 4, height: 4, 
                          backgroundColor: isSelected ? '#BF8F3C' : 'transparent', 
                          border: isSelected ? 'none' : '1px solid #565450', 
                          marginTop: 4, flexShrink: 0 
                        }} />
                        <div style={{ 
                          fontSize: '10px', 
                          color: isSelected ? '#EDE8DC' : '#8C8880', 
                          textTransform: 'uppercase' 
                        }}>{sub}</div>
                      </motion.button>
                    )
                  })}
                </div>
              )}

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Simulated Subtitles overlay (Cormorant Itálico) */}
      {showControls && progress > 10 && progress < 80 && (
        <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.8 }}
            className="absolute bottom-40 left-1/2 -translate-x-1/2 text-center pointer-events-none z-40"
        >
          <p style={{ 
            fontFamily: "'Cormorant Garamond', serif", fontSize: '2.5rem', fontStyle: 'italic', color: '#FFFFFF',
            textShadow: '0 2px 10px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,1)'
          }}>
            A ilha está completamente vazia.
          </p>
        </motion.div>
      )}
    </div>
  );
}