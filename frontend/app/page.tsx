'use client'

import { HeroProgramme } from '@/components/home/HeroProgramme'
import { CinemaMarquee, FilmProgramme, FilmEntry } from '@/components/home/FilmProgramme'
import { NowProjecting, AdmitOne, LibraryCount, SessionRow} from '@/components/home/Sections'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useMovies } from '@/features/movies/hooks/useMovies';

const FINE_ART_EASE = [0.22, 1, 0.36, 1] as [number, number, number, number]

// ── DICIONÁRIO CAMALEÃO: Mapeia Gêneros para Cores Cinematográficas ──
const getCinematicColor = (genres: string[]) => {
  if (!genres || genres.length === 0) return '#BF8F3C'; // Dourado Lumière (Padrão)
  const genreList = genres.join(',').toLowerCase();
  
  if (genreList.includes('ficção') || genreList.includes('sci-fi')) return '#4A7A8C'; // Teal
  if (genreList.includes('terror') || genreList.includes('horror')) return '#8C3A3A'; // Crimson
  if (genreList.includes('romance')) return '#A87A8C'; // Rose
  if (genreList.includes('mistério') || genreList.includes('thriller')) return '#5E8872'; // Musgo
  return '#BF8F3C'; 
};

export default function HomePage() {
  const [hoveredSessionId, setHoveredSessionId] = useState<string | number | null>(null)
  
  const [heroIndex, setHeroIndex] = useState(0);
  const [randomHeroMovies, setRandomHeroMovies] = useState<any[]>([]);
  
  // O Estado do Cérebro (Último filme assistido)
  const [lastWatched, setLastWatched] = useState<any | null>(null);

  const { data, isLoading } = useMovies({ page: 1 });

  // ── INICIALIZA O CARROSSEL E A MEMÓRIA ──
  useEffect(() => {
    if (data?.results && randomHeroMovies.length === 0) {
      const shuffled = [...data.results].sort(() => 0.5 - Math.random());
      setRandomHeroMovies(shuffled.slice(0, 5));

      // Busca na memória do navegador o progresso real (Se existir)
      try {
        const historyStr = localStorage.getItem('lumiere_history');
        if (historyStr) {
          setLastWatched(JSON.parse(historyStr));
        } else {
          // Fallback: Pega o terceiro filme da lista aleatória para simular
          setLastWatched({
            id: shuffled[2].id,
            title: shuffled[2].title,
            director: shuffled[2].director,
            year: shuffled[2].year,
            backgroundSrc: shuffled[2].background_url || shuffled[2].poster_url,
            progress: 42,
            remainingTime: '1h 12m'
          });
        }
      } catch (e) {
        console.log("Memória não iniciada");
      }
    }
  }, [data, randomHeroMovies.length]);

  // Rotaciona os filmes do Hero
  useEffect(() => {
    if (randomHeroMovies.length === 0) return;
    const interval = setInterval(() => {
      setHeroIndex(prev => (prev + 1) % randomHeroMovies.length);
    }, 15000); 
    return () => clearInterval(interval);
  }, [randomHeroMovies]);

  const getRuntimeStr = (mins: any) => {
    const v = Number(mins);
    if (!v || v <= 0 || isNaN(v)) return 'Duração desconhecida';
    return `${Math.floor(v / 60)}h ${v % 60}m`;
  };

  if (isLoading || randomHeroMovies.length === 0) {
    return (
      <div style={{ background: '#080806', minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }} style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#BF8F3C', letterSpacing: '0.2em' }}>
          MONTANDO PROGRAMAÇÃO...
        </motion.div>
      </div>
    );
  }

  const results = data?.results || [];
  const heroMovie = randomHeroMovies[heroIndex];
  const heroAccentColor = getCinematicColor(heroMovie?.genres || []);

  // ── CURADORIA INTENCIONAL: Obras-Primas Intocáveis ──
  // Filtra filmes que têm ranking TSPDT e ordena do melhor (menor número) pro pior
  const masterPieces = [...results]
    .filter(m => m.ranking_current && m.ranking_current < 1000)
    .sort((a, b) => a.ranking_current - b.ranking_current);
  
  // Se não achou TSPDT suficiente, pega os de maior nota no TMDB
  const programmeMovies = masterPieces.length >= 4 
    ? masterPieces.slice(0, 8) 
    : [...results].sort((a, b) => (b.tmdb_rating || 0) - (a.tmdb_rating || 0)).slice(0, 8);

  const FEATURED_FILMS: FilmEntry[] = programmeMovies.map((movie: any, index: number) => ({
    id: movie.id,
    number: String(index + 1).padStart(3, '0'),
    title: movie.title,
    originalTitle: movie.original_title,
    director: movie.director || 'Desconhecido',
    year: String(movie.year || '----'),
    country: movie.country || 'N/A',
    runtime: getRuntimeStr(movie.length_minutes),
    qualities: movie.in_plex ? ['PLEX'] : ['OFFLINE'],
    posterSrc: movie.poster_url || '/images/poster-1.png',
    backgroundSrc: movie.background_url || '',
    genre: movie.genres?.[0] || 'Cinema',
    synopsis: movie.overview || 'Registro ausente.'
  }));

  // ── CURADORIA INTENCIONAL: Foco no Diretor ──
  // Acha o diretor com mais filmes no acervo carregado e cria a sessão dele
  const directorCount: Record<string, any[]> = {};
  results.forEach((m: any) => {
    if (m.director && m.director !== 'Desconhecido') {
      if (!directorCount[m.director]) directorCount[m.director] = [];
      directorCount[m.director].push(m);
    }
  });
  
  // Ordena para achar o diretor mais presente
  const sortedDirectors = Object.entries(directorCount).sort((a, b) => b[1].length - a[1].length);
  const topDirectorName = sortedDirectors[0]?.[0] || 'Auteurs';
  const topDirectorMovies = sortedDirectors[0]?.[1] || results.slice(12, 15);

  const DYNAMIC_SESSIONS = [
    {
      number: 'S·001',
      title: `Foco: ${topDirectorName}`,
      films: topDirectorMovies.length,
      duration: getRuntimeStr(topDirectorMovies.reduce((acc: number, m: any) => acc + (Number(m.length_minutes) || 120), 0)),
      date: 'Nesta Semana'
    },
    {
      number: 'S·002',
      title: 'Descobertas Recentes',
      films: 4,
      duration: '7h 10m',
      date: 'Sáb · 20:00'
    }
  ];

  return (
    <div style={{ background: '#080806', color: '#EDE8DC', minHeight: '100dvh', display: 'flex' }}>
      <main style={{ flex: 1, minWidth: 0, marginLeft: 0 }}>
        
        {heroMovie && (
          <HeroProgramme
            programmeNumber={`00${heroIndex + 1}`}
            title={heroMovie.title}
            subtitle={heroMovie.tagline || heroMovie.original_title}
            director={heroMovie.director || 'Desconhecido'}
            year={String(heroMovie.year || '----')}
            country={heroMovie.country || 'N/A'}
            runtime={getRuntimeStr(heroMovie.length_minutes)}
            synopsis={heroMovie.overview || 'Sinopse não preservada no registro principal.'}
            qualities={heroMovie.in_plex ? ['PLEX'] : ['OFFLINE']}
            backgroundSrc={heroMovie.background_url || ''} 
            posterSrc={heroMovie.poster_url || '/images/posters/2001.jpg'}
            trailerUrl={heroMovie.trailer_url} // <- O TRAILER PASSA AQUI!
            accentColor={heroAccentColor}      // <- O CAMALEÃO PASSA AQUI!
            href={`/movie/${heroMovie.id}`}
            logoUrl={heroMovie.logo_url}
            cinematographer={heroMovie.cinematographer}
          />
        )}

        <CinemaMarquee />

        <FilmProgramme title="Obras-Primas do Acervo" subtitle="Top TSPDT / Aclamados" films={FEATURED_FILMS} />

        {/* ── 4. NOW PROJECTING (Alimentado pela Memória) ── */}
        {lastWatched && (
          <NowProjecting
            title={lastWatched.title}
            director={lastWatched.director || 'Desconhecido'}
            year={String(lastWatched.year || '----')}
            progress={lastWatched.progress} 
            remainingTime={lastWatched.remainingTime}
            frameSrc={lastWatched.backgroundSrc}
            href={`/player?id=${lastWatched.id}`}
          />
        )}

        <section style={{ padding: '72px 72px 120px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 48, paddingBottom: 24, borderBottom: '1px solid rgba(237,232,220,0.05)' }}>
            <div style={{ overflow: 'hidden' }}>
              <motion.h2
                initial={{ y: '100%' }} whileInView={{ y: '0%' }} viewport={{ once: true }} transition={{ duration: 1.2, ease: FINE_ART_EASE }}
                style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(2rem, 3vw, 2.8rem)', fontWeight: 400, color: '#EDE8DC', lineHeight: 1, letterSpacing: '-0.01em', margin: 0 }}
              >
                Próximas Projeções
              </motion.h2>
            </div>
            
            <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 1, delay: 0.3 }}>
              <Link href="/library" style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#565450', textDecoration: 'none', borderBottom: '1px solid rgba(237,232,220,0.07)', paddingBottom: 2, transition: 'color 0.2s, border-color 0.2s' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#BF8F3C'; e.currentTarget.style.borderColor = 'rgba(191,143,60,0.3)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#565450'; e.currentTarget.style.borderColor = 'rgba(237,232,220,0.07)' }}
              >
                Explorar Arquivo →
              </Link>
            </motion.div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
            {DYNAMIC_SESSIONS.map((s: any, i: number) => (
              <motion.div
                key={s.number} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-5%" }} transition={{ delay: i * 0.08, duration: 0.8, ease: FINE_ART_EASE }}
              >
                <SessionRow session={s} isHovered={hoveredSessionId === s.number} isDimmed={hoveredSessionId !== null && hoveredSessionId !== s.number} onHover={setHoveredSessionId} />
              </motion.div>
            ))}
          </div>
        </section>

        <AdmitOne
          sessionTitle={`A Arte de ${topDirectorName}`}
          filmCount={topDirectorMovies.length}
          totalDuration="Múltiplas Obras"
          date="HOJE"
          sessionNumber="004"
          href={`/library?search=${encodeURIComponent(topDirectorName)}`}
          filmList={topDirectorMovies.slice(0,3).map((m: any) => m.title)} 
        />

        <LibraryCount count={data?.count || 0} />

        <footer style={{ padding: '120px 72px 40px', background: '#040402', borderTop: '1px solid rgba(237,232,220,0.05)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 64, borderBottom: '1px solid rgba(237,232,220,0.05)', paddingBottom: 64, marginBottom: 32, alignItems: 'end' }}>
            <div>
              <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 1, ease: FINE_ART_EASE }} style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(4rem, 8vw, 7rem)', color: '#EDE8DC', margin: 0, lineHeight: 0.85, letterSpacing: '-0.02em' }}>
                Lumière.
              </motion.h2>
              <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 1, delay: 0.3, ease: FINE_ART_EASE }} style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.4rem', color: '#8C8880', fontStyle: 'italic', marginTop: 24, margin: '24px 0 0 0' }}>
                A preservação da memória através da luz e do tempo.
              </motion.p>
            </div>

            <div style={{ display: 'flex', gap: 80 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#BF8F3C', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>[ Diretório ]</span>
                {['Arquivo Completo', 'Sessões Programadas', 'O Manifesto'].map((item) => (
                  <Link key={item} href="/library" style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#565450', letterSpacing: '0.1em', textTransform: 'uppercase', textDecoration: 'none', transition: 'color 0.3s' }} onMouseEnter={(e) => e.currentTarget.style.color = '#EDE8DC'} onMouseLeave={(e) => e.currentTarget.style.color = '#565450'}>
                    {item}
                  </Link>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#BF8F3C', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>[ Sistema ]</span>
                {['Acessar Terminal', 'Configurações', 'Diagnóstico'].map((item) => (
                  <Link key={item} href="#" style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#565450', letterSpacing: '0.1em', textTransform: 'uppercase', textDecoration: 'none', transition: 'color 0.3s' }} onMouseEnter={(e) => e.currentTarget.style.color = '#EDE8DC'} onMouseLeave={(e) => e.currentTarget.style.color = '#565450'}>
                    {item}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#4A4844' }}>
            <span>© 2026 Lumière Personal Cinema</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>Desenvolvido por Edwin G. David <span style={{ color: '#BF8F3C' }}>//</span> Porto Alegre, RS</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <motion.span animate={{ opacity: [1, 0.2, 1] }} transition={{ repeat: Infinity, duration: 3, ease: "linear" }} style={{ width: 4, height: 4, backgroundColor: '#BF8F3C', borderRadius: '50%', display: 'inline-block' }} /> Status: Operacional
            </span>
          </div>
        </footer>
      </main>
    </div>
  )
}