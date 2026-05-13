'use client';

import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, Loader2 } from "lucide-react";
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from "react";
import { useMovies } from '@/features/movies/hooks/useMovies';

// Importe os componentes que acabamos de separar
import { LibraryFilters, FilterState } from "@/components/library/LibraryFilters";
import { FilmRow, FilmGridCard } from "@/components/library/FilmCards";

const FINE_ART_EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

export interface Movie {
  id: string | number;
  number: string;
  title: string;
  year: string;
  img: string;
  backgroundSrc: string; 
  director: string;
  qualities: string[];
  runtime: string;
  synopsis: string;
}

export default function Library() {
  const router = useRouter();

  // ── ESTADO CENTRAL DE FILTROS ──
  const [filters, setFilters] = useState<FilterState>({
    category: "Acervo Completo",
    viewMode: "grid",
    search: "",
    qualities: [],
    genres: [],
    decades: [],
    curations: []
  });
  
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // ── ESTADOS DE PAGINAÇÃO INFINITA ──
  const [page, setPage] = useState(1);
  const [allMovies, setAllMovies] = useState<Movie[]>([]);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // ── ESTADOS DE INTERAÇÃO VISUAL ──
  const [hoveredId, setHoveredId] = useState<string | number | null>(null);
  const [expandedId, setExpandedId] = useState<string | number | null>(null);

  // 1. Debounce da Busca & Reset de Página ao mudar Filtros
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(filters.search);
      setPage(1); 
    }, 500);
    return () => clearTimeout(timer);
  }, [filters.search]);

  // Se qualquer outro filtro (qualities, genres, category) mudar, volta pra página 1
  useEffect(() => {
    setPage(1);
  }, [filters.category, filters.qualities, filters.genres, filters.decades, filters.curations]);

  // 2. Buscamos os dados passando o estado consolidado pro seu Hook
  const { data, isLoading, error, isFetching } = useMovies({ 
    page, 
    search: debouncedSearch,
    category: filters.category,
    qualities: filters.qualities, // <-- O seu hook useMovies vai precisar aceitar esses novos arrays!
    genres: filters.genres,
    decades: filters.decades,
    curations: filters.curations
  });

  // 3. Acumulador de Filmes
  useEffect(() => {
    if (data?.results) {
      const formattedData: Movie[] = data.results.map((movie: any, index: number) => {
        const hours = Math.floor((movie.length_minutes || 0) / 60);
        const mins = (movie.length_minutes || 0) % 60;
        
        return {
          id: movie.id,
          number: String((page - 1) * 20 + index + 1).padStart(3, '0'), 
          title: movie.title,
          year: String(movie.year || "----"),
          img: movie.poster_url || "/images/poster-1.png",
          backgroundSrc: movie.background_url || movie.poster_url, 
          director: movie.director || "Diretor Desconhecido",
          qualities: movie.in_plex ? ["PLEX", "DISPONÍVEL"] : ["OFFLINE"],
          runtime: movie.length_minutes ? `${hours}h ${mins}m` : "--h --m",
          synopsis: movie.overview || "Fita magnética preservada nos arquivos da fundação. Registros adicionais aguardando decodificação do servidor principal.",
        };
      });

      if (page === 1) {
        setAllMovies(formattedData);
      } else {
        setAllMovies(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          const newUniqueMovies = formattedData.filter(m => !existingIds.has(m.id));
          return [...prev, ...newUniqueMovies];
        });
      }
    }
  }, [data, page]);

  // 4. Gatilho da Página Infinita
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && data?.next && !isFetching) {
        setPage(prev => prev + 1);
      }
    }, { rootMargin: '300px' }); 

    const currentRef = loadMoreRef.current;
    if (currentRef) observer.observe(currentRef);
    
    return () => { if (currentRef) observer.unobserve(currentRef); };
  }, [data?.next, isFetching]); 

  // 5. Radar Infallível de Scroll
  useEffect(() => {
    const checkScroll = () => {
      const topAnchor = document.getElementById('topo-da-biblioteca');
      if (topAnchor) {
        setShowScrollTop(topAnchor.getBoundingClientRect().top < -800);
      }
    };
    window.addEventListener('scroll', checkScroll, true);
    return () => window.removeEventListener('scroll', checkScroll, true);
  }, []);

  const scrollToTop = () => document.getElementById('topo-da-biblioteca')?.scrollIntoView({ behavior: 'smooth' });

  const hoveredMovie = allMovies.find(m => m.id === hoveredId);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#080806', color: '#EDE8DC', paddingBottom: 80, position: 'relative' }}>
      
      {/* ECO VISUAL */}
      <AnimatePresence>
        {hoveredMovie?.backgroundSrc && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 0.15 }} exit={{ opacity: 0 }} transition={{ duration: 1.2, ease: FINE_ART_EASE }}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, height: '70vh', zIndex: 0, pointerEvents: 'none',
              maskImage: 'linear-gradient(to bottom, black 0%, black 40%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 40%, transparent 100%)'
            }}
          >
            <img src={hoveredMovie.backgroundSrc} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(60%) contrast(1.1)' }} alt="" />
          </motion.div>
        )}
      </AnimatePresence>

      <div id="topo-da-biblioteca" style={{ position: 'absolute', top: 0 }} />
      <div className="fixed inset-0 bg-noise opacity-[0.03] mix-blend-overlay pointer-events-none z-50" />
      
      {/* BOTÃO DE RETORNO AO TOPO */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            onClick={scrollToTop} whileHover={{ scale: 1.1, backgroundColor: '#BF8F3C', color: '#040402' }} whileTap={{ scale: 0.9 }}
            style={{ 
              position: 'fixed', bottom: 40, right: 40, zIndex: 9999, width: 56, height: 56, borderRadius: '50%', backgroundColor: 'rgba(4,4,2,0.8)', 
              border: '1px solid rgba(191,143,60,0.5)', color: '#BF8F3C', display: 'flex', alignItems: 'center', justifyContent: 'center', 
              cursor: 'pointer', backdropFilter: 'blur(8px)', transition: 'all 0.3s'
            }}
          >
            <ArrowUp />
          </motion.button>
        )}
      </AnimatePresence>

      <main style={{ maxWidth: 1600, margin: '0 auto', padding: '80px 72px 0', position: 'relative', zIndex: 10 }}>
        
        {/* CABEÇALHO DO ARQUIVO */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 48, paddingBottom: 24, borderBottom: '1px solid rgba(237,232,220,0.05)' }}>
          <div>
            <div style={{ overflow: 'hidden', marginBottom: 12 }}>
              <motion.div initial={{ y: '100%' }} animate={{ y: '0%' }} transition={{ duration: 1, ease: FINE_ART_EASE }} style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', color: '#BF8F3C', textTransform: 'uppercase' }}>
                [ DIRETÓRIO RAIZ ]
              </motion.div>
            </div>
            <div style={{ overflow: 'hidden' }}>
              <motion.h1 initial={{ y: '100%' }} animate={{ y: '0%' }} transition={{ duration: 1.2, ease: FINE_ART_EASE }} style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(3rem, 5vw, 4.5rem)', fontWeight: 400, margin: 0, lineHeight: 1, letterSpacing: '-0.02em' }}>
                O Arquivo.
              </motion.h1>
            </div>
          </div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4, duration: 1 }} style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', color: '#565450', textTransform: 'uppercase' }}>
            {isLoading && page === 1 ? "CONECTANDO..." : `${data?.count || 0} OBRAS PRESERVADAS // STATUS: ONLINE`}
          </motion.div>
        </div>

        {/* ── O NOVO COMPONENTE DE FILTROS ── */}
        <LibraryFilters 
          filters={filters} 
          setFilters={setFilters} 
          isFilterOpen={isFilterOpen} 
          setIsFilterOpen={setIsFilterOpen} 
        />

        {/* TRATAMENTO DE ESTADOS GERAIS */}
        {isLoading && page === 1 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: '80px 0', fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#BF8F3C', letterSpacing: '0.2em', textAlign: 'center' }}>
            ACESSANDO DIRETÓRIO...
          </motion.div>
        )}

        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: '80px 0', fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#B05050', letterSpacing: '0.2em', textAlign: 'center' }}>
            FALHA NA CONEXÃO. VERIFIQUE O SERVIDOR CENTRAL.
          </motion.div>
        )}

        {/* GRADE / LISTA DE OBRAS */}
        {!isLoading && allMovies.length === 0 && (
           <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: '80px 0', fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#565450', letterSpacing: '0.2em', textAlign: 'center', textTransform: 'uppercase' }}>
             Nenhum registro encontrado para os parâmetros selecionados.
           </motion.div>
        )}

        {allMovies.length > 0 && (
          <motion.div transition={{ duration: 0.8, ease: FINE_ART_EASE }}>
            {filters.viewMode === 'grid' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '80px 48px' }}>
                {allMovies.map((movie) => (
                  <FilmGridCard key={movie.id} film={movie} router={router} setExpandedId={setExpandedId} onHover={setHoveredId} />
                ))}
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                {allMovies.map((movie) => (
                  <FilmRow 
                    key={movie.id} film={movie} 
                    isHovered={hoveredId === movie.id && expandedId === null} 
                    isDimmed={(hoveredId !== null && hoveredId !== movie.id) || (expandedId !== null && expandedId !== movie.id)}
                    isExpanded={expandedId === movie.id}
                    onHover={setHoveredId} onClick={setExpandedId} router={router}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* SENTINELA DE CARREGAMENTO INFINITO */}
        <div ref={loadMoreRef} style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '40px' }}>
          {isFetching && page > 1 && (
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
              <Loader2 style={{ width: 24, height: 24, color: '#BF8F3C' }} />
            </motion.div>
          )}
        </div>

      </main>
    </div>
  );
}