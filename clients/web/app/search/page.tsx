'use client';

import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, Loader2, Globe } from "lucide-react";
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from "react";
import { useMovies } from '@/features/movies/hooks/useMovies';
import Link from 'next/link';

const FINE_ART_EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

// 1. Interface
interface Movie {
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

// ── O DOSSIÊ DE 100+ PLACEHOLDERS INSPIRADORES ──
const SEARCH_SUGGESTIONS = [
  "O que deseja projetar?", "Procure por 'Tarkovsky'...", "Explore a 'Nouvelle Vague'...", "Digite um ano: 1968...",
  "Busque por obras recém preservadas...", "Quem é o diretor?", "Descubra o 'Neorrealismo Italiano'...",
  "Fotografia por 'Roger Deakins'...", "Trilhas de 'Ennio Morricone'...", "Pesquise por 'Akira Kurosawa'...",
  "Obras-primas da década de 80...", "Explore o 'Cinema Novo' brasileiro...", "O universo de 'David Lynch'...",
  "Ficção Científica dos anos 70...", "Filmes dirigidos por 'Agnès Varda'...", "Pesquise 'Cyberpunk'...",
  "A estética do 'Expressionismo Alemão'...", "Obras de 'Stanley Kubrick'...", "Clássicos do 'Film Noir'...",
  "Descubra 'Ingmar Bergman'...", "Cinema Asiático Contemporâneo...", "Pesquise por 'Spaghetti Western'...",
  "Roteiros de 'Charlie Kaufman'...", "A genialidade de 'Wong Kar-wai'...", "Filmes de 'Martin Scorsese'...",
  "Lançamentos do ano de 1999...", "Obras do 'Dogma 95'...", "Explore o 'Surrealismo'...",
  "Direção de 'Francis Ford Coppola'...", "Pesquise 'Chantal Akerman'...", "A magia do Studio Ghibli...",
  "Obras restauradas em 4K...", "Filmes franceses dos anos 60...", "Trilhas sonoras de 'Hans Zimmer'...",
  "O cinema de 'Federico Fellini'...", "Fotografia de 'Emmanuel Lubezki'...", "Animações japonesas clássicas...",
  "Descubra 'Béla Tarr'...", "Pesquise 'Thriller Psicológico'...", "Obras de 'Alfred Hitchcock'...",
  "Explore 'Glauber Rocha'...", "O impacto de 'Jean-Luc Godard'...", "Filmes sobre viagens no tempo...",
  "Direção de 'Paul Thomas Anderson'...", "Cinema mudo dos anos 20...", "A visão de 'Krzysztof Kieślowski'...",
  "Obras estrelando 'Marlon Brando'...", "Descubra o 'Cinema Transgressivo'...", "Pesquise por 'Andrei Zvyagintsev'...",
  "Filmes premiados em Cannes...", "A filmografia de 'Yasujirō Ozu'...", "Clássicos da Era de Ouro de Hollywood...",
  "Documentários sobre a Segunda Guerra...", "A mente de 'Quentin Tarantino'...", "Pesquise por 'Terror Psicológico'...",
  "Filmes com 'Al Pacino'...", "A maestria de 'Kenji Mizoguchi'...", "Obras do movimento 'Mumblecore'...",
  "Explore 'Pedro Almodóvar'...", "Direção de Fotografia de 'Vittorio Storaro'...", "Obras de 'Orson Welles'...",
  "Trilhas de 'John Williams'...", "Pesquise 'Fantasia Sombria'...", "O legado de 'Charlie Chaplin'...",
  "Filmes soviéticos dos anos 50...", "A ousadia de 'Lars von Trier'...", "Descubra o 'Gótico Italiano'...",
  "Obras com 'Isabelle Huppert'...", "Explore 'Michael Haneke'...", "A filmografia de 'Spike Lee'...",
  "Cinema Independente Americano...", "Obras de 'F.W. Murnau'...", "Pesquise 'Realismo Mágico'...",
  "A visão de 'Denis Villeneuve'...", "Filmes de 'Steven Spielberg'...", "A estética de 'Wes Anderson'...",
  "Obras estrelando 'Toshiro Mifune'...", "Direção de 'Abbas Kiarostami'...", "Obras do 'Cinema Direto'...",
  "Pesquise 'Vampiros na Cultura Pop'...", "A genialidade de 'Hayao Miyazaki'...", "Filmes argentinos contemporâneos...",
  "Obras com 'Marcello Mastroianni'...", "Trilhas sonoras de 'Bernard Herrmann'...", "Obras de 'Luis Buñuel'...",
  "Explore o cinema de 'Satyajit Ray'...", "Filmes com 'Liv Ullmann'...", "A filmografia de 'John Ford'...",
  "Obras de 'Edward Yang'...", "Pesquise 'Cinema Experimental'...", "A visão de 'Terrence Malick'...",
  "Filmes épicos históricos...", "Obras do movimento 'Free Cinema'...", "Descubra 'Apichatpong Weerasethakul'...",
  "Pesquise 'Folk Horror'...", "A mente de 'David Cronenberg'...", "Obras da 'Retomada do Cinema Brasileiro'...",
  "Direção de 'Céline Sciamma'...", "Filmes cult dos anos 90...", "Obras de 'Pier Paolo Pasolini'...",
  "A estética de 'Kar-Wai Wong'...", "Descubra 'Theo Angelopoulos'...", "Cinema Grego Contemporâneo...",
  "Pesquise por 'Cyber-Noir'...", "Filmes de 'Robert Bresson'...", "A visão de 'Andrei Tarkovsky'..."
];


// ── COMPONENTES REUTILIZADOS DA LIBRARY ──

function FilmRow({ film, isHovered, isDimmed, isExpanded, onHover, onClick, router }: any) {
  return (
    <div
      onClick={() => {
        if (!isExpanded) {
          onClick(film.id);
          setTimeout(() => { router.push(`/movie/${film.id}`); }, 800); 
        }
      }}
      onMouseEnter={() => !isExpanded && onHover(film.id)}
      onMouseLeave={() => !isExpanded && onHover(null)}
      style={{ display: 'block', position: 'relative', zIndex: isHovered || isExpanded ? 10 : 1, cursor: isExpanded ? 'default' : 'crosshair', contentVisibility: 'auto', containIntrinsicSize: '70px' }}
    >
      <motion.div
        layout initial={false}
        animate={{ height: isExpanded ? '100vh' : isHovered ? 240 : 70, opacity: isDimmed ? 0.15 : 1, backgroundColor: isHovered ? 'rgba(237,232,220,0.01)' : 'rgba(237,232,220,0)' }}
        transition={{ duration: 0.85, ease: FINE_ART_EASE }}
        style={{ borderBottom: '1px solid rgba(237,232,220,0.03)', overflow: 'hidden', position: 'relative' }}
      >
        <motion.div initial={false} animate={{ opacity: isExpanded ? 1 : isHovered ? 0.10 : 0, width: isExpanded ? '100%' : isHovered ? '50%' : '0%' }} transition={{ duration: 0.85, ease: FINE_ART_EASE }} style={{ position: 'absolute', top: 0, bottom: 0, right: 0, overflow: 'hidden', zIndex: -1, filter: 'grayscale(100%)', transformOrigin: 'right' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, #080806 0%, transparent 100%)', zIndex: 1 }} />
          <img src={film.img} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" loading="lazy" />
        </motion.div>

        <motion.div animate={{ color: isHovered ? '#BF8F3C' : '#302E2A' }} style={{ position: 'absolute', left: 40, top: 28, fontFamily: "'DM Mono', monospace", fontSize: '10px' }}>
          {film.number}
        </motion.div>

        <AnimatePresence>
          {isHovered && !isExpanded && (
            <motion.div initial={{ opacity: 0, filter: 'blur(10px)', scale: 0.95 }} animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }} exit={{ opacity: 0, filter: 'blur(10px)', scale: 0.95 }} style={{ position: 'absolute', left: 90, top: 35, width: 110, height: 160, zIndex: 5 }}>
              <img src={film.img} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(25%) contrast(1.1)' }} alt="" />
            </motion.div>
          )}
        </AnimatePresence>

        <motion.h3
          animate={{ scale: isExpanded ? 2.5 : isHovered ? 1.35 : 1, color: isExpanded ? '#FFFFFF' : isHovered ? '#EDE8DC' : '#8C8880', y: isExpanded ? '30vh' : isHovered ? 12 : 0, x: isExpanded ? '10vw' : 0 }}
          transition={{ duration: 0.85, ease: FINE_ART_EASE }}
          style={{ position: 'absolute', left: 240, top: 22, fontFamily: "'Cormorant Garamond', serif", fontSize: '1.6rem', fontWeight: 400, margin: 0, lineHeight: 1, letterSpacing: '-0.01em', transformOrigin: 'left top', zIndex: 10 }}
        >
          {film.title}
        </motion.h3>

        <AnimatePresence>
          {isHovered && !isExpanded && (
            <div style={{ position: 'absolute', left: 240, top: 100, display: 'flex', gap: 24, maxWidth: 720 }}>
              <motion.div initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} exit={{ scaleY: 0 }} transition={{ duration: 0.9, delay: 0.1, ease: FINE_ART_EASE }} style={{ width: 1, backgroundColor: 'rgba(191,143,60,0.3)', transformOrigin: 'top' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden', paddingBottom: 10 }}>
                <motion.div initial={{ y: '100%' }} animate={{ y: '0%' }} style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', color: '#7A5A20', textTransform: 'uppercase' }}>
                  {film.director} // {film.year}
                </motion.div>
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.2rem', lineHeight: 1.6, color: 'rgba(237,232,220,0.55)', fontStyle: 'italic', margin: 0 }}>
                  {film.synopsis}
                </motion.p>
              </div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {!isHovered && !isExpanded && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'absolute', right: 40, top: 28, display: 'flex', gap: 40, color: '#302E2A', fontFamily: "'DM Mono', monospace", fontSize: '10px', textTransform: 'uppercase' }}>
              <span>{film.director}</span>
              <span>{film.year}</span>
              <span>{film.runtime}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}

function FilmGridCard({ film, router, setExpandedId, onHover }: any) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      onMouseEnter={() => { setIsHovered(true); onHover(film.id); }}
      onMouseLeave={() => { setIsHovered(false); onHover(null); }}
      onClick={() => { setExpandedId(film.id); setTimeout(() => router.push(`/movie/${film.id}`), 800); }}
      initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 1, ease: FINE_ART_EASE }}
      style={{ cursor: 'crosshair', display: 'flex', flexDirection: 'column', position: 'relative', contentVisibility: 'auto', containIntrinsicSize: '400px' }}
    >
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: isHovered ? '#BF8F3C' : '#302E2A', letterSpacing: '0.2em', marginBottom: 12, transition: 'color 0.4s ease' }}>
        [{film.number}]
      </div>
      <div style={{ position: 'relative', aspectRatio: '2/3', overflow: 'hidden', backgroundColor: '#040402', border: isHovered ? '1px solid rgba(191,143,60,0.3)' : '1px solid rgba(237,232,220,0.05)', transition: 'border-color 0.6s ease' }}>
        <motion.img src={film.img} animate={{ scale: isHovered ? 1.05 : 1, filter: isHovered ? 'grayscale(0%) contrast(1.1)' : 'grayscale(35%) contrast(1)' }} transition={{ duration: 0.8, ease: FINE_ART_EASE }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
        <motion.div animate={{ opacity: isHovered ? 1 : 0 }} transition={{ duration: 0.6, ease: FINE_ART_EASE }} style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #080806 0%, rgba(8,8,6,0.9) 35%, transparent 100%)', pointerEvents: 'none' }} />
        <motion.div initial={false} animate={{ y: isHovered ? 0 : 20, opacity: isHovered ? 1 : 0 }} transition={{ duration: 0.6, ease: FINE_ART_EASE }} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '32px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {film.qualities.map((q: string) => (
              <span key={q} style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', letterSpacing: '0.15em', padding: '4px 8px', border: '1px solid rgba(191,143,60,0.4)', color: '#BF8F3C', backgroundColor: 'rgba(8,8,6,0.6)' }}>{q}</span>
            ))}
          </div>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.25rem', color: '#EDE8DC', fontStyle: 'italic', margin: 0, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{film.synopsis}</p>
        </motion.div>
      </div>
      <div style={{ marginTop: 24 }}>
        <motion.div animate={{ color: isHovered ? '#FFFFFF' : '#EDE8DC' }} transition={{ duration: 0.4 }} style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.8rem', lineHeight: 1.1, marginBottom: 8, letterSpacing: '-0.01em' }}>{film.title}</motion.div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', color: '#565450', textTransform: 'uppercase' }}>
          {film.director} // <span style={{ color: isHovered ? '#BF8F3C' : '#302E2A', transition: 'color 0.4s' }}>{film.year}</span>
        </div>
      </div>
    </motion.div>
  );
}


