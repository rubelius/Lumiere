'use client';
import { useState, useEffect, useRef, Suspense } from "react";
import { FINE_ART_EASE } from '@/lib/motion';
import Image from 'next/image';
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { Tv, MonitorPlay } from "lucide-react";

import { PlayerTopBar, PlayerBottomControls, PlayerDiagnosticPanel } from "@/components/player/PlayerUI";
import { useMovie } from "@/features/movies/hooks/useMovies";

// PLACEHOLDER. O backend ainda não expõe URL de stream: não há integração
// Jellyfin (só apps/integrations/plex.py, que cobre biblioteca e playlist) nem
// endpoint de playback. Quando existir, é este o único ponto a trocar.
const PLACEHOLDER_STREAM_URL = "https://www.w3schools.com/html/mov_bbb.mp4";


function PlayerExperience() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const movieId = searchParams.get('id') || '';
  const { data: movie } = useMovie(movieId);
  
  const [mounted, setMounted] = useState(false);
  const [isExiting, setIsExiting] = useState(false); 
  
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isWaiting, setIsWaiting] = useState(true);
  const [progress, setProgress] = useState(0);
  const [bufferedPercent, setBufferedPercent] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [activeMenu, setActiveMenu] = useState<"settings" | "subs" | "cast" | null>(null);
  const [activeTab, setActiveTab] = useState<"video" | "audio" | "sub">("video"); 
  const [playbackMode, setPlaybackMode] = useState<"local" | "jellyfin" | "direct">("local");
  // Resolução medida no próprio elemento, em vez do "145 MBPS" que era fixo.
  const [resolution, setResolution] = useState<string | null>(null);

  // 1. 👇 CICLO DE VIDA BLINDADO
  useEffect(() => {
    setMounted(true);
    // Trava o scroll e garante que o body não tenha margens estranhas
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';

    return () => {
      // Limpeza absoluta ao desmontar
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, []);

  // 2. 👇 NAVEGAÇÃO DE RETORNO SEM TRAVAMENTO
  const handleBack = () => {
    // Para o som imediatamente
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = ""; // Libera o buffer de rede
      videoRef.current.load();
    }

    // Inicia o fade-out da UI
    setIsExiting(true);

    // Limpa os estilos do body ANTES de navegar para a Home não herdar o bloqueio
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';

    // Pequeno delay para o React processar a destruição do Portal
    setTimeout(() => {
      setMounted(false);
      router.push('/'); // Usar push('/') as vezes é mais seguro que back() em Portals
    }, 300);
  };

  // Auto-hide controls
  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      if (isPlaying) {
        controlsTimeoutRef.current = setTimeout(() => {
          if (!activeMenu) setShowControls(false);
        }, 3000);
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => { window.removeEventListener("mousemove", handleMouseMove); };
  }, [isPlaying, activeMenu]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume / 100;
      videoRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const togglePlay = async () => {
    if (!videoRef.current) return;
    try {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        await videoRef.current.play();
      }
    } catch (error) {
      console.error("Playback error:", error);
    }
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) await containerRef.current.requestFullscreen();
      else await document.exitFullscreen();
    } catch (err) {
      console.error("Fullscreen error:", err);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const curr = videoRef.current.currentTime;
      setCurrentTime(curr);
      if (totalTime > 0) setProgress((curr / totalTime) * 100);
    }
  };

  const handleProgress = () => {
    if (videoRef.current && videoRef.current.buffered.length > 0) {
      const bufferedEnd = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
      const duration = videoRef.current.duration;
      if (duration > 0) setBufferedPercent((bufferedEnd / duration) * 100);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = ((e.clientX - rect.left) / rect.width);
    videoRef.current.currentTime = percent * totalTime;
    setProgress(percent * 100);
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "00:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const playerContent = (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: isExiting ? 0 : 1 }}
      transition={{ duration: 0.3, ease: FINE_ART_EASE }}
      ref={containerRef} 
      className={`fixed inset-0 bg-[var(--void)] text-[var(--film)] overflow-hidden ${!showControls && isPlaying ? 'cursor-none' : ''}`} 
      style={{ fontFamily: "'DM Mono', monospace", zIndex: 9999999, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
    >
      
      {playbackMode === "local" ? (
        <div className="absolute inset-0">
          <video 
            ref={videoRef}
            src={PLACEHOLDER_STREAM_URL}
            playsInline
            className="w-full h-full object-cover"
            style={{
              transform: isPlaying ? 'scale(1.02)' : 'scale(1)',
              transition: 'transform 30s ease-linear',
              filter: 'grayscale(30%) contrast(1.1) brightness(0.6)'
            }}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onTimeUpdate={handleTimeUpdate}
            onProgress={handleProgress}
            onLoadedMetadata={() => {
              if (videoRef.current) {
                setTotalTime(videoRef.current.duration);
                const { videoWidth: w, videoHeight: h } = videoRef.current;
                if (w && h) setResolution(`${w}×${h}`);
              }
              setIsWaiting(false);
            }}
            onWaiting={() => setIsWaiting(true)}
            onCanPlay={() => setIsWaiting(false)}
            onClick={togglePlay}
          />
          <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at center, transparent 30%, rgba(4,4,2,0.8) 100%)', pointerEvents: 'none' }} />
          <div className="absolute inset-0 bg-noise opacity-[0.04] mix-blend-overlay pointer-events-none" />
        </div>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
           <Image src="/images/backgrounds/chefao.jpg" alt="Poster" fill sizes="100vw" className="object-cover blur-md" style={{ filter: 'grayscale(30%) contrast(1.1) brightness(0.4)' }} />
           <motion.div animate={{ scale: [1, 1.05, 1], opacity: [0.8, 1, 0.8] }} transition={{ repeat: Infinity, duration: 4 }} className="z-10 flex flex-col items-center gap-8">
             {playbackMode === "jellyfin" ? <Tv style={{ width: 64, height: 64, color: 'var(--gold)' }} /> : <MonitorPlay style={{ width: 64, height: 64, color: 'var(--gold)' }} />}
             <div style={{ textAlign: 'center' }}>
               <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '3rem', margin: 0 }}>Projetando em Tela Externa</h2>
               <p style={{ fontSize: '10px', letterSpacing: '0.2em', color: 'var(--m2)', marginTop: 8 }}>{playbackMode === "jellyfin" ? "JELLYFIN NATIVE CLIENT" : "DIRECT PLAY PASSTHROUGH"}</p>
             </div>
           </motion.div>
        </div>
      )}

      {isWaiting && playbackMode === "local" && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-6 z-40">
          <motion.div 
            animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
            style={{ width: 40, height: 40, border: '1px solid rgba(237,232,220,0.1)', borderTop: '1px solid var(--gold)', borderRadius: '50%' }} 
          />
          <div style={{ fontSize: '9px', letterSpacing: '0.2em', color: 'var(--gold)', textTransform: 'uppercase' }}>
            AQUISIÇÃO DE STREAM...
          </div>
        </div>
      )}

      <AnimatePresence>
        {showControls && (
          <PlayerTopBar
            onBack={handleBack}
            title={movie?.title || 'Carregando…'}
            year={movie?.year}
            quality={movie?.best_quality_available || undefined}
            resolution={resolution}
            playbackMode={playbackMode}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showControls && (
          <PlayerBottomControls 
            currentTimeStr={formatTime(currentTime)}
            totalTimeStr={formatTime(totalTime)}
            progressPercent={progress}
            bufferedPercent={bufferedPercent}
            onSeek={handleSeek}
            isPlaying={isPlaying}
            onTogglePlay={togglePlay}
            onSkip={(amt: number) => { if(videoRef.current) videoRef.current.currentTime += amt }}
            volume={volume}
            isMuted={isMuted}
            onVolumeChange={(e: any) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setVolume(((e.clientX - rect.left) / rect.width) * 100);
            }}
            onToggleMute={() => setIsMuted(!isMuted)}
            activeMenu={activeMenu}
            onToggleMenu={(m: any) => setActiveMenu(activeMenu === m ? null : m)}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeMenu && (
          <PlayerDiagnosticPanel 
            activeMenu={activeMenu} activeTab={activeTab} setActiveTab={setActiveTab} 
            playbackMode={playbackMode} setPlaybackMode={setPlaybackMode} onClose={() => setActiveMenu(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );

  if (!mounted) return null;
  return createPortal(playerContent, document.body);
}

export default function Player() {
  return (
    <Suspense fallback={null}>
      <PlayerExperience />
    </Suspense>
  );
}
