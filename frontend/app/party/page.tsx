'use client';
import { Sidebar } from "@/components/layout/Sidebar";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Link as LinkIcon, MessageSquare, Play, Send, Smile, Star, CalendarPlus, Settings2, X, Search, Heart, Flame, ThumbsUp, Plus } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

export default function Party() {
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);

  const users = [
    { name: "Você", host: true, avatar: "/images/perfil.jpg" },
    { name: "Ana C.", host: false, avatar: "/images/avatar.png" },
    { name: "Carlos M.", host: false, avatar: "/images/perfil.jpg" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground pl-24 pb-20 selection:bg-primary/30">
      <div className="fixed inset-0 bg-noise opacity-[0.03] mix-blend-overlay pointer-events-none z-50" />
      <Sidebar />

      {/* Ambilight glow based on movie */}
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-full max-w-4xl h-125 bg-primary/20 rounded-full blur-[150px] pointer-events-none -z-10" />

      <main className="max-w-400 mx-auto px-12 pt-20">
        
        <div className="flex items-center justify-between mb-12">
          <div>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-6xl font-serif font-bold text-white mb-4 text-gradient flex items-center gap-6"
            >
              <Users className="w-12 h-12 text-primary" />
              Party Mode
            </motion.h1>
          </div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="flex gap-4"
          >
            <button 
              onClick={() => setIsScheduleOpen(true)}
              className="flex items-center gap-3 bg-primary/20 text-primary border border-primary/30 px-6 py-3 rounded-xl tv-focus hover:bg-primary/30 transition-all font-medium"
            >
              <CalendarPlus className="w-5 h-5" />
              Agendar Sessão
            </button>
            <button className="flex items-center gap-3 bg-white/10 border border-white/20 px-6 py-3 rounded-xl tv-focus hover:bg-white/20 transition-all text-white font-medium">
              <LinkIcon className="w-5 h-5" />
              Copiar Link
            </button>
          </motion.div>
        </div>

        {/* Schedule Modal (New Feature) */}
        <AnimatePresence>
          {isScheduleOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-200 bg-background/80 backdrop-blur-xl flex items-center justify-center p-4"
              onClick={() => setIsScheduleOpen(false)}
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-card/90 border border-white/10 rounded-[2rem] p-8 max-w-lg w-full shadow-2xl relative"
                onClick={e => e.stopPropagation()}
              >
                <button onClick={() => setIsScheduleOpen(false)} className="absolute top-6 right-6 text-muted-foreground hover:text-white transition-colors">
                  <X className="w-6 h-6" />
                </button>
                <h2 className="text-3xl font-serif text-white mb-6">Agendar Nova Party</h2>
                
                <div className="space-y-5">
                  <div>
                    <label className="text-sm font-medium text-white/70 mb-2 block">Título da Sessão</label>
                    <input type="text" placeholder="Ex: Maratona do Fim de Semana" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-primary focus:bg-white/10 transition-colors" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-white/70 mb-2 block">Data e Hora</label>
                    <div className="grid grid-cols-2 gap-4">
                      <input type="date" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-primary focus:bg-white/10 transition-colors scheme-dark" />
                      <input type="time" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-primary focus:bg-white/10 transition-colors scheme-dark" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-white/70 mb-2 block">Filme / Mídia</label>
                    <button className="w-full bg-white/5 border border-white/10 border-dashed rounded-xl px-4 py-6 text-muted-foreground hover:text-white hover:border-white/30 transition-colors flex items-center justify-center gap-2">
                      <Search className="w-5 h-5" /> Buscar na biblioteca...
                    </button>
                  </div>
                  
                  <button className="w-full bg-primary text-white font-bold text-lg rounded-xl py-4 mt-4 shadow-lg shadow-primary/25 hover:bg-primary/90 transition-colors tv-focus">
                    Criar Sessão
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Left: Current Movie */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-3 bg-card/40 border border-white/10 rounded-3xl p-8 backdrop-blur-md relative overflow-hidden"
          >
            <div className="flex gap-10">
              <div className="w-64 shrink-0">
                <div className="relative aspect-2/3 rounded-3xl overflow-hidden shadow-2xl border border-white/10">
                  <Image 
                  src={"/images/poster-1.png"} 
                  fill
                  sizes="(max-width: 768px) 100vw, 256px"
                  className="object-cover" 
                  alt="" />
                </div>
              </div>
              
              <div className="flex-1 py-4 flex flex-col">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/20 text-primary border border-primary/30 w-fit mb-6 text-sm font-bold tracking-wider uppercase">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  Sessão Ativa
                </div>
                
                <h2 className="text-5xl font-serif text-white mb-4 text-glow">L'Aventura</h2>
                <p className="text-xl text-muted-foreground mb-12">1960 • Michelangelo Antonioni</p>
                
                <div className="mt-auto">
                  <div className="flex items-center justify-between text-base font-mono text-muted-foreground mb-4">
                    <span className="text-white">01:14:20</span>
                    <span>02:23:00</span>
                  </div>
                  <div className="h-4 bg-black/50 rounded-full overflow-hidden border border-white/10 relative group/progress cursor-pointer">
                    <div className="absolute top-0 left-0 h-full bg-primary w-[52%] shadow-[0_0_20px_rgba(99,102,241,0.8)] group-hover/progress:bg-white transition-colors" />
                    {/* Live indicators of other people's progress */}
                    <div className="absolute top-0 left-[51%] w-1 h-full bg-quality-remux shadow-[0_0_10px_rgba(16,185,129,1)]" title="Ana C." />
                    <div className="absolute top-0 left-[53%] w-1 h-full bg-[#F59E0B] shadow-[0_0_10px_rgba(245,158,11,1)]" title="Carlos M." />
                  </div>
                </div>

                <div className="flex items-center gap-6 mt-10">
                  <button 
                    onClick={() => window.location.href = '/player'}
                    className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-white shadow-[0_0_30px_rgba(99,102,241,0.4)] tv-focus hover:scale-110 transition-transform"
                  >
                    <Play className="w-10 h-10 ml-1" />
                  </button>
                  <button className="px-8 py-5 rounded-2xl bg-white/5 border border-white/10 text-white font-medium text-lg tv-focus hover:bg-white/10 transition-colors flex items-center gap-3">
                    <LinkIcon className="w-5 h-5" /> Sincronizar Todos
                  </button>
                  <button className="px-8 py-5 rounded-2xl bg-white/5 border border-white/10 text-white font-medium text-lg tv-focus hover:bg-white/10 transition-colors flex items-center gap-3 ml-auto">
                    <Settings2 className="w-5 h-5" /> Ajustes de Sincronia
                  </button>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right: Members & Live Chat (New Feature) */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-card/40 border border-white/10 rounded-3xl backdrop-blur-md flex flex-col h-175 overflow-hidden"
          >
            {/* Users Tab */}
            <div className="p-6 border-b border-white/10 bg-white/5">
              <h3 className="text-lg font-serif text-white mb-4">Participantes ({users.length})</h3>
              <div className="flex gap-2 overflow-x-auto hide-scrollbar">
                {users.map((user, i) => (
                  <div key={i} className="relative group">
                    <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-quality-remux">
                      <Image 
                      src={user.avatar} 
                      fill
                      sizes="40px"
                      className="object-cover z-0" alt="" />
                    </div>
                    {user.host && <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-primary rounded-full border-2 border-background flex items-center justify-center"><Star className="w-2 h-2 text-white" /></div>}
                  </div>
                ))}
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              <div className="text-center text-xs text-muted-foreground font-mono bg-black/20 py-2 rounded-lg mb-6">
                Sessão iniciada às 20:00
              </div>
              
              <div className="flex gap-4">
                <div className="relative w-8 h-8 shrink-0 rounded-full overflow-hidden border border-white/10">
                  <Image 
                    src={"/images/avatar.png"}
                    fill
                    sizes="40px"
                    className="object-cover" 
                    alt="Avatar Ana" 
                  />
                </div>
                
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-white">Ana C.</span>
                    <span className="text-xs text-muted-foreground">01:10:05</span>
                  </div>
                  <p className="text-sm text-white/90 bg-white/5 p-3 rounded-2xl rounded-tl-none border border-white/5">A fotografia desse filme é absurda!</p>
                  <div className="flex gap-1 mt-1">
                    <span className="text-xs bg-white/5 px-2 py-0.5 rounded-full border border-white/10">❤️ 2</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 flex-row-reverse">
                <div className="relative w-8 h-8 shrink-0 rounded-full overflow-hidden border border-white/10">
                  <Image 
                    src={"/images/perfil.jpg"} 
                    fill
                    className="object-cover" 
                    alt="Seu Avatar" 
                  />
                </div>
                
                <div className="flex flex-col items-end">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-muted-foreground">01:11:20</span>
                    <span className="text-sm font-bold text-primary">Você</span>
                  </div>
                  <p className="text-sm text-white bg-primary/20 p-3 rounded-2xl rounded-tr-none border border-primary/20">Sim! Especialmente nas cenas da ilha.</p>
                </div>
              </div>

              {/* Live Poll Example */}
              <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Enquete Rápida</span>
                </div>
                <p className="text-sm text-white mb-3">O que estão achando do ritmo do filme?</p>
                <div className="space-y-2">
                  <button className="w-full relative overflow-hidden bg-black/40 rounded-lg p-2 text-left tv-focus group">
                    <div className="absolute top-0 left-0 h-full bg-primary/30 w-[60%]" />
                    <span className="relative z-10 text-xs text-white group-hover:text-primary transition-colors flex justify-between">Lento, mas hipnótico <span>60%</span></span>
                  </button>
                  <button className="w-full relative overflow-hidden bg-black/40 rounded-lg p-2 text-left tv-focus group">
                    <div className="absolute top-0 left-0 h-full bg-white/10 w-[40%]" />
                    <span className="relative z-10 text-xs text-white/70 group-hover:text-white transition-colors flex justify-between">Muito parado <span>40%</span></span>
                  </button>
                </div>
              </div>
            </div>

            {/* Chat Input & Reactions (New Feature) */}
            <div className="p-4 border-t border-white/10 bg-black/20">
              {/* Floating Reactions */}
              <div className="flex justify-center gap-4 mb-3">
                <button className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 hover:scale-110 transition-all flex items-center justify-center border border-white/10 tv-focus"><Heart className="w-5 h-5 text-red-500" /></button>
                <button className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 hover:scale-110 transition-all flex items-center justify-center border border-white/10 tv-focus"><Flame className="w-5 h-5 text-orange-500" /></button>
                <button className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 hover:scale-110 transition-all flex items-center justify-center border border-white/10 tv-focus"><ThumbsUp className="w-5 h-5 text-blue-400" /></button>
              </div>

              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl p-2 focus-within:border-primary/50 focus-within:bg-white/10 transition-colors">
                <button className="p-2 text-muted-foreground hover:text-white transition-colors">
                  <Plus className="w-5 h-5" />
                </button>
                <input 
                  type="text" 
                  placeholder="Comente sobre o filme..." 
                  className="flex-1 bg-transparent border-none text-white text-sm outline-none placeholder:text-muted-foreground"
                />
                <button className="p-2 bg-primary text-white rounded-xl hover:bg-primary/80 transition-colors">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>

          </motion.div>

        </div>
      </main>
    </div>
  );
}