export default function GlobalSearch() {
  const router = useRouter();

  // ── ESTADOS DE BUSCA ──
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  
  // ── ESTADOS DA "ALMA" DA TELA ──
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [timeStr, setTimeStr] = useState("");

  const [page, setPage] = useState(1);
  const [allMovies, setAllMovies] = useState<Movie[]>([]);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const [hoveredId, setHoveredId] = useState<string | number | null>(null);
  const [expandedId, setExpandedId] = useState<string | number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // O Relógio da Telemetria e Placeholders Rotativos
  useEffect(() => {
    // Relógio
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('pt-BR', { hour12: false }) + ' // BRASIL');
    };
    updateTime();
    const timeInterval = setInterval(updateTime, 1000);

    // Sorteia o primeiro texto aleatoriamente no carregamento
    setPlaceholderIndex(Math.floor(Math.random() * SEARCH_SUGGESTIONS.length));

    // Placeholders - Sorteia o próximo de forma aleatória a cada 4.5s
    const placeholderInterval = setInterval(() => {
      setPlaceholderIndex(Math.floor(Math.random() * SEARCH_SUGGESTIONS.length));
    }, 4500); 

    return () => {
      clearInterval(timeInterval);
      clearInterval(placeholderInterval);
    };
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') router.back();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1); 
    }, 600); 
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data, isLoading, isFetching } = useMovies({ 
    page, 
    search: debouncedSearch
  });

  useEffect(() => {
    if (!debouncedSearch) {
      setAllMovies([]); 
      return;
    }

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
          qualities: movie.in_plex ? ["PLEX"] : ["OFFLINE", "SEARCHING"],
          runtime: movie.length_minutes ? `${hours}h ${mins}m` : "--h --m",
          synopsis: movie.overview || "Iniciando varredura em trackers externos para decodificação da obra.",
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
  }, [data, page, debouncedSearch]);

  useEffect(() => {
    // Se não tiver nada digitado, ele DESLIGA o radar de carregar página
    if (!debouncedSearch) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && data?.next) setPage(prev => prev + 1);
    }, { rootMargin: '300px' }); 

    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [data?.next, debouncedSearch]);

  // Pega o filme que está no Hover atualmente para o Eco Visual
  const hoveredMovie = allMovies.find(m => m.id === hoveredId);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#080806', color: '#EDE8DC', paddingBottom: 80, position: 'relative' }}>
      
      {/* ── ECO VISUAL (A "Alma" da Tela) ── */}
      <AnimatePresence>
        {hoveredMovie?.backgroundSrc && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.15 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: FINE_ART_EASE }}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, height: '70vh', zIndex: 0,
              pointerEvents: 'none',
              maskImage: 'linear-gradient(to bottom, black 0%, black 40%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 40%, transparent 100%)'
            }}
          >
            <img 
              src={hoveredMovie.backgroundSrc} 
              style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(60%) contrast(1.1)' }} 
              alt=""
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div id="topo-da-busca" style={{ position: 'absolute', top: 0 }} />
      <div className="fixed inset-0 bg-noise opacity-[0.03] mix-blend-overlay pointer-events-none z-50" />

      {/* ── HEADER DA BUSCA GLOBAL (Com Telemetria) ── */}
      <header style={{ padding: '40px 72px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Globe style={{ width: 14, height: 14, color: '#BF8F3C' }} />
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', color: '#BF8F3C', textTransform: 'uppercase' }}>
            [ VARREDURA GLOBAL ] <span style={{ color: '#565450', marginLeft: 16 }}>{timeStr}</span>
          </span>
        </div>
        <button 
          onClick={() => router.back()}
          style={{ background: 'transparent', border: 'none', color: '#565450', cursor: 'pointer', fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', transition: 'color 0.3s' }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#EDE8DC'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#565450'}
        >
          Retornar ao Index (Esc) ✕
        </button>
      </header>
      
      <main style={{ maxWidth: 1600, margin: '0 auto', padding: '40px 72px 0', position: 'relative', zIndex: 10 }}>
        
        {/* ── INPUT GIGANTE COM CARET DOURADO E PLACEHOLDER FANTASMA ── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, ease: FINE_ART_EASE }} style={{ position: 'relative' }}>
          
          <AnimatePresence mode="wait">
            {!searchQuery && (
              <motion.div
                key={placeholderIndex}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 0.3, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.8 }}
                style={{
                  position: 'absolute', top: 0, left: 0, pointerEvents: 'none',
                  fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(4rem, 8vw, 7rem)', fontWeight: 400,
                  color: '#EDE8DC', letterSpacing: '-0.02em',
                }}
              >
                {SEARCH_SUGGESTIONS[placeholderIndex]}
              </motion.div>
            )}
          </AnimatePresence>

          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%', background: 'transparent', border: 'none', outline: 'none',
              fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(4rem, 8vw, 7rem)', fontWeight: 400,
              color: '#EDE8DC', letterSpacing: '-0.02em', paddingBottom: 24,
              borderBottom: '1px solid rgba(237,232,220,0.05)', transition: 'border-color 0.4s',
              caretColor: searchQuery ? '#BF8F3C' : 'transparent' // Cursor só aparece quando tem texto
            }}
            onFocus={(e) => e.target.style.borderBottom = '1px solid rgba(191,143,60,0.5)'}
            onBlur={(e) => e.target.style.borderBottom = '1px solid rgba(237,232,220,0.05)'}
          />
        </motion.div>

        {/* ── BARRA DE CONTROLE DOS RESULTADOS ── */}
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4, duration: 0.8 }}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, paddingBottom: 40 }}
        >
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', color: '#565450', textTransform: 'uppercase' }}>
            {isLoading && debouncedSearch ? (
              <span style={{ color: '#BF8F3C', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Loader2 className="animate-spin" size={12} /> Consultando rastreadores...
              </span>
            ) : debouncedSearch && allMovies.length > 0 ? (
              <span style={{ color: '#EDE8DC' }}>{data?.count || 0} Registros localizados na rede.</span>
            ) : debouncedSearch && allMovies.length === 0 && !isLoading ? (
              <span style={{ color: '#8C3A3A' }}>Sinal não encontrado. Refine os parâmetros da busca.</span>
            ) : (
              <span>Pronto para iniciar busca.</span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 16, fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            <button onClick={() => setViewMode("grid")} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: viewMode === 'grid' ? '#EDE8DC' : '#565450', transition: 'color 0.3s' }}>
              [ GRADE ]
            </button>
            <button onClick={() => setViewMode("list")} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: viewMode === 'list' ? '#EDE8DC' : '#565450', transition: 'color 0.3s' }}>
              [ LISTA ]
            </button>
          </div>
        </motion.div>

        {/* ── EXIBIÇÃO DE RESULTADOS ── */}
        {allMovies.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: FINE_ART_EASE }}>
            {viewMode === 'grid' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '80px 48px' }}>
                {allMovies.map((movie) => (
                  <FilmGridCard key={movie.id} film={movie} router={router} setExpandedId={setExpandedId} onHover={setHoveredId} />
                ))}
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                {allMovies.map((movie) => (
                  <FilmRow 
                    key={movie.id} 
                    film={movie} 
                    isHovered={hoveredId === movie.id && expandedId === null} 
                    isDimmed={(hoveredId !== null && hoveredId !== movie.id) || (expandedId !== null && expandedId !== movie.id)}
                    isExpanded={expandedId === movie.id}
                    onHover={setHoveredId} 
                    onClick={setExpandedId} 
                    router={router}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}

        <div ref={loadMoreRef} style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '40px' }}>
          {debouncedSearch && isFetching && page > 1 && (
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
              <Loader2 style={{ width: 24, height: 24, color: '#BF8F3C' }} />
            </motion.div>
          )}
        </div>

      </main>
    </div>
  );
}