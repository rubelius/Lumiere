'use client';
import { motion, AnimatePresence } from "framer-motion";
import { Search, Filter, Check } from "lucide-react";
import { useRouter } from 'next/navigation';
import { useState } from "react";
import { MovieCard } from "@/components/ui/movie-card";

const FINE_ART_EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

// 1. Interface para o TypeScript parar de dar erro nas propriedades
interface Movie {
  id: number;
  number: string;
  title: string;
  year: string;
  img: string;
  director: string;
  qualities: string[];
  runtime: string;
  synopsis: string;
}

// 2. O Componente de Lista Interativa (FilmRow)
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
      style={{ display: 'block', position: 'relative', zIndex: isHovered || isExpanded ? 10 : 1, cursor: isExpanded ? 'default' : 'crosshair' }}
    >
      <motion.div
        layout initial={false}
        animate={{
          height: isExpanded ? '100vh' : isHovered ? 240 : 70, 
          opacity: isDimmed ? 0.15 : 1, 
          backgroundColor: isHovered ? 'rgba(237,232,220,0.01)' : 'rgba(237,232,220,0)',
        }}
        transition={{ duration: 0.85, ease: FINE_ART_EASE }}
        style={{ borderBottom: '1px solid rgba(237,232,220,0.03)', overflow: 'hidden', position: 'relative' }}
      >
        <motion.div
          initial={false}
          animate={{ opacity: isExpanded ? 1 : isHovered ? 0.10 : 0, width: isExpanded ? '100%' : isHovered ? '50%' : '0%' }}
          transition={{ duration: 0.85, ease: FINE_ART_EASE }}
          style={{ position: 'absolute', top: 0, bottom: 0, right: 0, overflow: 'hidden', zIndex: -1, filter: 'grayscale(100%)', transformOrigin: 'right' }}
        >
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, #080806 0%, transparent 100%)', zIndex: 1 }} />
          <img src={film.img} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
        </motion.div>

        <motion.div animate={{ color: isHovered ? '#BF8F3C' : '#302E2A' }} style={{ position: 'absolute', left: 40, top: 28, fontFamily: "'DM Mono', monospace", fontSize: '10px' }}>
          {film.number}
        </motion.div>

        <AnimatePresence>
          {isHovered && !isExpanded && (
            <motion.div
              initial={{ opacity: 0, filter: 'blur(10px)', scale: 0.95 }} animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }} exit={{ opacity: 0, filter: 'blur(10px)', scale: 0.95 }}
              style={{ position: 'absolute', left: 90, top: 35, width: 110, height: 160, zIndex: 5 }}
            >
              <img src={film.img} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(25%) contrast(1.1)' }} alt="" />
            </motion.div>
          )}
        </AnimatePresence>

        <motion.h3
          animate={{
            scale: isExpanded ? 2.5 : isHovered ? 1.35 : 1,
            color: isExpanded ? '#FFFFFF' : isHovered ? '#EDE8DC' : '#8C8880',
            y: isExpanded ? '30vh' : isHovered ? 12 : 0,
            x: isExpanded ? '10vw' : 0
          }}
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
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'absolute', right: 40, top: 28, display: 'flex', gap: 40, color: '#302E2A', fontFamily: "'DM Mono', monospace", fontSize: '10px', textTransform: 'uppercase' }}
            >
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

