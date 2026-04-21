'use client';
import { Sidebar } from "@/components/layout/Sidebar";
import { PlayCircle, CheckCircle2, CircleDashed, Loader2, Play, Settings2, SlidersHorizontal, Cast } from "lucide-react";
import { motion } from "framer-motion";

export default function Session() {
  const steps = [
    { label: "Planejamento", status: "done", time: "19:00" },
    { label: "Busca de Mídia", status: "done", time: "19:02" },
    { label: "Download", status: "active", time: "Agora" },
    { label: "Sessão Pronta", status: "pending", time: "~19:45" },
  ];

  const movies = [
    { id: 1, title: "L'Aventura", poster: "/images/poster-1.png", status: "ready", progress: 100, size: "86.4 GB" },
    { id: 2, title: "Solaris", poster: "/images/poster-2.png", status: "downloading", progress: 68, size: "75.2 GB" },
    { id: 3, title: "Persona", poster: "/images/poster-3.png", status: "pending", progress: 0, size: "45.1 GB" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground pl-24 selection:bg-primary/30">
      <div className="fixed inset-0 bg-noise opacity-[0.03] mix-blend-overlay pointer-events-none z-50" />
      <Sidebar />
      
      {/* Abstract Background Glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-250 h-125 bg-primary/10 rounded-full blur-[120px] pointer-events-none -z-10" />
      
      <main className="max-w-350 mx-auto px-16 pt-24 pb-32">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-8 mb-24"
        >
          <div className="w-24 h-24 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center shadow-2xl backdrop-blur-xl">
            <span className="text-5xl">🌫️</span>
          </div>
          <div>
            <h1 className="text-6xl font-serif font-bold text-white mb-4 text-glow">Noite Atmosférica</h1>
            <p className="text-2xl text-muted-foreground font-light">Uma jornada por filmes contemplativos e visualmente impressionantes</p>
          </div>
        </motion.div>

        {/* Progress Timeline */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-24 bg-card/30 border border-white/5 rounded-3xl p-10 backdrop-blur-md relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-linear-to-b from-white/5 to-transparent pointer-events-none" />
          
          <div className="flex items-center justify-between relative z-10">
            <div className="absolute left-10 right-10 top-6 h-1 bg-white/5 rounded-full -z-10" />
            {/* Active Progress Bar Background */}
            <div className="absolute left-10 top-6 h-1 bg-primary/50 rounded-full -z-10 shadow-[0_0_10px_rgba(99,102,241,0.5)] transition-all duration-1000" style={{ width: '60%' }} />
            
            {steps.map((step, i) => (
              <div key={i} className="flex flex-col items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border-2 transition-all duration-500 shadow-xl
                  ${step.status === 'done' ? 'bg-quality-remux/20 border-quality-remux text-quality-remux' : 
                    step.status === 'active' ? 'bg-primary/20 border-primary text-primary scale-110 shadow-[0_0_20px_rgba(99,102,241,0.4)]' : 
                    'bg-card border-white/10 text-white/20'}
                `}>
                  {step.status === 'done' && <CheckCircle2 className="w-7 h-7" />}
                  {step.status === 'active' && <Loader2 className="w-7 h-7 animate-spin" />}
                  {step.status === 'pending' && <CircleDashed className="w-7 h-7" />}
                </div>
                <div className="text-center">
                  <span className={`block text-base font-semibold uppercase tracking-wider mb-1 ${step.status === 'pending' ? 'text-white/40' : 'text-white'}`}>
                    {step.label}
                  </span>
                  <span className="text-sm font-mono text-muted-foreground">{step.time}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Movies List */}
        <div className="space-y-6 mb-20">
          <h2 className="text-3xl font-serif text-white mb-8">Fila de Mídia</h2>
          
          {movies.map((movie, i) => (
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + (i * 0.1) }}
              key={movie.id} 
              className="flex gap-8 p-6 rounded-3xl bg-card/50 border border-white/5 items-center tv-focus group transition-all hover:bg-card/80 backdrop-blur-sm"
            >
              <div className="w-28 h-40 shrink-0 rounded-2xl overflow-hidden shadow-2xl relative">
                <img src={movie.poster} alt={movie.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                <div className="absolute inset-0 border border-white/10 rounded-2xl pointer-events-none" />
              </div>
              
              <div className="flex-1 py-2">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-3xl font-serif text-white">{movie.title}</h3>
                  <span className="text-muted-foreground font-mono text-sm bg-white/5 px-3 py-1 rounded-md">{movie.size}</span>
                </div>
                
                {/* Visual Progress Bar */}
                <div className="w-full h-3 rounded-full bg-black/50 overflow-hidden mb-4 border border-white/5 relative">
                  <div 
                    className={`absolute top-0 left-0 h-full transition-all duration-1000 rounded-full ${movie.status === 'ready' ? 'bg-quality-remux' : movie.status === 'downloading' ? 'bg-primary' : 'bg-transparent'}`}
                    style={{ width: `${movie.progress}%` }}
                  />
                  {/* Glow effect for active progress */}
                  {movie.status === 'downloading' && (
                    <div 
                      className="absolute top-0 h-full bg-white/30 blur-[2px] transition-all duration-1000"
                      style={{ width: '20px', left: `calc(${movie.progress}% - 20px)` }}
                    />
                  )}
                </div>
                
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-semibold tracking-wide uppercase ${movie.status === 'ready' ? 'text-quality-remux' : movie.status === 'downloading' ? 'text-primary' : 'text-muted-foreground'}`}>
                    {movie.status === 'ready' ? 'Download completo' : 
                     movie.status === 'downloading' ? `Baixando mídia... ${movie.progress}%` : 'Na fila de espera'}
                  </span>
                  {movie.status === 'downloading' && (
                    <span className="text-sm text-muted-foreground font-mono">14.2 MB/s</span>
                  )}
                </div>
              </div>

              {movie.status === 'ready' ? (
                <button className="w-20 h-20 shrink-0 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-quality-remux group-hover:border-quality-remux group-hover:text-white transition-all group-hover:scale-110 group-hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] mr-4">
                  <Play className="w-8 h-8 ml-1" />
                </button>
              ) : (
                <div className="w-20 h-20 shrink-0 flex items-center justify-center mr-4">
                  {movie.status === 'downloading' ? (
                    <Loader2 className="w-8 h-8 text-primary animate-spin opacity-50" />
                  ) : (
                    <CircleDashed className="w-8 h-8 text-white/20" />
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Action Bar */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="flex gap-6 items-center border-t border-white/10 pt-12"
        >
          <button 
            onClick={() => window.location.href = '/player'}
            className="px-12 py-6 bg-primary text-white rounded-2xl font-bold text-xl tv-focus shadow-[0_0_40px_rgba(99,102,241,0.3)] hover:bg-primary/90 transition-all flex items-center gap-3"
          >
            <PlayCircle className="w-7 h-7" />
            Iniciar Sessão Agora
          </button>

          <div className="flex bg-white/5 border border-white/10 rounded-2xl p-1 backdrop-blur-sm">
            <button className="px-6 py-5 rounded-xl font-bold text-lg text-white hover:bg-white/10 transition-colors flex items-center gap-2 tv-focus">
              <Cast className="w-6 h-6" /> TV / Chromecast
            </button>
            <button className="px-6 py-5 rounded-xl font-bold text-lg text-white hover:bg-white/10 transition-colors flex items-center gap-2 tv-focus">
              <SlidersHorizontal className="w-6 h-6" /> Auto-Quality
            </button>
          </div>

          <button className="px-10 py-6 bg-white/5 text-white border border-white/10 rounded-2xl font-bold text-xl tv-focus hover:bg-white/10 transition-all ml-auto">
            Gerenciar no Plex
          </button>
        </motion.div>

      </main>
    </div>
  );
}
