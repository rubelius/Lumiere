'use client';
import { Sidebar } from "@/components/layout/Sidebar";
import { QualityBadge } from "@/components/ui/quality-badge";
import { MovieCard } from "@/components/ui/movie-card";
import { Download, Play, CheckCircle2, ChevronLeft, Star, Clock, Calendar, Globe, Plus, Heart, Share2, Film, Pause, SkipBack, SkipForward, Volume2, Maximize, MessageSquare, Award, Image as ImageIcon, Music, Subtitles, Settings2, Layers, Bookmark, Camera } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";


export default function MovieDetail() {
  const [isTrailerOpen, setIsTrailerOpen] = useState(false);
  const [isCollectionOpen, setIsCollectionOpen] = useState(false);
  const [showFullSynopsis, setShowFullSynopsis] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const releases = [
    { group: "FraMeSToR", res: "2160p", audio: "TrueHD Atmos 7.1", size: "86.4 GB", score: 98, type: "REMUX" },
    { group: "EPSiLON", res: "2160p", audio: "DTS-HD MA 7.1", size: "75.2 GB", score: 92, type: "ENCODE" },
    { group: "DON", res: "1080p", audio: "DTS 5.1", size: "24.1 GB", score: 85, type: "ENCODE" },
  ];

  const similarMovies = [
    { id: 2, title: "Solaris", year: "1972", img: "/images/poster-2.png", qualities: ["4K", "HDR"] as any },
    { id: 3, title: "Persona", year: "1966", img: "/images/poster-3.png", qualities: ["REMUX", "ATMOS"] as any },
    { id: 4, title: "Barry Lyndon", year: "1975", img: "/images/poster-4.png", qualities: ["4K"] as any },
    { id: 5, title: "Metropolis", year: "1927", img: "/images/poster-5.png", qualities: ["REMUX", "HDR"] as any },
  ];

  const cast = [
    { name: "Monica Vitti", role: "Claudia", img: "https://i.pravatar.cc/150?u=vitti" },
    { name: "Gabriele Ferzetti", role: "Sandro", img: "https://i.pravatar.cc/150?u=ferzetti" },
    { name: "Léa Massari", role: "Anna", img: "https://i.pravatar.cc/150?u=massari" },
    { name: "Dominique Blanchar", role: "Giulia", img: "https://i.pravatar.cc/150?u=blanchar" },
    { name: "James Addams", role: "Corrado", img: "https://i.pravatar.cc/150?u=addams" },
  ];

  const festivals = [
    { name: "Festival de Cannes", award: "Prêmio do Júri", year: "1960" },
    { name: "BAFTA Awards", award: "Indicado Melhor Filme", year: "1961" },
  ];

  const reviews = [
    { author: "Pauline Kael", outlet: "Cahiers du Cinéma", score: 100, text: "Antonioni transformou o cinema com sua gramática visual do vazio e da alienação." },
    { author: "Roger Ebert", outlet: "The New Yorker", score: 90, text: "Um dos filmes mais belos e dolorosos sobre a incomunicabilidade moderna." },
  ];

  const technicalSpecs = [
    { label: "Aspect Ratio", value: "1.85:1" },
    { label: "Câmera", value: "Mitchell BNC" },
    { label: "Lentes", value: "Cooke Speed Panchro" },
    { label: "Processo Cinematográfico", value: "Spherical (35mm)" },
    { label: "Som Original", value: "Mono (Westrex Recording System)" },
    { label: "Diretor de Fotografia", value: "Aldo Scavarda" },
    { label: "Design de Produção", value: "Piero Poletto" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground pl-24 selection:bg-primary/30 pb-32 overflow-x-hidden">
      <div className="fixed inset-0 bg-noise opacity-[0.03] mix-blend-overlay pointer-events-none z-50" />
      <Sidebar />
      
      {/* Trailer Modal (New Feature) */}
      <AnimatePresence>
        {isTrailerOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-200 bg-black/90 backdrop-blur-2xl flex items-center justify-center p-12"
            onClick={() => setIsTrailerOpen(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-7xl aspect-video bg-black rounded-3xl overflow-hidden shadow-[0_0_100px_rgba(0,0,0,1)] border border-white/10 relative group/player"
              onClick={e => e.stopPropagation()}
            >
              {/* Mock Video Player (Enhanced Feature) */}
              <div className="absolute inset-0">
                <img src={"/images/hero-backdrop.png"} className="w-full h-full object-cover opacity-80" alt="Video Poster" />
              </div>
              
              {/* Top Bar */}
              <div className="absolute top-0 left-0 right-0 p-6 bg-linear-to-b from-black/80 to-transparent flex justify-between items-start opacity-0 group-hover/player:opacity-100 transition-opacity duration-300">
                <h3 className="text-2xl font-serif text-white font-medium">L'Aventura - Trailer Oficial</h3>
                <button 
                  onClick={() => setIsTrailerOpen(false)}
                  className="w-12 h-12 bg-black/50 hover:bg-white/20 rounded-full flex items-center justify-center text-white backdrop-blur-md transition-colors tv-focus"
                >
                  ✕
                </button>
              </div>

              {/* Bottom Controls */}
              <div className="absolute bottom-0 left-0 right-0 p-6 bg-linear-to-t from-black/90 via-black/50 to-transparent opacity-0 group-hover/player:opacity-100 transition-opacity duration-300 flex flex-col gap-4">
                {/* Progress */}
                <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden cursor-pointer relative tv-focus hover:h-2 transition-all">
                  <div className="absolute top-0 left-0 h-full bg-primary w-1/3" />
                </div>
                
                {/* Buttons */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <button className="text-white hover:text-primary transition-colors tv-focus"><SkipBack className="w-6 h-6" fill="currentColor" /></button>
                    <button className="text-white hover:text-primary transition-colors tv-focus"><Pause className="w-8 h-8" fill="currentColor" /></button>
                    <button className="text-white hover:text-primary transition-colors tv-focus"><SkipForward className="w-6 h-6" fill="currentColor" /></button>
                    <div className="flex items-center gap-2 ml-4">
                      <Volume2 className="w-5 h-5 text-white" />
                      <div className="w-24 h-1.5 bg-white/20 rounded-full"><div className="w-2/3 h-full bg-white rounded-full" /></div>
                    </div>
                    <span className="text-sm font-mono text-white/70 ml-2">01:24 / 02:45</span>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2 relative group/audio">
                      <button className="text-white hover:text-primary transition-colors tv-focus flex items-center gap-2"><Settings2 className="w-5 h-5" /> Áudio</button>
                      <div className="absolute bottom-full mb-2 bg-card/90 backdrop-blur-xl border border-white/10 rounded-xl p-2 hidden group-hover/audio:block min-w-40 z-50">
                        <div className="text-xs text-white/50 mb-2 px-2">Trilha de Áudio</div>
                        <button className="w-full text-left px-3 py-2 text-sm text-primary bg-white/10 rounded-lg font-medium">ITA - TrueHD Atmos</button>
                        <button className="w-full text-left px-3 py-2 text-sm text-white hover:bg-white/5 rounded-lg">ENG - Dolby Digital</button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 relative group/sub">
                      <button className="text-white hover:text-primary transition-colors tv-focus flex items-center gap-2"><Subtitles className="w-5 h-5" /> Legendas</button>
                      <div className="absolute bottom-full mb-2 bg-card/90 backdrop-blur-xl border border-white/10 rounded-xl p-2 hidden group-hover/sub:block min-w-40 z-50">
                        <div className="text-xs text-white/50 mb-2 px-2">Legendas</div>
                        <button className="w-full text-left px-3 py-2 text-sm text-primary bg-white/10 rounded-lg font-medium">PT-BR (Forced)</button>
                        <button className="w-full text-left px-3 py-2 text-sm text-white hover:bg-white/5 rounded-lg">ENG (SDH)</button>
                        <button className="w-full text-left px-3 py-2 text-sm text-white/50 hover:bg-white/5 rounded-lg">Desativar</button>
                      </div>
                    </div>
                    <button className="text-white font-bold text-sm px-2 py-1 rounded border border-white/20 hover:bg-white/10 tv-focus">4K</button>
                    <button className="text-white hover:text-primary transition-colors tv-focus"><Maximize className="w-6 h-6" /></button>
                  </div>
                </div>
              </div>
              
              {/* Big center play/pause for clicking */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                 <div className="w-24 h-24 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/80 opacity-0 group-hover/player:opacity-100 transition-opacity transform scale-150 group-hover/player:scale-100 duration-500">
                    <Pause className="w-10 h-10" fill="currentColor" />
                 </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backdrop */}
      <div className="absolute top-0 left-0 right-0 h-[85vh] -z-10 overflow-hidden">
        <motion.img 
          initial={{ scale: 1.1, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.4 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          src={"/images/hero-backdrop.png"} 
          className="w-full h-full object-cover mix-blend-luminosity" 
          alt="" 
        />
        <div className="absolute inset-0 bg-linear-to-t from-background via-background/80 to-transparent" />
        <div className="absolute inset-0 bg-linear-to-r from-background via-background/50 to-transparent" />
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-background" />
      </div>

      <main className="max-w-480 mx-auto px-16 pt-16">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <Link 
            href="/"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-white mb-12 tv-focus rounded-full px-5 py-2.5 bg-white/5 backdrop-blur-md border border-white/10 transition-all hover:bg-white/10"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="font-medium">Voltar</span>
          </Link>
        </motion.div>

        <div className="flex flex-col lg:flex-row gap-16 items-start mb-24">
          
          {/* Left Column: Poster */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="w-85 shrink-0"
          >
            <div className="aspect-2/3 rounded-3xl overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.9)] border border-white/10 relative group">
              <img src={"/images/poster-1.png"} alt="Poster" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <button 
                onClick={() => setIsTrailerOpen(true)}
                className="absolute inset-0 m-auto w-20 h-20 bg-primary/90 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all duration-300 scale-75 group-hover:scale-100 shadow-[0_0_30px_rgba(99,102,241,0.6)] backdrop-blur-md"
              >
                <Play className="w-8 h-8 ml-1" />
              </button>
            </div>
            
            {/* Download / Collections Button Group (New Feature) */}
            <div className="mt-8 relative flex gap-2">
              <button className="flex-1 py-5 rounded-2xl bg-white text-background font-bold text-lg flex items-center justify-center gap-3 tv-focus shadow-[0_0_30px_rgba(255,255,255,0.15)] hover:bg-gray-100 transition-colors">
                <Download className="w-6 h-6" />
                Baixar
              </button>
              
              <div className="relative">
                <button 
                  onClick={() => setIsCollectionOpen(!isCollectionOpen)}
                  className="w-16 h-full rounded-2xl bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors border border-white/10 tv-focus"
                >
                  <Plus className="w-6 h-6" />
                </button>

                {/* Collection Dropdown */}
                <AnimatePresence>
                  {isCollectionOpen && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute top-full right-0 mt-4 w-64 bg-card/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 p-2"
                    >
                      <h4 className="px-3 py-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">Adicionar à Coleção</h4>
                      <button className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/10 text-white transition-colors text-left tv-focus">
                        <Heart className="w-5 h-5 text-primary" /> Favoritos
                      </button>
                      <button className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/10 text-white transition-colors text-left tv-focus">
                        <Clock className="w-5 h-5 text-blue-400" /> Assistir Depois
                      </button>
                      <div className="h-px bg-white/10 my-2 mx-2" />
                      <button className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-xl hover:bg-white/10 text-white/70 transition-colors text-sm font-medium tv-focus">
                        <Plus className="w-4 h-4" /> Nova Coleção
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            <p className="text-center text-sm text-quality-remux mt-4 flex items-center justify-center gap-2 font-medium bg-quality-remux/10 py-2 rounded-lg border border-quality-remux/20">
              <CheckCircle2 className="w-4 h-4" />
              Cacheado no Real-Debrid
            </p>
          </motion.div>

          {/* Right Column: Info */}
          <div className="flex-1 max-w-5xl pt-4">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-6xl lg:text-8xl font-serif font-bold text-white mb-2 text-glow leading-tight"
            >
              L'Aventura
            </motion.h1>

            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              transition={{ delay: 0.3 }}
              className="flex items-center gap-3 mb-6"
            >
              <span className="px-3 py-1 rounded border border-white/20 bg-white/5 text-xs font-bold uppercase tracking-widest text-white backdrop-blur-sm flex items-center gap-2">
                <Bookmark className="w-3 h-3 text-yellow-500" />
                The Criterion Collection #98
              </span>
              <span className="px-3 py-1 rounded border border-white/20 bg-white/5 text-xs font-bold uppercase tracking-widest text-white backdrop-blur-sm flex items-center gap-2">
                <Award className="w-3 h-3 text-purple-400" />
                Sight & Sound Top 250
              </span>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-wrap items-center gap-4 text-lg text-white/70 mb-10 font-light"
            >
              <span className="flex items-center gap-2 bg-white/5 px-4 py-1.5 rounded-full border border-white/10"><Calendar className="w-4 h-4" /> 1960</span>
              <span className="flex items-center gap-2 bg-white/5 px-4 py-1.5 rounded-full border border-white/10"><Star className="w-4 h-4" /> Michelangelo Antonioni</span>
              <span className="flex items-center gap-2 bg-white/5 px-4 py-1.5 rounded-full border border-white/10"><Clock className="w-4 h-4" /> 2h 23m</span>
              <span className="flex items-center gap-2 bg-white/5 px-4 py-1.5 rounded-full border border-white/10"><Globe className="w-4 h-4" /> Itália</span>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex flex-wrap gap-4 mb-12"
            >
              <QualityBadge type="REMUX" />
              <QualityBadge type="4K" />
              <QualityBadge type="VISION" />
              <QualityBadge type="ATMOS" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="mb-16 max-w-4xl"
            >
              <p className={`text-2xl leading-relaxed text-gray-300 font-light ${!showFullSynopsis && 'line-clamp-3'}`}>
                O desaparecimento de uma jovem durante uma viagem de barco pelo Mediterrâneo estimula seu amante e sua melhor amiga a iniciarem uma busca pela moça. Durante a procura, os dois se apaixonam, num processo de alienação e falta de comunicação característica do cinema de Antonioni. A paisagem estéril das ilhas eólias reflete o vazio existencial dos personagens, criando uma obra-prima do cinema moderno.
              </p>
              <button 
                onClick={() => setShowFullSynopsis(!showFullSynopsis)}
                className="mt-4 text-primary font-medium hover:text-white transition-colors tv-focus uppercase tracking-wider text-sm"
              >
                {showFullSynopsis ? 'Ler menos' : 'Ler sinopse completa'}
              </button>
            </motion.div>

            {/* Tabs for Organization */}
            <div className="flex gap-8 mb-12 border-b border-white/10">
              {[
                { id: "overview", label: "Visão Geral" },
                { id: "details", label: "Críticas & Prêmios" },
                { id: "media", label: "Galeria & Trilha" }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`pb-4 text-lg font-medium transition-all relative tv-focus outline-none ${activeTab === tab.id ? 'text-white' : 'text-white/50 hover:text-white/80'}`}
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                  )}
                </button>
              ))}
            </div>

            {/* Tab: Overview */}
            {activeTab === "overview" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-16">
                
                {/* User Rating System */}
                <div className="flex items-center gap-8 bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-sm w-fit">
                  <div className="text-center pr-8 border-r border-white/10">
                    <span className="block text-4xl font-serif font-bold text-white mb-1">8.6</span>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Comunidade</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white/70 mb-3">Sua Avaliação</p>
                    <div className="flex items-center gap-2">
                      {[1,2,3,4,5].map(star => (
                        <button key={star} className="tv-focus text-white/20 hover:text-primary hover:scale-110 transition-all focus:text-primary outline-none">
                          <Star className="w-8 h-8 fill-current" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Director & Cinematographer Spotlight */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Director */}
                  <div className="bg-linear-to-br from-card/80 to-transparent border border-white/5 rounded-3xl p-6 backdrop-blur-sm flex items-center gap-6 group hover:border-white/10 transition-colors">
                    <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-primary/50 shrink-0">
                      <img src="https://i.pravatar.cc/150?u=antonioni" alt="Director" className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" />
                    </div>
                    <div>
                      <h4 className="text-xs text-primary uppercase tracking-widest font-bold mb-1">Auteur / Diretor</h4>
                      <h3 className="text-2xl font-serif text-white mb-2">Michelangelo Antonioni</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">Mestre do modernismo italiano, redefiniu a narrativa cinematográfica.</p>
                    </div>
                  </div>

                  {/* Cinematographer */}
                  <div className="bg-linear-to-br from-card/80 to-transparent border border-white/5 rounded-3xl p-6 backdrop-blur-sm flex items-center gap-6 group hover:border-white/10 transition-colors">
                    <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-blue-500/50 shrink-0 bg-blue-500/10 flex items-center justify-center">
                      <Camera className="w-8 h-8 text-blue-400 grayscale group-hover:grayscale-0 transition-all duration-500" />
                    </div>
                    <div>
                      <h4 className="text-xs text-blue-400 uppercase tracking-widest font-bold mb-1">Diretor de Fotografia</h4>
                      <h3 className="text-2xl font-serif text-white mb-2">Aldo Scavarda</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">Criou composições milimetricamente calculadas usando película 35mm P&B.</p>
                    </div>
                  </div>
                </div>

                {/* Cast Carousel */}
                <div>
                  <h3 className="text-2xl font-serif text-white mb-6">Elenco Principal</h3>
                  <div className="flex gap-6 overflow-x-auto hide-scrollbar pb-4 -mx-4 px-4 snap-x">
                    {cast.map((actor, i) => (
                      <div key={i} className="snap-start shrink-0 text-center w-32 group cursor-pointer tv-focus rounded-2xl p-2 hover:bg-white/5 transition-colors">
                        <div className="w-24 h-24 mx-auto rounded-full overflow-hidden mb-4 border-2 border-white/10 group-hover:border-primary transition-colors">
                          <img src={actor.img} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" alt={actor.name} />
                        </div>
                        <p className="text-sm font-medium text-white mb-1 leading-tight">{actor.name}</p>
                        <p className="text-xs text-muted-foreground">{actor.role}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Releases Section */}
                <div>
                  <div className="flex items-end justify-between mb-8 border-b border-white/10 pb-4">
                    <h3 className="text-3xl font-serif text-white">Melhores Releases</h3>
                    <span className="text-muted-foreground text-sm font-medium uppercase tracking-wider">3 encontrados</span>
                  </div>
                  
                  <div className="space-y-4">
                    {releases.map((release, i) => (
                      <motion.button 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        key={i}
                        className="w-full flex items-center justify-between p-5 rounded-2xl bg-card/40 backdrop-blur-sm border border-white/5 tv-focus group hover:bg-card/80 transition-all text-left overflow-hidden relative"
                      >
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary scale-y-0 group-hover:scale-y-100 transition-transform origin-center" />
                        
                        <div className="flex items-center gap-8 pl-2">
                          {/* Score Circle */}
                          <div className="relative w-14 h-14 flex items-center justify-center shrink-0">
                            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                              <path
                                className="text-white/10"
                                strokeWidth="3"
                                stroke="currentColor"
                                fill="transparent"
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                              />
                              <path
                                className={release.score > 90 ? "text-quality-remux" : "text-[#F59E0B]"}
                                strokeWidth="3"
                                strokeDasharray={`${release.score}, 100`}
                                strokeLinecap="round"
                                stroke="currentColor"
                                fill="transparent"
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                              />
                            </svg>
                            <span className="absolute text-sm font-bold text-white">{release.score}</span>
                          </div>
                          
                          <div>
                            <div className="flex items-center gap-4 mb-1.5">
                              <span className="text-xl font-medium text-white">{release.group}</span>
                              <div className="flex gap-2">
                                <span className="text-xs font-bold px-2 py-1 rounded-md bg-white/10 text-white tracking-wider">{release.res}</span>
                                <span className="text-xs font-bold px-2 py-1 rounded-md bg-primary/20 text-primary tracking-wider">{release.type}</span>
                              </div>
                            </div>
                            <p className="text-base text-muted-foreground flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-white/20" />
                              {release.audio}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-8 pr-2">
                          <div className="text-right">
                            <span className="block text-xl text-white font-mono tracking-tight">{release.size}</span>
                            <span className="text-sm text-muted-foreground">Tamanho</span>
                          </div>
                          <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-primary group-hover:border-primary group-hover:text-white transition-all group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(99,102,241,0.4)]">
                            <Play className="w-5 h-5 ml-1" />
                          </div>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>
                {/* Double Feature Recommendation */}
                <div className="mt-16 bg-linear-to-b from-purple-900/20 to-transparent border border-purple-500/20 rounded-[3rem] p-12 backdrop-blur-md relative overflow-hidden shadow-2xl">
                  <div className="absolute top-0 right-0 w-150 h-150 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none translate-x-1/4 -translate-y-1/4" />
                  
                  <div className="flex items-center gap-4 mb-12">
                    <Layers className="w-8 h-8 text-purple-400" />
                    <h3 className="text-3xl font-serif text-white">Sessão Dupla Sugerida</h3>
                    <span className="ml-auto text-sm font-bold px-4 py-1.5 bg-purple-500/20 text-purple-300 rounded-full border border-purple-500/30 uppercase tracking-[0.2em]">O Vazio Existencial</span>
                  </div>

                  <div className="flex flex-col md:flex-row gap-12 items-center">
                    <div className="w-56 h-84 rounded-3xl overflow-hidden shrink-0 shadow-[0_0_40px_rgba(0,0,0,0.5)] border border-white/10 group tv-focus cursor-pointer">
                      <img src={"/images/poster-1.png"} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="" />
                    </div>
                    
                    <div className="flex-1 flex justify-center text-purple-400/50">
                      <div className="w-16 h-16 rounded-full bg-card border-4 border-background flex items-center justify-center shadow-xl">
                        <Plus className="w-8 h-8 text-purple-400/50" />
                      </div>
                    </div>

                    <div className="w-56 h-84 rounded-3xl overflow-hidden shrink-0 shadow-[0_0_40px_rgba(0,0,0,0.5)] border border-white/10 group tv-focus cursor-pointer">
                      <img src={"/images/poster-3.png"} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="" />
                      <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <div className="absolute bottom-6 left-6 right-6 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 text-center">
                        <span className="px-3 py-1 bg-purple-500 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-lg">Assistir a seguir</span>
                      </div>
                    </div>

                    <div className="flex-2 pl-12 border-l border-white/10">
                      <h4 className="text-3xl font-serif text-white mb-4">L'Aventura + Persona</h4>
                      <p className="text-white/60 text-lg font-light leading-relaxed mb-8">
                        Uma exploração profunda da incomunicabilidade e identidade. Comece com a paisagem estéril de Antonioni e termine com a desconstrução psicológica de Bergman. Ambas obras-primas do cinema europeu dos anos 60.
                      </p>
                      <button className="text-sm font-bold bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl transition-colors border border-white/10 tv-focus">
                        Adicionar Sessão à Fila
                      </button>
                    </div>
                  </div>
                </div>

              </motion.div>
            )}

            {/* Tab: Critics & Awards */}
            {activeTab === "details" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-16">
                
                {/* Awards */}
                <div>
                  <h3 className="text-2xl font-serif text-white mb-6 flex items-center gap-3">
                    <Award className="w-6 h-6 text-primary" /> Premiações
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {festivals.map((fest, i) => (
                      <div key={i} className="flex items-center gap-4 p-5 rounded-2xl bg-card/30 border border-white/5 tv-focus group">
                        <div className="w-12 h-12 rounded-full border border-yellow-500/30 flex items-center justify-center text-yellow-500 bg-yellow-500/10 shrink-0">
                          <Award className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-lg group-hover:text-primary transition-colors">{fest.award}</h4>
                          <p className="text-sm text-muted-foreground">{fest.name} • {fest.year}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Reviews */}
                <div>
                  <h3 className="text-2xl font-serif text-white mb-6 flex items-center gap-3">
                    <MessageSquare className="w-6 h-6 text-primary" /> Críticas em Destaque
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {reviews.map((review, i) => (
                      <div key={i} className="p-8 rounded-3xl bg-white/5 border border-white/10 tv-focus group relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-[100px] -z-10" />
                        <div className="text-4xl text-primary/40 font-serif leading-none mb-4">"</div>
                        <p className="text-lg text-white/90 italic font-light mb-6 leading-relaxed">
                          {review.text}
                        </p>
                        <div className="flex items-center justify-between mt-auto">
                          <div>
                            <h4 className="font-bold text-white">{review.author}</h4>
                            <p className="text-sm text-muted-foreground">{review.outlet}</p>
                          </div>
                          <div className="w-12 h-12 rounded-full bg-green-500/20 text-green-400 font-bold flex items-center justify-center border border-green-500/30">
                            {review.score}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Technical Specs */}
                <div>
                  <h3 className="text-2xl font-serif text-white mb-6">Ficha Técnica</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-12 p-8 rounded-3xl bg-card/40 border border-white/5">
                    {technicalSpecs.map((spec, i) => (
                      <div key={i} className="border-b border-white/5 pb-4">
                        <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1 font-bold">{spec.label}</p>
                        <p className="text-white font-medium">{spec.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Tab: Media */}
            {activeTab === "media" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-16">
                
                {/* Photo Gallery */}
                <div>
                  <h3 className="text-2xl font-serif text-white mb-6 flex items-center gap-3">
                    <ImageIcon className="w-6 h-6 text-primary" /> Stills & Galeria
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {["/images/poster-2.png", "/images/poster-3.png", "/images/poster-4.png", "/images/poster-5.png", "/images/poster-1.png"].map((img, i) => (
                      <div key={i} className={`rounded-2xl overflow-hidden cursor-pointer tv-focus group ${i === 0 ? 'col-span-2 row-span-2' : ''}`}>
                        <div className="aspect-video w-full h-full">
                          <img src={img} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700" alt="" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Soundtrack Player */}
                <div className="bg-card/50 border border-white/10 rounded-3xl p-8 backdrop-blur-md">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg">
                      <Music className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-serif text-white">Trilha Sonora Original</h3>
                      <p className="text-muted-foreground">Composta por Giovanni Fusco</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {["Main Theme (L'Aventura)", "The Island", "Searching for Anna"].map((track, i) => (
                      <div key={i} className="flex items-center justify-between p-4 rounded-xl hover:bg-white/5 group tv-focus cursor-pointer transition-colors">
                        <div className="flex items-center gap-4">
                          <span className="text-muted-foreground font-mono w-6 text-right">{i + 1}</span>
                          <button className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                            <Play className="w-4 h-4 ml-0.5" />
                          </button>
                          <span className="font-medium text-white group-hover:text-primary transition-colors">{track}</span>
                        </div>
                        <span className="text-muted-foreground font-mono text-sm">03:{14 + i * 10}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </motion.div>
            )}

          </div>
        </div>

        {/* Similar Movies Section */}
        <motion.section 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="pt-16 border-t border-white/10"
        >
          <div className="flex items-end justify-between mb-10">
            <h2 className="text-4xl font-serif text-white">Títulos Semelhantes</h2>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8">
            {similarMovies.map((movie, i) => (
              <MovieCard 
                key={movie.id}
                id={movie.id}
                title={movie.title}
                year={movie.year}
                imageUrl={movie.img}
                qualities={movie.qualities}
                index={i}
              />
            ))}
          </div>
        </motion.section>

      </main>
    </div>
  );
}
