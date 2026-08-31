'use client';

import { motion, AnimatePresence, Variants } from "framer-motion";
import { 
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, 
  Maximize, Minimize, Settings2, MessageSquare, Info, SignalHigh,
  ArrowLeft, Tv, MonitorPlay, Cast
} from "lucide-react";

const FINE_ART_EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

export const panelVariants: Variants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.6, ease: FINE_ART_EASE, staggerChildren: 0.08, delayChildren: 0.1 } }, exit: { opacity: 0, transition: { duration: 0.4, ease: FINE_ART_EASE } } };
export const barVariants: Variants = { hidden: { y: -20, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { duration: 0.8, ease: FINE_ART_EASE, staggerChildren: 0.1 } }, exit: { y: -10, opacity: 0, transition: { duration: 0.4, ease: FINE_ART_EASE } } };
export const bottomVariants: Variants = { hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { duration: 0.8, ease: FINE_ART_EASE, staggerChildren: 0.1 } }, exit: { y: 10, opacity: 0, transition: { duration: 0.4, ease: FINE_ART_EASE } } };
export const itemVariants: Variants = { hidden: { y: 10, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { duration: 0.6, ease: FINE_ART_EASE } } };
export const settingsItemVariants: Variants = { hidden: { x: -10, opacity: 0 }, visible: { x: 0, opacity: 1, transition: { duration: 0.5, ease: FINE_ART_EASE } } };

// ── 1. TOP BAR ──
export function PlayerTopBar({ onBack, title, playbackMode }: any) {
  return (
    <motion.div initial="hidden" animate="visible" exit="exit" variants={barVariants} className="absolute top-0 left-0 right-0 p-12 flex items-start justify-between z-50" style={{ background: 'linear-gradient(to bottom, rgba(4,4,2,0.9) 0%, transparent 100%)', display: 'flex', gap: 24 }}>
      <motion.div variants={itemVariants} className="flex items-center gap-8">
        <motion.button onClick={onBack} whileHover={{ borderColor: 'var(--gold)', color: 'var(--gold)', scale: 1.05 }} whileTap={{ scale: 0.95 }} style={{ background: 'transparent', border: '1px solid rgba(237,232,220,0.2)', width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--film)', cursor: 'pointer' }}>
          <ArrowLeft style={{ width: 16, height: 16 }} />
        </motion.button>
        <div>
          <motion.h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.5rem', fontWeight: 400, margin: '0 0 8px 0', lineHeight: 1 }}>{title}</motion.h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: '9px', letterSpacing: '0.15em', color: 'var(--m2)' }}>
            <span style={{ color: 'var(--gold)', border: '1px solid rgba(191,143,60,0.4)', padding: '2px 6px', background: 'rgba(191,143,60,0.1)' }}>{playbackMode === "local" ? "WEB-DL 4K" : "4K HDR REMUX"}</span>
            <span>2026</span>
            <span>ARQUIVO LUMIÈRE</span>
          </div>
        </div>
      </motion.div>
      <motion.div variants={itemVariants} className="flex items-center gap-6">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '8px 16px', border: '1px solid rgba(237,232,220,0.1)', background: 'rgba(4,4,2,0.6)', fontSize: '9px', letterSpacing: '0.1em' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--gold)' }}><SignalHigh style={{ width: 12, height: 12 }} /> 145 MBPS</div>
          <div style={{ width: 1, height: 12, backgroundColor: 'rgba(237,232,220,0.2)' }} />
          <span style={{ color: 'var(--m2)' }}>{playbackMode === "local" ? "HTML5 DECODE" : "DIRECT PLAY"}</span>
        </div>
        <button style={{ background: 'transparent', border: 'none', color: 'var(--m3)', cursor: 'pointer' }}><Info style={{ width: 16, height: 16 }} /></button>
      </motion.div>
    </motion.div>
  );
}

