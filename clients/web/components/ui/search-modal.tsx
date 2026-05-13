'use client';
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Film, Tv, User, X, ArrowRight } from "lucide-react";
import Link from "next/link";

export function SearchModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const results = [
    { type: "movie", title: "L'Aventura", year: "1960", icon: Film, id: 1 },
    { type: "movie", title: "Solaris", year: "1972", icon: Film, id: 2 },
    { type: "director", title: "Michelangelo Antonioni", info: "Diretor", icon: User, id: "dir-1" },
    { type: "collection", title: "Sci-Fi Contemplativo", info: "Sessão", icon: Tv, id: "col-1" },
  ].filter(item => item.title.toLowerCase().includes(query.toLowerCase()) || query === "");

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-xl z-100"
            onClick={onClose}
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed top-[15vh] left-1/2 -translate-x-1/2 w-full max-w-3xl bg-card/60 border border-white/10 rounded-3xl shadow-2xl overflow-hidden z-101 backdrop-blur-3xl"
          >
            <div className="flex items-center px-6 py-4 border-b border-white/10 relative">
              <Search className="w-6 h-6 text-primary absolute left-6" />
              <input 
                autoFocus
                type="text" 
                placeholder="Buscar filmes, diretores, sessões..." 
                className="w-full bg-transparent border-none text-2xl text-white placeholder:text-muted-foreground outline-none pl-12 pr-12 font-light"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button onClick={onClose} className="absolute right-6 p-2 rounded-full hover:bg-white/10 text-muted-foreground hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-[50vh] overflow-y-auto p-4 space-y-2">
              {results.map((result, i) => (
                <Link 
                  href={result.type === 'movie' ? `/movie/${result.id}` : '#'} 
                  key={result.id}
                  onClick={onClose} /* Movido para cá */
                  className="flex items-center justify-between p-4 rounded-2xl hover:bg-white/5 tv-focus group transition-colors cursor-pointer outline-none" /* Movido para cá */
                >
                  {/* A TAG <a> FOI REMOVIDA, O CONTEÚDO VEM DIRETO AQUI: */}
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                      <result.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-lg font-medium text-white">{result.title}</h4>
                      <p className="text-sm text-muted-foreground">{result.year || result.info}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </Link>
              ))}
            </div>
            
            <div className="px-6 py-3 border-t border-white/10 bg-black/20 flex items-center gap-4 text-xs text-muted-foreground font-mono">
              <span className="flex items-center gap-1"><kbd className="px-2 py-1 rounded bg-white/5 border border-white/10">↑↓</kbd> Navegar</span>
              <span className="flex items-center gap-1"><kbd className="px-2 py-1 rounded bg-white/5 border border-white/10">Enter</kbd> Selecionar</span>
              <span className="flex items-center gap-1"><kbd className="px-2 py-1 rounded bg-white/5 border border-white/10">Esc</kbd> Fechar</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
