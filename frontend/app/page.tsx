'use client';

import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { MovieCard } from "@/components/ui/movie-card";
import { PlayCircle, Clock, ChevronRight, Sparkles, Play, Users, Compass, Music, TrendingUp, Search, Ticket, Film, Target, CalendarDays, Eye, Heart, BookOpen } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

export default function Home() {
  const [activeMood, setActiveMood] = useState("Melancólico");

  const recommendations = [
    { id: 1, title: "L'Aventura", year: "1960", imageUrl: "/images/poster-1.png", qualities: ["REMUX", "4K"] as any },
    { id: 2, title: "Solaris", year: "1972", imageUrl: "/images/poster-2.png", qualities: ["4K", "HDR"] as any },
    { id: 3, title: "Persona", year: "1966", imageUrl: "/images/poster-3.png", qualities: ["REMUX", "ATMOS"] as any },
    { id: 4, title: "Barry Lyndon", year: "1975", imageUrl: "/images/poster-4.png", qualities: ["4K"] as any },
    { id: 5, title: "Metropolis", year: "1927", imageUrl: "/images/poster-5.png", qualities: ["REMUX", "HDR"] as any },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground pl-24 pb-20 overflow-x-hidden selection:bg-primary/30">
      <div className="fixed inset-0 bg-noise opacity-[0.03] mix-blend-overlay pointer-events-none z-50" />
      <Sidebar />
      
      <main className="max-w-480 mx-auto">
        {/* Hero Section */}
        <section className="relative min-h-screen flex items-center mb-24">
          {/* Background Image */}
          <div className="absolute inset-0 -z-10">
            <motion.img 
              initial={{ scale: 1.05, opacity: 0 }}
              animate={{ scale: 1, opacity: 0.3 }}
              transition={{ duration: 1, ease: [0.4, 0, 0.2, 1] }}
              src="/images/hero-backdrop.png"
              alt=""
              className="w-full h-full object-cover"
            />
            {/* Gradientes sutis */}
            <div className="absolute inset-0 bg-gradient-to-t from-neutral-100 via-neutral-100/80 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-neutral-100 via-neutral-100/50 to-transparent" />
          </div>
          
          {/* Content */}
          <div className="container mx-auto px-8 max-w-7xl">
            <div className="max-w-3xl space-y-6">
              {/* Label */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.5 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-400/10 border border-primary-400/20 text-primary-400 text-sm font-semibold tracking-wide uppercase"
              >
                <Clock className="w-4 h-4" />
                Começa em 2 dias
              </motion.div>
              
              {/* Headline */}
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="text-6xl font-display font-bold leading-tight tracking-tight text-neutral-1200"
              >
                Noite Noir <br/> Francesa
              </motion.h1>
              
              {/* Description */}
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="text-xl text-neutral-900 leading-relaxed max-w-2xl"
              >
                Uma seleção meticulosa de três clássicos do cinema noir francês, curados para a máxima atmosfera.
              </motion.p>
              
              {/* CTAs */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="flex items-center gap-4"
              >
                <button className="inline-flex items-center gap-2 px-6 py-3 bg-primary-400 text-white font-semibold rounded-lg shadow-lg shadow-primary-400/20 hover:bg-primary-500 hover:shadow-xl hover:shadow-primary-500/30 transition-all duration-200 tv-focus">
                  <Ticket className="w-5 h-5" />
                  Reservar Ingresso Virtual
                </button>
                <button className="inline-flex items-center gap-2 px-6 py-3 bg-transparent border border-neutral-500 text-neutral-1000 font-semibold rounded-lg hover:bg-neutral-300/30 hover:border-neutral-600 hover:text-neutral-1100 transition-all duration-200 tv-focus">
                  <Search className="w-5 h-5" />
                  Explorar Coleção Noir
                </button>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Content Sections */}
        <div className="px-16 space-y-32">

          {/* Continue Watching (Redesigned) */}
          <section className="relative mt-8">
            <div className="flex items-end justify-between mb-8">
              <h2 className="text-3xl font-serif text-white flex items-center gap-3">
                <Clock className="w-6 h-6 text-primary" />
                Continuar Assistindo
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                { title: "2001: Uma Odisseia no Espaço", time: "Restam 42m", progress: 75, img: "/images/hero-backdrop.png", ep: "Filme" },
                { title: "Stalker", time: "Restam 1h 15m", progress: 30, img: "/images/poster-2.png", ep: "Filme" }
              ].map((movie, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, type: "spring", stiffness: 100 }}
                  className="group relative rounded-3xl overflow-hidden bg-card/40 border border-white/10 tv-focus cursor-pointer block hover:border-primary/50 transition-colors shadow-2xl"
                >
                  <div className="aspect-video w-full relative overflow-hidden">
                    <img src={movie.img} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="" />
                    <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/20 to-transparent" />
                    
                    {/* Play Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/40 backdrop-blur-[2px]">
                      <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-white shadow-[0_0_30px_rgba(99,102,241,0.6)] transform scale-90 group-hover:scale-100 transition-all">
                        <Play className="w-8 h-8 ml-1" />
                      </div>
                    </div>
                  </div>

                  <div className="p-6 relative">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-xl font-serif text-white group-hover:text-primary transition-colors">{movie.title}</h3>
                      <span className="text-xs font-bold px-2 py-1 bg-white/10 rounded-md text-white/70">{movie.ep}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4 font-mono flex items-center gap-2">
                      <Clock className="w-3 h-3" /> {movie.time}
                    </p>
                    
                    <div className="h-1.5 w-full bg-black/50 rounded-full overflow-hidden border border-white/5 relative">
                      <div className="absolute top-0 left-0 h-full bg-primary rounded-full shadow-[0_0_10px_rgba(99,102,241,0.8)]" style={{ width: `${movie.progress}%` }} />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          {/* Recently Added (Polished) */}
          <section>
            <div className="flex items-end justify-between mb-12">
              <h2 className="text-4xl font-serif text-white flex items-center gap-4">
                <TrendingUp className="w-8 h-8 text-primary" />
                Recém Adicionados
              </h2>
            </div>
            <div className="flex gap-8 overflow-x-auto custom-scrollbar pb-10 pt-4 px-4 -mx-4 snap-x">
              {[
                { img: "/images/poster-4.png", title: "Barry Lyndon", badge: "4K HDR" },
                { img: "/images/poster-5.png", title: "Metropolis", badge: "REMUX" },
                { img: "/images/poster-1.png", title: "L'Aventura", badge: "1080p" },
                { img: "/images/poster-3.png", title: "Persona", badge: "ATMOS" },
                { img: "/images/poster-2.png", title: "Solaris", badge: "VISION" },
              ].map((movie, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, type: "spring" }}
                  className="snap-start shrink-0 w-72 group cursor-pointer tv-focus rounded-3xl"
                >
                  <div className="aspect-2/3 rounded-3xl overflow-hidden relative shadow-2xl border border-white/5 mb-4 group-hover:border-primary/50 transition-colors duration-500">
                    <img src={movie.img} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out" alt="" />
                    <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    
                    <div className="absolute top-4 right-4 bg-primary text-white text-[10px] font-black px-3 py-1.5 rounded-lg shadow-lg backdrop-blur-md uppercase tracking-[0.2em] border border-white/20">
                      NOVO
                    </div>
                    
                    {/* Hover Play Button */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 scale-90 group-hover:scale-100">
                      <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md border border-white/40">
                        <Play className="w-8 h-8 text-white ml-1" />
                      </div>
                    </div>
                  </div>
                  <h3 className="font-serif text-xl text-white group-hover:text-primary transition-colors duration-300 truncate">{movie.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-bold px-2 py-1 bg-white/5 rounded text-white/60 border border-white/10">{movie.badge}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          {/* Mood Playlists (New Feature) */}
          <section className="bg-card/20 rounded-[3rem] p-12 border border-white/5 backdrop-blur-xl relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-200 h-200 bg-primary/10 rounded-full blur-[120px] pointer-events-none -z-10 translate-x-1/3 -translate-y-1/4" />
            <div className="absolute bottom-0 left-0 w-150 h-150 bg-blue-500/5 rounded-full blur-[100px] pointer-events-none -z-10 -translate-x-1/4 translate-y-1/3" />
            
            <div className="flex flex-col lg:flex-row gap-16 relative z-10">
              <div className="lg:w-1/3 flex flex-col">
                <h2 className="text-5xl font-serif text-white flex items-center gap-4 mb-6 leading-tight">
                  <Compass className="w-10 h-10 text-primary shrink-0" />
                  Qual o seu <br/> humor hoje?
                </h2>
                <p className="text-muted-foreground text-xl mb-12 leading-relaxed font-light">
                  Deixe-nos guiar sua próxima sessão com base no que você está sentindo agora. Filmes escolhidos a dedo para cada emoção.
                </p>
                <div className="flex flex-wrap gap-4 mt-auto">
                  {["Melancólico", "Inspirador", "Tenso", "Contemplativo", "Épico"].map(mood => (
                    <button 
                      key={mood}
                      onClick={() => setActiveMood(mood)}
                      className={`px-6 py-3 rounded-2xl text-base font-medium transition-all tv-focus grow text-center
                        ${activeMood === mood 
                          ? 'bg-primary text-white shadow-[0_0_30px_rgba(99,102,241,0.4)] border-transparent scale-105' 
                          : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/10 hover:border-white/20'
                        }
                      `}
                    >
                      {mood}
                    </button>
                  ))}
                </div>
              </div>
              <div className="lg:w-2/3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-8">
                  <AnimatePresence mode="popLayout">
                    {recommendations.slice(0, 3).map((movie, i) => (
                      <motion.div 
                        key={`${activeMood}-${i}`}
                        initial={{ opacity: 0, scale: 0.8, rotateY: 20 }}
                        animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                        exit={{ opacity: 0, scale: 0.8, rotateY: -20 }}
                        transition={{ duration: 0.5, delay: i * 0.1, type: "spring" }}
                        className="group cursor-pointer tv-focus rounded-3xl relative perspective-[1000px]"
                      >
                        <div className="aspect-2/3 rounded-3xl overflow-hidden relative shadow-2xl border border-white/10 group-hover:border-primary/50 transition-colors">
                          <img src={movie.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="" />
                          <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/20 to-transparent opacity-60 group-hover:opacity-100 transition-opacity duration-500" />
                          <div className="absolute bottom-6 left-6 right-6 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-4 group-hover:translate-y-0">
                            <h3 className="font-serif text-xl text-white font-medium mb-2">{movie.title}</h3>
                            <div className="flex gap-2">
                              <span className="text-xs font-bold px-2 py-1 bg-primary/20 text-primary rounded backdrop-blur-md border border-primary/30">REMUX</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </section>

          {/* Directors in Spotlight (Polished) */}
          <section>
            <div className="flex items-end justify-between mb-8">
              <h2 className="text-3xl font-serif text-white flex items-center gap-3">
                <Target className="w-6 h-6 text-primary" />
                Auteurs em Destaque
              </h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { name: "Andrei Tarkovsky", era: "Anos 70/80", img: "https://i.pravatar.cc/300?u=tarkovsky" },
                { name: "Agnès Varda", era: "Nouvelle Vague", img: "https://i.pravatar.cc/300?u=varda" },
                { name: "Wong Kar-wai", era: "Anos 90/00", img: "https://i.pravatar.cc/300?u=wong" },
                { name: "Akira Kurosawa", era: "Épico Japonês", img: "https://i.pravatar.cc/300?u=kurosawa" },
              ].map((director, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="group cursor-pointer tv-focus rounded-3xl overflow-hidden relative aspect-square"
                >
                  <img src={director.img} className="w-full h-full object-cover grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700" alt={director.name} />
                  <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/20 to-transparent" />
                  <div className="absolute bottom-6 left-6 right-6">
                    <h3 className="font-serif text-xl text-white mb-1">{director.name}</h3>
                    <p className="text-sm font-medium text-primary uppercase tracking-wider">{director.era}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          {/* Curated Lists (Polished) */}
          <section>
            <div className="flex items-end justify-between mb-12">
              <h2 className="text-4xl font-serif text-white flex items-center gap-4">
                <Film className="w-8 h-8 text-primary" />
                Listas Curadas pela Comunidade
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { title: "Sight & Sound 2022: Top 100", creator: "BFI", count: 100 },
                { title: "Giallo Essencial", creator: "Cineclube Noir", count: 24 },
                { title: "Palma de Ouro Anos 60", creator: "Lumière Team", count: 10 }
              ].map((list, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: -30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.6, type: "spring", stiffness: 80 }}
                  className="bg-card/30 border border-white/5 rounded-3xl p-8 hover:bg-card/60 transition-all duration-500 tv-focus group cursor-pointer backdrop-blur-xl shadow-xl hover:shadow-[0_0_40px_rgba(99,102,241,0.15)] hover:border-primary/30 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-[30px] group-hover:bg-primary/10 transition-colors duration-500" />
                  
                  <h3 className="text-2xl font-serif text-white mb-4 group-hover:text-primary transition-colors duration-300 relative z-10">{list.title}</h3>
                  <div className="flex justify-between items-center text-sm mb-6 relative z-10">
                    <span className="text-white/60 flex items-center gap-2 font-medium"><Users className="w-4 h-4 text-white/40" /> {list.creator}</span>
                    <span className="font-bold text-primary bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-full tracking-wide">{list.count} FILMES</span>
                  </div>
                  
                  <div className="mt-auto flex -space-x-6 relative z-10">
                    <div className="w-16 h-16 rounded-full border-4 border-background overflow-hidden shadow-lg group-hover:-translate-y-2 transition-transform duration-300 delay-75"><img src={"/images/poster-1.png"} className="w-full h-full object-cover" alt="" /></div>
                    <div className="w-16 h-16 rounded-full border-4 border-background overflow-hidden shadow-lg group-hover:-translate-y-2 transition-transform duration-300 delay-100"><img src={"/images/poster-2.png"} className="w-full h-full object-cover" alt="" /></div>
                    <div className="w-16 h-16 rounded-full border-4 border-background overflow-hidden shadow-lg group-hover:-translate-y-2 transition-transform duration-300 delay-150"><img src={"/images/poster-3.png"} className="w-full h-full object-cover" alt="" /></div>
                    <div className="w-16 h-16 rounded-full border-4 border-background bg-primary flex items-center justify-center text-sm font-bold text-white shadow-lg group-hover:-translate-y-2 transition-transform duration-300 delay-200">+{list.count - 3}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          {/* Live Sessions (Polished) */}
          <section>
            <div className="flex items-end justify-between mb-12">
              <h2 className="text-4xl font-serif text-white flex items-center gap-4">
                <Users className="w-8 h-8 text-primary" />
                Sessões ao Vivo da Comunidade
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {[
                { title: "Maratona Tarkovsky", host: "Cineclube BR", viewers: 124, img: "/images/poster-2.png", status: "Ao Vivo" },
                { title: "Clássicos dos Anos 60", host: "Ana C.", viewers: 8, img: "/images/poster-3.png", status: "Ao Vivo" }
              ].map((party, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  className="flex flex-col sm:flex-row items-center gap-8 p-6 rounded-[2rem] bg-card/30 border border-white/5 hover:bg-card/50 transition-all duration-500 cursor-pointer group tv-focus backdrop-blur-xl hover:shadow-[0_0_30px_rgba(239,68,68,0.1)] hover:border-red-500/30"
                >
                  <div className="w-full sm:w-48 h-32 rounded-2xl overflow-hidden relative shrink-0 shadow-lg">
                    <img src={party.img} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 ease-out" alt="" />
                    <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 backdrop-blur-md shadow-[0_0_15px_rgba(239,68,68,0.5)]">
                        <span className="w-2 h-2 rounded-full bg-white animate-pulse" /> {party.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 w-full text-center sm:text-left">
                    <h3 className="text-2xl font-serif text-white mb-3 group-hover:text-red-400 transition-colors duration-300">{party.title}</h3>
                    <div className="flex flex-col sm:flex-row items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full"><Users className="w-4 h-4" /> Host: <span className="text-white font-medium">{party.host}</span></span>
                      <span className="flex items-center gap-2 text-red-400 bg-red-500/10 px-3 py-1.5 rounded-full font-bold border border-red-500/20"><Eye className="w-4 h-4" /> {party.viewers} assistindo</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
          
          {/* This Week in Cinema History (Polished) */}
          <section className="bg-card/20 border border-white/5 rounded-[3rem] p-12 backdrop-blur-xl relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 left-0 w-150 h-150 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none -z-10 -translate-x-1/4 -translate-y-1/4" />
            <div className="flex flex-col md:flex-row gap-16 items-center relative z-10">
              <div className="w-64 h-64 rounded-full border-[6px] border-background overflow-hidden shrink-0 shadow-[0_0_50px_rgba(59,130,246,0.15)] relative group cursor-pointer">
                <img src={"/images/poster-5.png"} className="w-full h-full object-cover filter grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700 ease-out scale-105 group-hover:scale-100" alt="" />
                <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 scale-90 group-hover:scale-100">
                  <div className="w-20 h-20 bg-blue-500/90 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.6)] backdrop-blur-sm">
                    <Play className="w-10 h-10 text-white ml-2" />
                  </div>
                </div>
              </div>
              <div className="flex-1">
                <h2 className="text-4xl font-serif text-white flex items-center gap-4 mb-6">
                  <CalendarDays className="w-8 h-8 text-blue-400" />
                  Nesta Semana na História
                </h2>
                <h3 className="text-3xl font-bold text-transparent bg-clip-text bg-linear-to-r from-blue-400 to-purple-400 mb-4">Há exatos 97 anos...</h3>
                <p className="text-xl text-white/70 leading-relaxed max-w-4xl mb-8 font-light">
                  <strong className="text-white font-medium">Metropolis</strong>, de Fritz Lang, tinha sua estreia mundial em Berlim (10 de Janeiro de 1927). Uma obra visionária que definiu a estética da ficção científica por quase um século e cujos ecos visuais perduram até hoje.
                </p>
                <div className="flex flex-wrap items-center gap-4">
                  <button className="px-8 py-4 bg-white text-black font-bold rounded-2xl hover:bg-gray-200 transition-all duration-300 tv-focus flex items-center gap-3 text-lg shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:scale-105">
                    <Play className="w-6 h-6 fill-current" /> Assistir REMUX 4K
                  </button>
                  <button className="px-8 py-4 bg-white/5 text-white font-medium rounded-2xl hover:bg-white/10 transition-all duration-300 border border-white/10 hover:border-white/20 tv-focus flex items-center gap-3 text-lg">
                    <Eye className="w-6 h-6" /> Ler Artigo Especial
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Recommendations (Polished) */}
          <section>
            <div className="flex items-end justify-between mb-12">
              <div>
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  className="flex items-center gap-2 text-primary mb-3 font-bold tracking-[0.2em] uppercase text-xs"
                >
                  <Sparkles className="w-4 h-4" />
                  Para Você
                </motion.div>
                <motion.h2 
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  className="text-4xl font-serif text-white"
                >
                  Recomendações da Semana
                </motion.h2>
              </div>
              <button className="flex items-center gap-3 text-white/50 hover:text-white transition-colors group tv-focus rounded-full px-6 py-3 hover:bg-white/5 border border-transparent hover:border-white/10">
                <span className="text-xs font-bold uppercase tracking-[0.2em]">Ver catálogo completo</span>
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-primary transition-colors">
                  <ChevronRight className="w-4 h-4 group-hover:text-white" />
                </div>
              </button>
            </div>
            
            <section className="py-24">
              <div className="container mx-auto px-8 max-w-7xl">
                {/* Section Header */}
                <div className="flex items-end justify-between mb-12">
                  <div>
                    <h2 className="text-4xl font-heading font-semibold text-neutral-1200 mb-2">
                      Recomendações da Semana
                    </h2>
                    <p className="text-lg text-neutral-800">
                      Curadoria especial baseada no seu perfil
                    </p>
                  </div>
                  
                  <Button variant="ghost" size="md" rightIcon={<ChevronRight />}>
                    Ver catálogo completo
                  </Button>
                </div>
                
                {/* Grid - spacing reduzido para 6 (24px) */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                  {recommendations.map((movie, i) => (
                    <MovieCard 
                      key={movie.id}
                      {...movie}
                      index={i}                    />
                  ))}
                </div>
              </div>
            </section>
          </section>

          {/* Cinephile Articles (Polished) */}
          <section className="mb-24">
            <div className="flex items-end justify-between mb-12">
              <h2 className="text-4xl font-serif text-white flex items-center gap-4">
                <BookOpen className="w-8 h-8 text-primary" />
                Leituras Essenciais
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="group cursor-pointer tv-focus rounded-[2.5rem] overflow-hidden relative aspect-video shadow-2xl">
                <img src={"/images/poster-3.png"} className="w-full h-full object-cover transform scale-105 group-hover:scale-100 transition-transform duration-1000 ease-out opacity-70 group-hover:opacity-100 mix-blend-luminosity group-hover:mix-blend-normal" alt="" />
                <div className="absolute inset-0 bg-linear-to-t from-black via-black/40 to-transparent opacity-90 group-hover:opacity-80 transition-opacity duration-500" />
                <div className="absolute inset-0 border-2 border-white/0 group-hover:border-primary/30 rounded-[2.5rem] transition-colors duration-500 pointer-events-none" />
                
                <div className="absolute inset-0 p-10 flex flex-col justify-end transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                  <span className="text-primary font-black uppercase tracking-[0.2em] text-sm mb-4 drop-shadow-md">Ensaio</span>
                  <h3 className="text-3xl font-serif text-white mb-3 leading-tight group-hover:text-primary transition-colors duration-300 drop-shadow-lg">A Desconstrução da Identidade em Persona</h3>
                  <p className="text-base text-white/80 line-clamp-2 leading-relaxed max-w-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100">Uma análise profunda sobre como Ingmar Bergman utilizou a fusão de rostos e a quebra da quarta parede para explorar o subconsciente humano.</p>
                </div>
              </div>
              <div className="group cursor-pointer tv-focus rounded-[2.5rem] overflow-hidden relative aspect-video shadow-2xl">
                <img src={"/images/poster-4.png"} className="w-full h-full object-cover transform scale-105 group-hover:scale-100 transition-transform duration-1000 ease-out opacity-70 group-hover:opacity-100 mix-blend-luminosity group-hover:mix-blend-normal" alt="" />
                <div className="absolute inset-0 bg-linear-to-t from-black via-black/40 to-transparent opacity-90 group-hover:opacity-80 transition-opacity duration-500" />
                <div className="absolute inset-0 border-2 border-white/0 group-hover:border-blue-400/30 rounded-[2.5rem] transition-colors duration-500 pointer-events-none" />

                <div className="absolute inset-0 p-10 flex flex-col justify-end transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                  <span className="text-blue-400 font-black uppercase tracking-[0.2em] text-sm mb-4 drop-shadow-md">Técnica</span>
                  <h3 className="text-3xl font-serif text-white mb-3 leading-tight group-hover:text-blue-400 transition-colors duration-300 drop-shadow-lg">A Luz Natural de Barry Lyndon</h3>
                  <p className="text-base text-white/80 line-clamp-2 leading-relaxed max-w-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100">Como Stanley Kubrick e John Alcott utilizaram lentes da NASA criadas para o programa Apollo para filmar cenas iluminadas apenas por velas.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Upcoming Sessions (Polished) */}
          <section>
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-4xl font-serif text-white mb-12 flex items-center gap-4"
            >
              <CalendarDays className="w-8 h-8 text-primary" />
              Suas Próximas Sessões
            </motion.h2>
            <div className="flex gap-8 overflow-x-auto pb-12 pt-4 px-4 -mx-4 hide-scrollbar snap-x">
              {[1, 2, 3].map((session, i) => (
                <motion.button 
                  key={session}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, type: "spring" }}
                  className="snap-start relative min-w-120 h-64 rounded-[2rem] overflow-hidden tv-focus group text-left shrink-0 shadow-2xl"
                >
                  <div className="absolute inset-0 bg-card/40 backdrop-blur-xl border border-white/5 rounded-[2rem] group-hover:bg-card/60 transition-all duration-500 z-0 group-hover:border-primary/30" />
                  
                  {/* Decorative blur blob */}
                  <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary/20 rounded-full blur-[60px] group-hover:bg-primary/40 transition-colors duration-700 z-0" />
                  <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-colors duration-700 z-0" />
                  
                  <div className="relative p-10 flex flex-col h-full justify-between z-10">
                    <div className="flex justify-between items-start">
                      <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 shadow-inner group-hover:scale-110 transition-transform duration-500">
                        <span className="text-3xl filter drop-shadow-md">{i === 0 ? '🌌' : i === 1 ? '🎭' : '⚔️'}</span>
                      </div>
                      <span className="px-5 py-2 rounded-full bg-primary/10 text-primary border border-primary/20 text-sm font-bold tracking-widest uppercase shadow-[0_0_20px_rgba(99,102,241,0.15)]">
                        Sáb, 20:00
                      </span>
                    </div>
                    <div>
                      <h3 className="text-3xl font-serif font-medium text-white mb-3 group-hover:text-primary transition-colors duration-300">
                        {i === 0 ? 'Sci-Fi Contemplativo' : i === 1 ? 'Drama Europeu' : 'Épicos de Samurai'}
                      </h3>
                      <p className="text-white/60 text-sm flex items-center gap-3 font-medium uppercase tracking-wider">
                        <span className="flex items-center gap-1.5"><Film className="w-4 h-4" /> 3 filmes</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
                        <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> 6h 12m</span>
                      </p>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}