function FilmGridCard({ film, router, setExpandedId }: { film: Movie, router: any, setExpandedId: (id: number | null) => void }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => { 
        setExpandedId(film.id); 
        setTimeout(() => router.push(`/movie/${film.id}`), 800); 
      }}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 1, ease: FINE_ART_EASE }}
      style={{ cursor: 'crosshair', display: 'flex', flexDirection: 'column', position: 'relative' }}
    >
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: isHovered ? '#BF8F3C' : '#302E2A', letterSpacing: '0.2em', marginBottom: 12, transition: 'color 0.4s ease' }}>
        [{film.number}]
      </div>

      <div style={{ position: 'relative', aspectRatio: '2/3', overflow: 'hidden', backgroundColor: '#040402', border: isHovered ? '1px solid rgba(191,143,60,0.3)' : '1px solid rgba(237,232,220,0.05)', transition: 'border-color 0.6s ease' }}>
        <motion.img
          src={film.img}
          animate={{ scale: isHovered ? 1.05 : 1, filter: isHovered ? 'grayscale(0%) contrast(1.1)' : 'grayscale(35%) contrast(1)' }}
          transition={{ duration: 0.8, ease: FINE_ART_EASE }}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />

        <motion.div
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.6, ease: FINE_ART_EASE }}
          style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #080806 0%, rgba(8,8,6,0.9) 35%, transparent 100%)', pointerEvents: 'none' }}
        />

        <motion.div
          initial={false}
          animate={{ y: isHovered ? 0 : 20, opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.6, ease: FINE_ART_EASE }}
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '32px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}
        >
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {film.qualities.map((q) => (
              <span key={q} style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', letterSpacing: '0.15em', padding: '4px 8px', border: '1px solid rgba(191,143,60,0.4)', color: '#BF8F3C', backgroundColor: 'rgba(8,8,6,0.6)' }}>
                {q}
              </span>
            ))}
          </div>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.25rem', color: '#EDE8DC', fontStyle: 'italic', margin: 0, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {film.synopsis}
          </p>
        </motion.div>
      </div>

      <div style={{ marginTop: 24 }}>
        <motion.div animate={{ color: isHovered ? '#FFFFFF' : '#EDE8DC' }} transition={{ duration: 0.4 }} style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.8rem', lineHeight: 1.1, marginBottom: 8, letterSpacing: '-0.01em' }}>
          {film.title}
        </motion.div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', color: '#565450', textTransform: 'uppercase' }}>
          {film.director} // <span style={{ color: isHovered ? '#BF8F3C' : '#302E2A', transition: 'color 0.4s' }}>{film.year}</span>
        </div>
      </div>
    </motion.div>
  );
}