// ── 2. MESA DE CORTE (CONTROLES INFERIORES) ──
export function PlayerBottomControls(props: any) {
  const { 
    currentTimeStr, totalTimeStr, progressPercent, bufferedPercent, onSeek, 
    isPlaying, onTogglePlay, onSkip, 
    volume, isMuted, onVolumeChange, onToggleMute, 
    activeMenu, onToggleMenu, isFullscreen, onToggleFullscreen 
  } = props;

  return (
    <motion.div initial="hidden" animate="visible" exit="exit" variants={bottomVariants} className="absolute bottom-0 left-0 right-0 p-12 z-50 flex flex-col gap-8" style={{ background: 'linear-gradient(to top, rgba(4,4,2,0.95) 0%, transparent 100%)' }}>
      
      {/* Timeline Cirúrgica */}
      <motion.div variants={itemVariants} className="flex items-center gap-6 group">
        <span style={{ fontSize: '10px', letterSpacing: '0.1em', color: 'var(--gold)', width: 48, textAlign: 'right' }}>{currentTimeStr}</span>
        
        <div className="flex-1 relative cursor-pointer flex items-center" style={{ height: 24 }} onClick={onSeek}>
          {/* Fundo da Barra */}
          <div style={{ position: 'absolute', top: 11, left: 0, right: 0, height: 1, backgroundColor: 'rgba(237,232,220,0.1)' }} />
          
          {/* 👇 CORREÇÃO 3: Barra de Buffer Real (Sólida, sem efeito fake) */}
          <div 
            style={{ 
              position: 'absolute', top: 11, left: 0, height: 1, 
              backgroundColor: 'rgba(237,232,220,0.3)', // Cinza claro semi-transparente
              width: `${bufferedPercent}%`, 
              transition: 'width 0.2s ease-out' 
            }} 
          />
          
          {/* Progresso Atual */}
          <div style={{ position: 'absolute', top: 11, left: 0, height: 1, backgroundColor: 'var(--gold)', width: `${progressPercent}%` }} />
          
          {/* Playhead Marker */}
          <motion.div 
            animate={{ boxShadow: ['0 0 10px rgba(237,232,220,0.8)', '0 0 15px rgba(237,232,220,1)', '0 0 10px rgba(237,232,220,0.8)'] }} transition={{ repeat: Infinity, duration: 1.5 }}
            style={{ position: 'absolute', top: 6, width: 2, height: 12, backgroundColor: 'var(--film)', left: `${progressPercent}%`, transform: 'translateX(-50%)' }}
          />
          
          {/* Marcadores de Capítulo */}
          <div style={{ position: 'absolute', top: 8, left: '25%', width: 1, height: 8, backgroundColor: 'var(--m3)' }} />
          <div style={{ position: 'absolute', top: 8, left: '60%', width: 1, height: 8, backgroundColor: 'var(--m3)' }} />
        </div>
        
        <span style={{ fontSize: '10px', letterSpacing: '0.1em', color: 'var(--m3)', width: 48 }}>{totalTimeStr}</span>
      </motion.div>

      {/* Hardware Buttons */}
      <div className="flex items-center justify-between">
        <motion.div variants={itemVariants} className="flex items-center gap-10">
          <div className="flex items-center gap-6">
            <button onClick={() => onSkip(-10)} style={{ background: 'transparent', border: 'none', color: 'var(--m2)', cursor: 'pointer', transition: 'color 0.3s' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--film)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--m2)'}><SkipBack style={{ width: 16, height: 16 }} /></button>
            <motion.button 
              onClick={onTogglePlay} whileHover={{ backgroundColor: 'var(--gold)', color: 'var(--void)', scale: 1.02 }} whileTap={{ scale: 0.98 }}
              style={{ width: 56, height: 56, border: '1px solid var(--gold)', background: 'rgba(191,143,60,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold)', cursor: 'pointer' }}
            >
              {isPlaying ? <Pause style={{ width: 20, height: 20 }} /> : <Play style={{ width: 20, height: 20, marginLeft: 4 }} />}
            </motion.button>
            <button onClick={() => onSkip(10)} style={{ background: 'transparent', border: 'none', color: 'var(--m2)', cursor: 'pointer', transition: 'color 0.3s' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--film)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--m2)'}><SkipForward style={{ width: 16, height: 16 }} /></button>
          </div>

          <motion.div whileHover="hover" initial="rest" animate="rest" className="flex items-center gap-4 cursor-pointer">
            <motion.button onClick={onToggleMute} variants={{ rest: { color: 'var(--m3)', scale: 1 }, hover: { color: 'var(--film)', scale: 1.1 } }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              {isMuted || volume === 0 ? <VolumeX style={{ width: 14, height: 14 }} /> : <Volume2 style={{ width: 14, height: 14 }} />}
            </motion.button>
            <div style={{ width: 60, height: 24, display: 'flex', alignItems: 'center', position: 'relative' }} onClick={onVolumeChange}>
               <div style={{ width: '100%', height: 1, backgroundColor: 'rgba(237,232,220,0.1)' }} />
               <motion.div variants={{ rest: { height: 1 }, hover: { height: 2 } }} style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: `${isMuted ? 0 : volume}%`, backgroundColor: 'var(--gold)' }} />
               <motion.div variants={{ rest: { opacity: 0, scaleY: 0 }, hover: { opacity: 1, scaleY: 1 } }} transition={{ duration: 0.3 }} style={{ position: 'absolute', left: `${isMuted ? 0 : volume}%`, top: 6, width: 1, height: 12, backgroundColor: 'var(--film)', transform: 'translateX(-50%)', boxShadow: '0 0 5px rgba(237,232,220,0.8)' }} />
            </div>
            <motion.span variants={{ rest: { color: 'var(--m3)' }, hover: { color: 'var(--film)' } }} style={{ fontSize: '9px', width: 20, textAlign: 'left' }}>{isMuted ? '00' : Math.round(volume).toString().padStart(2, '0')}</motion.span>
          </motion.div>
        </motion.div>

        <motion.div variants={itemVariants} className="flex items-center gap-8">
          <motion.button 
            onClick={() => onToggleMenu("cast")} whileHover={{ scale: 1.15, color: 'var(--film)', y: -2 }} whileTap={{ scale: 0.9 }}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: activeMenu === 'cast' ? 'var(--gold)' : 'var(--m2)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
          >
            <Cast style={{ width: 16, height: 16 }} />
            {activeMenu === 'cast' && <div style={{ width: 2, height: 2, backgroundColor: 'var(--gold)' }} />}
          </motion.button>

          <div style={{ width: 1, height: 16, backgroundColor: 'rgba(237,232,220,0.1)' }} />

          <div style={{ display: 'flex', gap: 24 }}>
            <motion.button onClick={() => onToggleMenu("subs")} whileHover={{ scale: 1.15, color: 'var(--film)', y: -2 }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: activeMenu === 'subs' ? 'var(--gold)' : 'var(--m3)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <MessageSquare style={{ width: 16, height: 16 }} />
              {activeMenu === 'subs' && <div style={{ width: 2, height: 2, backgroundColor: 'var(--gold)' }} />}
            </motion.button>
            <motion.button onClick={() => onToggleMenu("settings")} whileHover={{ scale: 1.15, color: 'var(--film)', y: -2 }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: activeMenu === 'settings' ? 'var(--gold)' : 'var(--m3)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <Settings2 style={{ width: 16, height: 16 }} />
              {activeMenu === 'settings' && <div style={{ width: 2, height: 2, backgroundColor: 'var(--gold)' }} />}
            </motion.button>
            <motion.button onClick={onToggleFullscreen} whileHover={{ scale: 1.15, color: 'var(--film)', y: -2 }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--m2)' }}>
              {isFullscreen ? <Minimize style={{ width: 16, height: 16 }} /> : <Maximize style={{ width: 16, height: 16 }} />}
            </motion.button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ── 3. PAINEL DE DIAGNÓSTICO (Orquestrado) ──
export function PlayerDiagnosticPanel(props: any) {
  const { activeMenu, activeTab, setActiveTab, playbackMode, setPlaybackMode, onClose } = props;

  return (
    <motion.div initial="hidden" animate="visible" exit="exit" variants={panelVariants} className="absolute bottom-40 right-12 z-50" style={{ width: 400, background: 'rgba(4,4,2,0.98)', border: '1px solid rgba(237,232,220,0.1)', padding: 32 }}>
      
      {activeMenu === "cast" && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: '9px', color: 'var(--gold)', letterSpacing: '0.2em', marginBottom: 8 }}>[ DESTINO DA PROJEÇÃO ]</div>
          {[ { id: "local", name: "Este Dispositivo", desc: "WEB PLAYER (HTML5)", icon: MonitorPlay }, { id: "jellyfin", name: "Smart TV Sala", desc: "JELLYFIN NATIVE CLIENT", icon: Tv }, { id: "direct", name: "Cinema Shield", desc: "DIRECT PLAY (KODI/RD)", icon: Cast } ].map(mode => {
            const isSelected = playbackMode === mode.id;
            return (
              <motion.button 
                key={mode.id} onClick={() => { setPlaybackMode(mode.id); onClose(); }}
                whileHover={{ x: 4, borderColor: isSelected ? 'var(--gold)' : 'rgba(237,232,220,0.3)' }}
                style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px', border: isSelected ? '1px solid var(--gold)' : '1px solid rgba(237,232,220,0.05)', backgroundColor: isSelected ? 'rgba(191,143,60,0.05)' : 'transparent', cursor: 'pointer', textAlign: 'left', width: '100%', fontFamily: "'DM Mono', monospace", transition: 'border-color 0.3s' }}
              >
                <mode.icon style={{ width: 20, height: 20, color: isSelected ? 'var(--gold)' : 'var(--m3)' }} />
                <div>
                  <div style={{ fontSize: '11px', color: isSelected ? 'var(--film)' : 'var(--m2)', textTransform: 'uppercase', marginBottom: 4 }}>{mode.name}</div>
                  <div style={{ fontSize: '8px', color: isSelected ? 'var(--gold)' : 'var(--m3)', letterSpacing: '0.1em' }}>{mode.desc}</div>
                </div>
              </motion.button>
            )
          })}
        </div>
      )}

      {activeMenu === "settings" && (
        <>
          <motion.div variants={settingsItemVariants} style={{ display: 'flex', gap: 24, borderBottom: '1px solid rgba(237,232,220,0.05)', paddingBottom: 16, marginBottom: 24 }}>
            {['video', 'audio'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: activeTab === tab ? 'var(--gold)' : 'var(--m3)', padding: 0 }}>[{tab}]</button>
            ))}
          </motion.div>
          <motion.div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
            {activeTab === 'video' && (
              <motion.div variants={settingsItemVariants} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div><div style={{ fontSize: '10px', color: 'var(--film)', marginBottom: 4 }}>HDR TONE MAPPING</div><div style={{ fontSize: '8px', color: 'var(--m3)', letterSpacing: '0.1em' }}>AUTO-DIAGNOSTIC</div></div>
                <motion.div whileHover={{ scale: 1.1 }} style={{ width: 32, height: 16, border: '1px solid var(--gold)', position: 'relative', cursor: 'pointer', backgroundColor: 'rgba(191,143,60,0.1)' }}>
                  <motion.div animate={{ x: [-2, 0, -2] }} transition={{ repeat: Infinity, duration: 1.5 }} style={{ position: 'absolute', top: 2, right: 2, width: 10, height: 10, backgroundColor: 'var(--gold)' }} />
                </motion.div>
              </motion.div>
            )}
          </motion.div>
        </>
      )}

      {activeMenu === "subs" && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
           <div style={{ fontSize: '9px', color: 'var(--gold)', letterSpacing: '0.2em', marginBottom: 8 }}>[ TRILHAS DE LEGENDA ]</div>
           <div style={{ fontSize: '8px', color: 'var(--m3)', letterSpacing: '0.1em' }}>Em breve: Track loader nativo (VTT/SRT) e controle de offset de sincronia.</div>
        </div>
      )}
    </motion.div>
  );
}