'use client';
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, 
  Maximize, Minimize, Settings2, Subtitles, Layers, 
  ChevronLeft, MessageSquare, Info, SignalHigh, PlaySquare,
  MoreHorizontal
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";

export default function Player() {
  const router = useRouter();
  const [, setLocation] = usePathname();
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [progress, setProgress] = useState(35);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSubtitles, setShowSubtitles] = useState(false);
  const [activeTab, setActiveTab] = useState("video"); // video, audio, subtitles
  
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-hide controls
  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      
      if (isPlaying) {
        controlsTimeoutRef.current = setTimeout(() => {
          if (!showSettings && !showSubtitles) {
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
  }, [isPlaying, showSettings, showSubtitles]);

  const togglePlay = () => setIsPlaying(!isPlaying);
  const toggleMute = () => setIsMuted(!isMuted);
  const toggleFullscreen = () => setIsFullscreen(!isFullscreen);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const totalTime = 8580; // 2h 23m
  const currentTime = (progress / 100) * totalTime;

  return (
    <div className={`fixed inset-0 bg-black text-white overflow-hidden ${!showControls && isPlaying ? 'cursor-none' : ''}`}>
      {/* Fake Video Background */}
      <div className="absolute inset-0">
        <img 
          src={"/images/hero-backdrop.png"} 
          alt="Movie" 
          className={`w-full h-full object-cover transition-transform duration-[30s] ease-linear ${isPlaying ? 'scale-105' : 'scale-100'}`}
        />
        <div className="absolute inset-0 bg-black/40" /> {/* Subtle vignette */}
        
        {/* Film Grain Overlay */}
        <div className="absolute inset-0 bg-noise opacity-[0.04] mix-blend-overlay pointer-events-none" />
      </div>

      {/* Network / Buffer Warning (Simulated) */}
      {!isPlaying && progress === 0 && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-4 z-40">
          <div className="w-16 h-16 rounded-full border-4 border-white/20 border-t-primary animate-spin" />
          <div className="bg-black/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 flex items-center gap-2 text-sm font-mono">
            <SignalHigh className="w-4 h-4 text-primary" />
            Buffer: 86.4 GB (4K REMUX)
          </div>
        </div>
      )}

      {/* Top Bar */}
      <AnimatePresence>
        {showControls && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-0 left-0 right-0 p-8 flex items-start justify-between z-50 bg-linear-to-b from-black/80 via-black/40 to-transparent"
          >
            <div className="flex items-center gap-6">
              <button 
                onClick={() => router.push("/session")}
                className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center backdrop-blur-md transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <div>
                <h1 className="text-2xl font-serif font-bold text-white drop-shadow-lg">L'Aventura</h1>
                <p className="text-white/70 text-sm flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-primary/20 border border-primary/30 text-primary text-xs font-bold tracking-wider">4K HDR</span>
                  • 1960 • Michelangelo Antonioni
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="bg-black/50 backdrop-blur-md border border-white/10 rounded-full px-4 py-2 flex items-center gap-3 text-sm">
                <div className="flex items-center gap-1.5 text-primary">
                  <SignalHigh className="w-4 h-4" />
                  <span className="font-mono">145 Mbps</span>
                </div>
                <div className="w-px h-4 bg-white/20" />
                <span className="text-white/70 font-mono">Direct Play</span>
              </div>
              <button className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center backdrop-blur-md transition-colors">
                <Info className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Controls (Bottom) */}
      <AnimatePresence>
        {showControls && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-0 left-0 right-0 p-8 pt-32 bg-linear-to-t from-black/90 via-black/60 to-transparent z-50 flex flex-col gap-6"
          >
            {/* Timeline */}
            <div className="flex items-center gap-4 group">
              <span className="text-sm font-mono text-white/70 w-16 text-right">{formatTime(currentTime)}</span>
              
              <div className="flex-1 h-2 relative cursor-pointer flex items-center" onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const percent = ((e.clientX - rect.left) / rect.width) * 100;
                setProgress(Math.max(0, Math.min(100, percent)));
              }}>
                {/* Background track */}
                <div className="absolute inset-0 bg-white/20 rounded-full overflow-hidden">
                  {/* Buffer track */}
                  <div className="absolute top-0 left-0 h-full bg-white/30" style={{ width: `${progress + 15}%` }} />
                  {/* Progress track */}
                  <div className="absolute top-0 left-0 h-full bg-primary" style={{ width: `${progress}%` }} />
                </div>
                {/* Playhead thumb */}
                <div 
                  className="absolute w-4 h-4 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)] scale-0 group-hover:scale-100 transition-transform -translate-x-1/2"
                  style={{ left: `${progress}%` }}
                />
                
                {/* Chapters/Markers */}
                <div className="absolute top-0 left-[25%] w-0.5 h-full bg-black/50" />
                <div className="absolute top-0 left-[60%] w-0.5 h-full bg-black/50" />
              </div>
              
              <span className="text-sm font-mono text-white/70 w-16">{formatTime(totalTime)}</span>
            </div>

            {/* Controls Row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <button onClick={togglePlay} className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform">
                  {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
                </button>
                
                <div className="flex items-center gap-4">
                  <button className="text-white/70 hover:text-white transition-colors">
                    <SkipBack className="w-6 h-6" />
                  </button>
                  <button className="text-white/70 hover:text-white transition-colors">
                    <SkipForward className="w-6 h-6" />
                  </button>
                </div>

                <div className="flex items-center gap-3 group ml-4">
                  <button onClick={toggleMute} className="text-white/70 hover:text-white transition-colors">
                    {isMuted || volume === 0 ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                  </button>
                  <div className="w-0 group-hover:w-24 overflow-hidden transition-all duration-300 flex items-center">
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={isMuted ? 0 : volume}
                      onChange={(e) => {
                        setVolume(parseInt(e.target.value));
                        setIsMuted(false);
                      }}
                      className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6">
                {/* Party Mode indicator */}
                <div className="flex items-center gap-2 bg-primary/20 border border-primary/30 rounded-full px-3 py-1.5">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-xs font-bold text-primary tracking-wider uppercase">Party Mode: 3</span>
                </div>

                <button 
                  onClick={() => setShowSubtitles(!showSubtitles)}
                  className={`text-white/70 hover:text-white transition-colors relative ${showSubtitles ? 'text-primary' : ''}`}
                >
                  <MessageSquare className="w-6 h-6" />
                  {showSubtitles && <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />}
                </button>
                
                <button 
                  onClick={() => setShowSettings(!showSettings)}
                  className={`text-white/70 hover:text-white transition-colors relative ${showSettings ? 'text-primary' : ''}`}
                >
                  <Settings2 className="w-6 h-6" />
                  {showSettings && <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />}
                </button>

                <button onClick={toggleFullscreen} className="text-white/70 hover:text-white transition-colors">
                  {isFullscreen ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Menu Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0, x: 20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.95 }}
            className="absolute bottom-32 right-8 w-80 bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden z-50 shadow-2xl"
          >
            <div className="flex p-2 gap-1 bg-white/5 border-b border-white/10">
              {['video', 'audio', 'subtitles'].map(tab => (
                <button 
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2 text-xs font-bold tracking-wider uppercase rounded-lg transition-colors ${activeTab === tab ? 'bg-primary text-white' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
                >
                  {tab === 'video' && 'Vídeo'}
                  {tab === 'audio' && 'Áudio'}
                  {tab === 'subtitles' && 'Legendas'}
                </button>
              ))}
            </div>
            
            <div className="p-4 max-h-75 overflow-y-auto">
              {activeTab === 'video' && (
                <div className="space-y-2">
                  <div className="text-xs text-primary font-bold mb-2 uppercase tracking-wider">Qualidade da Fonte</div>
                  <button className="w-full flex items-center justify-between p-3 rounded-xl bg-white/10 text-sm border border-primary/30">
                    <span className="font-medium">Original (4K HDR REMUX)</span>
                    <span className="text-primary font-mono">145 Mbps</span>
                  </button>
                  <button className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 text-sm text-white/70 transition-colors">
                    <span>1080p (Transcode)</span>
                    <span className="font-mono">20 Mbps</span>
                  </button>
                  <button className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 text-sm text-white/70 transition-colors">
                    <span>720p (Transcode)</span>
                    <span className="font-mono">8 Mbps</span>
                  </button>
                  
                  <div className="h-px bg-white/10 my-4" />
                  <div className="text-xs text-white/50 font-bold mb-2 uppercase tracking-wider">Processamento</div>
                  <label className="flex items-center justify-between p-2 hover:bg-white/5 rounded-lg cursor-pointer">
                    <span className="text-sm text-white/90">HDR Tone Mapping</span>
                    <div className="w-8 h-4 bg-primary rounded-full relative">
                      <div className="absolute right-0.5 top-0.5 w-3 h-3 bg-white rounded-full" />
                    </div>
                  </label>
                </div>
              )}
              
              {activeTab === 'audio' && (
                <div className="space-y-2">
                  <button className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/10 text-sm border border-primary/30 text-left">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <div>
                      <div className="font-medium text-white">Italiano (TrueHD 7.1)</div>
                      <div className="text-xs text-primary/80 font-mono mt-1">Direct Play</div>
                    </div>
                  </button>
                  <button className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 text-sm text-white/70 transition-colors text-left">
                    <div className="w-2 h-2 rounded-full bg-transparent" />
                    <div>
                      <div className="font-medium text-white">Italiano (AC3 5.1)</div>
                      <div className="text-xs text-white/50 mt-1">Compatibilidade</div>
                    </div>
                  </button>
                  
                  <div className="h-px bg-white/10 my-4" />
                  <div className="text-xs text-white/50 font-bold mb-2 uppercase tracking-wider">Ajuste de Sincronia (Party)</div>
                  <div className="flex items-center gap-2">
                    <button className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center">-</button>
                    <div className="flex-1 bg-black/50 border border-white/10 rounded-lg py-1.5 text-center font-mono text-sm">0 ms</div>
                    <button className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center">+</button>
                  </div>
                </div>
              )}

              {activeTab === 'subtitles' && (
                <div className="space-y-2">
                  <button className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 text-sm text-white/70 transition-colors text-left">
                    <div className="w-2 h-2 rounded-full bg-transparent" />
                    <div>Desativado</div>
                  </button>
                  <button className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/10 text-sm border border-primary/30 text-left">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <div>
                      <div className="font-medium text-white">Português (Brasil)</div>
                      <div className="text-xs text-primary/80 font-mono mt-1">SRT Externo</div>
                    </div>
                  </button>
                  <button className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 text-sm text-white/70 transition-colors text-left">
                    <div className="w-2 h-2 rounded-full bg-transparent" />
                    <div>
                      <div className="font-medium text-white">English (SDH)</div>
                      <div className="text-xs text-white/50 font-mono mt-1">PGS Embutido</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Simulated Subtitles overlay */}
      {showControls && progress > 10 && progress < 80 && (
        <div className="absolute bottom-36 left-1/2 -translate-x-1/2 text-center pointer-events-none z-40">
          <p className="text-3xl font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] [text-shadow:0_2px_10px_black] tracking-wide" style={{ WebkitTextStroke: '1px black' }}>
            A ilha está completamente vazia.
          </p>
        </div>
      )}
    </div>
  );
}