export default function Library() {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  
  // 1. NOVO ESTADO: Controla qual categoria está ativa no momento
  const [activeCategory, setActiveCategory] = useState("O Acervo");

  const [hoveredId, setHoveredId] = useState<string | number | null>(null);
  const [expandedId, setExpandedId] = useState<string | number | null>(null);

  // Cole isso logo após a declaração do "router"
  const [selectedQualities, setSelectedQualities] = useState<string[]>([]);
  const [selectedMovements, setSelectedMovements] = useState<string[]>([]);

  const toggleQuality = (quality: string) => {
    setSelectedQualities(prev => prev.includes(quality) ? prev.filter(q => q !== quality) : [...prev, quality]);
  };
  const toggleMovement = (movement: string) => {
    setSelectedMovements(prev => prev.includes(movement) ? prev.filter(m => m !== movement) : [...prev, movement]);
  };

  const router = useRouter();

  const libraryMovies: Movie[] = [
    { id: 1, number: "001", title: "L'Avventura", year: "1960", img: "/images/poster-1.png", director: "Michelangelo Antonioni", qualities: ["REMUX", "4K"], runtime: "2h 23m", synopsis: "Uma mulher desaparece durante uma viagem de barco no Mediterrâneo, e seu amante e sua melhor amiga iniciam uma busca que gradualmente se transforma em uma nova relação." },
    { id: 2, number: "002", title: "Solaris", year: "1972", img: "/images/poster-2.png", director: "Andrei Tarkovsky", qualities: ["4K", "HDR"], runtime: "2h 47m", synopsis: "Um psicólogo é enviado a uma estação espacial orbitando um planeta oceânico para investigar a morte de um médico e os problemas mentais dos cosmonautas." },
    { id: 3, number: "003", title: "Persona", year: "1966", img: "/images/poster-3.png", director: "Ingmar Bergman", qualities: ["REMUX", "ATMOS"], runtime: "1h 25m", synopsis: "Uma enfermeira é encarregada de cuidar de uma atriz que ficou subitamente muda, e suas personalidades começam a se fundir de forma perturbadora." },
    { id: 4, number: "004", title: "Barry Lyndon", year: "1975", img: "/images/poster-4.png", director: "Stanley Kubrick", qualities: ["4K"], runtime: "3h 5m", synopsis: "A ascensão e queda de um jovem irlandês oportunista na aristocracia inglesa do século XVIII." },
    { id: 5, number: "005", title: "Metropolis", year: "1927", img: "/images/poster-5.png", director: "Fritz Lang", qualities: ["REMUX", "HDR"], runtime: "2h 33m", synopsis: "Em uma cidade futurista distópica, o filho do governante da cidade tenta mediar a luta entre a classe trabalhadora subterrânea e a elite da superfície." },
  ];

  const categories = ["O Acervo", "Longas", "Séries", "Mostras", "Preservados"];

  return (
    // Removi o paddingLeft: 96 daqui caso o seu layout principal já esteja cuidando do espaço da Sidebar!
    // Se o conteúdo ficar grudado na esquerda, devolva o "paddingLeft: 96" para a linha abaixo.
    <div style={{ minHeight: '100vh', backgroundColor: '#080806', color: '#EDE8DC', paddingBottom: 80 }}>
      
      <div className="fixed inset-0 bg-noise opacity-[0.03] mix-blend-overlay pointer-events-none z-50" />
      
      {/* 2. REMOVIDA A SIDEBAR DAQUI */}
      
      <main style={{ maxWidth: 1600, margin: '0 auto', padding: '80px 72px 0' }}>
        
        {/* ── CABEÇALHO DO ARQUIVO ── */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 48, paddingBottom: 24, borderBottom: '1px solid rgba(237,232,220,0.05)' }}>
          <div>
            <div style={{ overflow: 'hidden', marginBottom: 12 }}>
              <motion.div 
                initial={{ y: '100%' }} animate={{ y: '0%' }} transition={{ duration: 1, ease: FINE_ART_EASE }}
                style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', color: '#BF8F3C', textTransform: 'uppercase' }}
              >
                [ DIRETÓRIO RAIZ ]
              </motion.div>
            </div>
            <div style={{ overflow: 'hidden' }}>
              <motion.h1 
                initial={{ y: '100%' }} animate={{ y: '0%' }} transition={{ duration: 1.2, ease: FINE_ART_EASE }}
                style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(3rem, 5vw, 4.5rem)', fontWeight: 400, margin: 0, lineHeight: 1, letterSpacing: '-0.02em' }}
              >
                O Arquivo.
              </motion.h1>
            </div>
          </div>

          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4, duration: 1 }}
            style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', color: '#565450', textTransform: 'uppercase' }}
          >
            128 OBRAS PRESERVADAS // STATUS: ONLINE
          </motion.div>
        </div>

        {/* ── BARRA DE COMANDOS (Filtros e Busca) ── */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.8, ease: FINE_ART_EASE }}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40, borderBottom: '1px solid rgba(237,232,220,0.05)', paddingBottom: 24 }}
        >
          {/* Categorias Editoriais */}
          <div style={{ display: 'flex', gap: 32 }}>
            {categories.map((cat) => {
              // 3. LÓGICA DE ATIVAÇÃO
              const isActive = activeCategory === cat;
              
              return (
                <button 
                  key={cat}
                  // Ao clicar, atualiza o estado
                  onClick={() => setActiveCategory(cat)}
                  style={{ 
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase',
                    // A cor de texto e a borda agora reagem dinamicamente se o item está ativo
                    color: isActive ? '#BF8F3C' : '#565450',
                    borderBottom: isActive ? '1px solid rgba(191,143,60,0.3)' : '1px solid transparent',
                    paddingBottom: 4, transition: 'color 0.3s, border-color 0.3s'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#EDE8DC' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = isActive ? '#BF8F3C' : '#565450' }}
                >
                  {cat}
                </button>
              )
            })}
          </div>

          {/* Comandos da Direita */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
            <div style={{ display: 'flex', gap: 16, fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
              <button 
                onClick={() => setViewMode("grid")}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: viewMode === 'grid' ? '#EDE8DC' : '#565450', transition: 'color 0.3s' }}
              >
                [ GRADE ]
              </button>
              <button 
                onClick={() => setViewMode("list")}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: viewMode === 'list' ? '#EDE8DC' : '#565450', transition: 'color 0.3s' }}
              >
                [ LISTA ]
              </button>
            </div>

            <div style={{ position: 'relative', width: 280 }}>
              <Search style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#565450' }} />
              <input 
                type="text" 
                placeholder="CONSULTAR ACERVO..." 
                style={{ 
                  width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(237,232,220,0.1)',
                  padding: '8px 8px 8px 24px', color: '#EDE8DC', fontFamily: "'DM Mono', monospace", fontSize: '10px', 
                  letterSpacing: '0.15em', outline: 'none', transition: 'border-color 0.3s'
                }}
                onFocus={(e) => e.target.style.borderBottom = '1px solid #BF8F3C'}
                onBlur={(e) => e.target.style.borderBottom = '1px solid rgba(237,232,220,0.1)'}
              />
            </div>

            <button 
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              style={{ 
                background: isFilterOpen ? 'rgba(191,143,60,0.1)' : 'transparent', 
                border: isFilterOpen ? '1px solid rgba(191,143,60,0.4)' : '1px solid rgba(237,232,220,0.1)', 
                color: isFilterOpen ? '#BF8F3C' : '#8C8880', 
                padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', transition: 'all 0.3s'
              }}
            >
              <Filter style={{ width: 12, height: 12 }} />
              PARÂMETROS
            </button>
          </div>
        </motion.div>

        {/* ── PAINEL DE FILTROS TÁTICO ── */}
        <AnimatePresence>
          {isFilterOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.6, ease: FINE_ART_EASE }} style={{ overflow: 'hidden', marginBottom: 40 }}>
              <div style={{ border: '1px solid rgba(237,232,220,0.05)', background: '#040402', padding: '48px 64px', display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 80 }}>
                
                <div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#BF8F3C', marginBottom: 24, letterSpacing: '0.2em' }}>[ ESPECIFICAÇÕES TÉCNICAS ]</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 16px' }}>
                    {["REMUX", "4K", "HDR", "Dolby Vision", "Dolby Atmos", "WEB-DL"].map((q) => {
                      const isSelected = selectedQualities.includes(q);
                      return (
                        <label key={q} onClick={() => toggleQuality(q)} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                          <div style={{ width: 14, height: 14, border: isSelected ? '1px solid #BF8F3C' : '1px solid rgba(237,232,220,0.15)', background: isSelected ? 'rgba(191,143,60,0.1)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                            {isSelected && <Check style={{ width: 10, height: 10, color: '#BF8F3C' }} />}
                          </div>
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: isSelected ? '#EDE8DC' : '#565450', letterSpacing: '0.15em', transition: 'color 0.2s' }}>{q}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#BF8F3C', marginBottom: 24, letterSpacing: '0.2em' }}>[ MOVIMENTOS CINEMATOGRÁFICOS ]</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                    {["Nouvelle Vague", "Neorealismo Italiano", "Expressionismo Alemão", "Nova Hollywood", "Cinema Novo", "Dogma 95"].map((m) => {
                      const isSelected = selectedMovements.includes(m);
                      return (
                        <button 
                          key={m} onClick={() => toggleMovement(m)} 
                          style={{ 
                            background: isSelected ? 'rgba(191,143,60,0.05)' : 'transparent', 
                            border: isSelected ? '1px solid rgba(191,143,60,0.4)' : '1px solid rgba(237,232,220,0.1)', 
                            padding: '8px 16px', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', 
                            color: isSelected ? '#BF8F3C' : '#565450', cursor: 'pointer', transition: 'all 0.3s'
                          }}
                        >
                          {m}
                        </button>
                      )
                    })}
                  </div>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── GRADE / LISTA DE OBRAS ── */}
        {/* ── GRADE / LISTA DE OBRAS ── */}
        <motion.div layout transition={{ duration: 0.8, ease: FINE_ART_EASE }}>
          {viewMode === 'grid' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '80px 48px' }}>
              {libraryMovies.map((movie) => (
                <FilmGridCard key={movie.id} film={movie} router={router} setExpandedId={setExpandedId} />
              ))}
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              {libraryMovies.map((movie) => (
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
      </main>
    </div>
  );
}