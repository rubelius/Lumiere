'use client';
import { Sidebar } from "@/components/layout/Sidebar";
import { MovieCard } from "@/components/ui/movie-card";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Filter, Play, SortDesc, Grid, List as ListIcon, Check } from "lucide-react";
import { useState } from "react";

export default function Library() {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const libraryMovies = [
    { id: 1, title: "L'Aventura", year: "1960", img: "/images/poster-1.png", qualities: ["REMUX", "4K"] as any },
    { id: 2, title: "Solaris", year: "1972", img: "/images/poster-2.png", qualities: ["4K", "HDR"] as any },
    { id: 3, title: "Persona", year: "1966", img: "/images/poster-3.png", qualities: ["REMUX", "ATMOS"] as any },
    { id: 4, title: "Barry Lyndon", year: "1975", img: "/images/poster-4.png", qualities: ["4K"] as any },
    { id: 5, title: "Metropolis", year: "1927", img: "/images/poster-5.png", qualities: ["REMUX", "HDR"] as any },
    { id: 6, title: "L'Aventura (Alt)", year: "1960", img: "/images/poster-1.png", qualities: ["REMUX"] as any },
    { id: 7, title: "Solaris (Director's Cut)", year: "1972", img: "/images/poster-2.png", qualities: ["4K"] as any },
    { id: 8, title: "Persona (Restored)", year: "1966", img: "/images/poster-3.png", qualities: ["HDR"] as any },
    { id: 9, title: "Barry Lyndon (IMAX)", year: "1975", img: "/images/poster-4.png", qualities: ["ATMOS"] as any },
    { id: 10, title: "Metropolis (Colorized)", year: "1927", img: "/images/poster-5.png", qualities: ["4K", "HDR"] as any },
  ];

  const categories = ["Tudo", "Filmes", "Séries", "Coleções", "Favoritos"];

  return (
    <div className="min-h-screen bg-background text-foreground pl-24 pb-20 selection:bg-primary/30">
      <div className="fixed inset-0 bg-noise opacity-[0.03] mix-blend-overlay pointer-events-none z-50" />
      <Sidebar />
      
      <main className="max-w-480 mx-auto px-16 pt-20">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16 relative z-20">
          <div>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-7xl font-serif font-bold text-white mb-6 text-glow"
            >
              Sua Biblioteca
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-2xl text-white/60 font-light"
            >
              <span className="text-white font-medium">128</span> títulos disponíveis em alta qualidade
            </motion.p>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-6"
          >
            {/* View Mode Toggle (New Feature) */}
            <div className="flex bg-card/30 border border-white/10 rounded-[2rem] p-2 backdrop-blur-xl mr-2 shadow-lg">
              <button 
                onClick={() => setViewMode("grid")}
                className={`p-3 rounded-2xl transition-all duration-300 tv-focus ${viewMode === 'grid' ? 'bg-primary text-white shadow-[0_0_20px_rgba(99,102,241,0.4)]' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
              >
                <Grid className="w-6 h-6" />
              </button>
              <button 
                onClick={() => setViewMode("list")}
                className={`p-3 rounded-2xl transition-all duration-300 tv-focus ${viewMode === 'list' ? 'bg-primary text-white shadow-[0_0_20px_rgba(99,102,241,0.4)]' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
              >
                <ListIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="relative group">
              <Search className="w-6 h-6 absolute left-6 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-primary transition-colors duration-300" />
              <input 
                type="text" 
                placeholder="Buscar na biblioteca..." 
                className="bg-card/20 border border-white/10 rounded-[2rem] py-5 pl-16 pr-8 text-white placeholder:text-white/40 outline-none focus:border-primary focus:bg-card/40 tv-focus w-96 backdrop-blur-xl transition-all duration-300 shadow-lg text-lg font-light"
              />
            </div>
            
            <div className="relative">
              <button 
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className={`p-5 rounded-[2rem] tv-focus transition-all duration-300 backdrop-blur-xl shadow-lg border
                  ${isFilterOpen ? 'bg-primary text-white border-primary shadow-[0_0_30px_rgba(99,102,241,0.6)]' : 'bg-card/20 border-white/10 text-white hover:bg-white/10 hover:border-white/30'}
                `}
              >
                <Filter className="w-7 h-7" />
              </button>

              {/* Advanced Filter Dropdown (New Feature) */}
              <AnimatePresence>
                {isFilterOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-full right-0 mt-4 w-150 bg-card/95 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden p-8 z-50 grid grid-cols-2 gap-8"
                  >
                    
                    {/* Coluna 1 */}
                    <div>
                      <h4 className="text-sm font-bold text-primary uppercase tracking-wider mb-4">Qualidade</h4>
                      <div className="space-y-2 mb-8">
                        {["REMUX", "4K", "HDR", "Dolby Vision", "Dolby Atmos", "IMAX", "WEB-DL"].map((q, i) => (
                          <label key={q} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer tv-focus">
                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${i === 0 ? 'bg-primary border-primary text-white' : 'border-white/20 text-transparent'}`}>
                              <Check className="w-3 h-3" />
                            </div>
                            <span className="text-white font-medium">{q}</span>
                          </label>
                        ))}
                      </div>

                      <h4 className="text-sm font-bold text-primary uppercase tracking-wider mb-4">Selos & Edições</h4>
                      <div className="flex flex-wrap gap-2">
                        {["Criterion Collection", "Arrow Video", "Masters of Cinema", "A24", "Kino Lorber"].map(g => (
                          <button key={g} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-medium text-white/80 hover:text-white hover:bg-white/10 hover:border-white/30 transition-all tv-focus">
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Coluna 2 */}
                    <div>
                      <h4 className="text-sm font-bold text-primary uppercase tracking-wider mb-4">Movimentos Cinematográficos</h4>
                      <div className="flex flex-wrap gap-2 mb-8">
                        {["Nouvelle Vague", "Neorealismo Italiano", "Expressionismo Alemão", "Nova Hollywood", "Cinema Novo", "Dogma 95"].map(g => (
                          <button key={g} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-medium text-white/80 hover:text-white hover:bg-white/10 hover:border-white/30 transition-all tv-focus">
                            {g}
                          </button>
                        ))}
                      </div>

                      <h4 className="text-sm font-bold text-primary uppercase tracking-wider mb-4">Formato Original</h4>
                      <div className="flex flex-wrap gap-2 mb-8">
                        {["35mm", "70mm", "16mm", "Digital", "Preto & Branco"].map(g => (
                          <button key={g} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-medium text-white/80 hover:text-white hover:bg-white/10 hover:border-white/30 transition-all tv-focus">
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button className="p-3 bg-card/50 border border-white/10 rounded-2xl tv-focus hover:bg-white/10 transition-colors text-white backdrop-blur-sm">
              <SortDesc className="w-6 h-6" />
            </button>
          </motion.div>
        </div>

        {/* Categories */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex gap-4 mb-16 overflow-x-auto hide-scrollbar pb-6 relative z-10"
        >
          {categories.map((cat, i) => (
            <button 
              key={cat}
              className={`px-10 py-4 rounded-full text-xl font-medium tv-focus whitespace-nowrap transition-all duration-300
                ${i === 0 
                  ? 'bg-white text-background shadow-[0_0_30px_rgba(255,255,255,0.4)] hover:scale-105' 
                  : 'bg-card/20 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 backdrop-blur-xl hover:border-white/30'
                }
              `}
            >
              {cat}
            </button>
          ))}
        </motion.div>

        {/* Grid or List View */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-8 gap-y-16">
            {libraryMovies.map((movie, i) => (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                key={i}
                className="group relative"
              >
                <MovieCard 
                  id={movie.id}
                  title={movie.title}
                  year={movie.year}
                  imageUrl={movie.img}
                  qualities={movie.qualities}
                  index={i}
                />
                {/* Extra library actions hover */}
                <div className="absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0 z-20">
                   <button className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white hover:bg-primary transition-colors border border-white/20">
                     <Check className="w-5 h-5" />
                   </button>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {libraryMovies.map((movie, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex gap-8 p-6 rounded-[2rem] bg-card/20 border border-white/5 hover:border-primary/30 hover:bg-card/40 transition-all duration-500 tv-focus group cursor-pointer backdrop-blur-xl shadow-lg hover:shadow-[0_0_40px_rgba(99,102,241,0.1)] relative overflow-hidden"
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary scale-y-0 group-hover:scale-y-100 transition-transform origin-center duration-300" />
                
                <div className="w-32 aspect-2/3 rounded-2xl overflow-hidden shrink-0 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
                  <img src={movie.img} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out" />
                </div>
                
                <div className="py-2 flex flex-col justify-center flex-1">
                  <h3 className="text-4xl font-serif text-white mb-3 group-hover:text-primary transition-colors duration-300">{movie.title}</h3>
                  <p className="text-white/50 text-lg font-medium mb-6 uppercase tracking-widest">{movie.year}</p>
                  <div className="flex flex-wrap gap-3">
                    {movie.qualities.map((q: string) => (
                      <span key={q} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-bold uppercase text-white/70 tracking-wider">
                        {q}
                      </span>
                    ))}
                  </div>
                </div>
                
                <div className="hidden md:flex items-center gap-4 pr-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <button className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-primary hover:border-primary transition-all hover:scale-110 hover:shadow-[0_0_20px_rgba(99,102,241,0.4)]">
                    <Play className="w-8 h-8 ml-1" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}