'use client'

import { HeroProgramme } from '@/components/home/HeroProgramme'
import { FINE_ART_EASE } from '@/lib/motion';
import { etiquetasDeDisponibilidade } from '@/lib/disponibilidade';
import Image from 'next/image';
import { CinemaMarquee, FilmProgramme, FilmEntry } from '@/components/home/FilmProgramme'
import { usePrograma, dataDoPrograma } from '@/features/movies/hooks/usePrograma'
import { NowProjecting, AdmitOne, LibraryCount, SessionRow } from '@/components/home/Sections'
import { AfinidadeAferida } from '@/components/home/AfinidadeAferida'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useState, useEffect, useCallback } from 'react'
import { useContinuarAssistindo, useEstatisticasDoAcervo, useMovies } from '@/features/movies/hooks/useMovies';


// ── TIPAGEM SEGURA PARA ACALMAR O TYPESCRIPT ──
interface HomeMovie {
  id: string | number;
  title: string;
  original_title?: string;
  director?: string;
  year?: number | string | null; // <-- Agora aceita null perfeitamente
  country?: string;
  length_minutes?: number | null;
  in_plex?: boolean;
  poster_url?: string;
  background_url?: string;
  genres?: string[];
  overview?: string;
  ranking_current?: number | null;
  tmdb_rating?: number | string | null; // Prevendo que a API possa mandar como string
  tagline?: string;
  trailer_url?: string;
  logo_url?: string;
  cinematographer?: string;
}

const getCinematicColor = (genres: string[]) => {
  if (!genres || genres.length === 0) return 'var(--gold)'; 
  const genreList = genres.join(',').toLowerCase();
  
  if (genreList.includes('ficção') || genreList.includes('sci-fi')) return '#4A7A8C'; 
  if (genreList.includes('terror') || genreList.includes('horror')) return '#8C3A3A'; 
  if (genreList.includes('romance')) return '#A87A8C'; 
  if (genreList.includes('mistério') || genreList.includes('thriller')) return '#5E8872'; 
  return 'var(--gold)'; 
};

/** "1h 55m restantes" a partir de segundos. Vazio quando a duração é desconhecida. */
function formataRestante(segundos: number): string {
  if (!Number.isFinite(segundos) || segundos <= 0) return '';
  const h = Math.floor(segundos / 3600);
  const m = Math.round((segundos % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function HomePage() {
  const [hoveredSessionId, setHoveredSessionId] = useState<string | number | null>(null)
  const [hoveredFeaturedId, setHoveredFeaturedId] = useState<string | number | null>(null)
  
  const [heroIndex, setHeroIndex] = useState(0);
  const [randomHeroMovies, setRandomHeroMovies] = useState<HomeMovie[]>([]);
  const { data: continuar } = useContinuarAssistindo();
  const { data: estatisticas } = useEstatisticasDoAcervo();
  const emCurso = continuar?.results?.[0];

  const { data, isLoading, isError, refetch } = useMovies({ page: 1 });
  const { data: programa } = usePrograma();

  // O PROGRAMA DO DIA substitui o arranjo que fazia a home inteira viver da
  // primeira página desta mesma listagem — 20 filmes ordenados por ranking,
  // dos quais o hero sorteava 10. Eram 0,077% das 25.908 obras, e por isso
  // pareciam sempre os mesmos: eram sempre os mesmos.
  //
  // `useMovies` fica para o que ainda depende dele (a contagem do rodapé);
  // as seções e o hero agora vêm do programa.
  const secoes = programa?.secoes ?? [];
  const doPrograma = secoes.flatMap((s) => s.filmes) as unknown as HomeMovie[];


  useEffect(() => {
    if (doPrograma.length > 0 && randomHeroMovies.length === 0) {
      // Do PROGRAMA, e não dos 20 primeiros do ranking. E sem sortear de
      // novo: o programa já é o sorteio do dia, e embaralhar por cima dele
      // faria o hero mudar a cada F5 — instável, não vivo.
      //
      // (O sorteio antigo usava `sort(() => 0.5 - Math.random())`, que nem
      // embaralhamento uniforme é: medido em 20.000 tiragens, o primeiro
      // colocado entrava em 58,1% das cargas contra 44,5% do décimo
      // terceiro.)
      setRandomHeroMovies(doPrograma.slice(0, 10));

      // O "retomar" vem do servidor, via useContinuarAssistindo. Aqui ficava
      // um fallback que inventava "15% assistido, 1h55m restantes" para o
      // filme mais bem avaliado — um filme que o usuário nunca tinha aberto.
    }
  }, [doPrograma, randomHeroMovies.length]);

  const handleNextHero = useCallback(() => {
    setHeroIndex(prev => (prev + 1) % randomHeroMovies.length);
  }, [randomHeroMovies.length]);

  const handlePrevHero = useCallback(() => {
    setHeroIndex(prev => (prev - 1 + randomHeroMovies.length) % randomHeroMovies.length);
  }, [randomHeroMovies.length]);

  useEffect(() => {
    if (randomHeroMovies.length === 0) return;
    const interval = setInterval(() => {
      handleNextHero();
    }, 30000); 
    return () => clearInterval(interval);
  }, [randomHeroMovies, heroIndex, handleNextHero]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') handleNextHero();
      else if (e.key === 'ArrowLeft') handlePrevHero();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNextHero, handlePrevHero]);

  const getRuntimeStr = (mins: number | string | null | undefined) => {
    const v = Number(mins);
    if (!v || v <= 0 || isNaN(v)) return 'Duração desconhecida';
    return `${Math.floor(v / 60)}h ${v % 60}m`;
  };

  // Falha da API não é carregamento. Sem este ramo, `isLoading` virava false,
  // `data` ficava undefined e a condição de baixo — lista vazia — prendia a
  // tela no mesmo spinner para sempre, sem dizer o que houve nem oferecer
  // saída.
  if (isError) {
    return (
      <div style={{ background: 'var(--bg)', minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 24, textAlign: 'center' }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#8C3A3A', letterSpacing: '0.2em' }}>
          // ACERVO INDISPONÍVEL
        </div>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '20px', color: 'var(--m2)', maxWidth: 420 }}>
          Não foi possível alcançar o servidor do acervo.
        </div>
        <button
          onClick={() => refetch()}
          style={{ background: 'transparent', border: '1px solid var(--gold)', color: 'var(--gold)', padding: '10px 22px', cursor: 'pointer', fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.2em' }}
        >
          [ TENTAR NOVAMENTE ]
        </button>
      </div>
    );
  }

  // ── NOVO LOADING CINEMATOGRÁFICO ──
  if (isLoading || randomHeroMovies.length === 0) {
    return (
      <div style={{ background: 'var(--bg)', minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
        <motion.svg animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }} viewBox="0 0 20 20" fill="none" style={{ width: 24, height: 24 }}>
          <rect x="3" y="2" width="2.2" height="16" fill="var(--gold)" />
          <rect x="3" y="15.8" width="9.5" height="2.2" fill="var(--gold)" />
        </motion.svg>
        <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }} style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'var(--gold)', letterSpacing: '0.2em' }}>
          MONTANDO PROGRAMAÇÃO...
        </motion.div>
      </div>
    );
  }

  // Cast explícito dos resultados para nossa interface clemente
  const results: HomeMovie[] = (data?.results as unknown as HomeMovie[]) || [];
  const heroMovie = randomHeroMovies[heroIndex];
  const heroAccentColor = getCinematicColor(heroMovie?.genres || []);

  // ── CORREÇÃO DAS OPERAÇÕES MATEMÁTICAS COM NUMBER() ──
  // A primeira seção do programa é sempre 'Obras-Primas do Acervo' — é a
  // âncora, e o backend garante que ela abre. As demais viram as seções
  // novas da home, logo abaixo.
  const primeira = secoes[0];
  const programmeMovies = (primeira?.filmes ?? []) as unknown as HomeMovie[];

  const paraEntrada = (movie: HomeMovie, index: number): FilmEntry => ({
    id: String(movie.id),
    number: String(index + 1).padStart(3, '0'),
    title: movie.title,
    originalTitle: movie.original_title || '',
    director: movie.director || 'Desconhecido',
    year: String(movie.year || '----'),
    country: movie.country || 'N/A',
    runtime: getRuntimeStr(movie.length_minutes),
    qualities: etiquetasDeDisponibilidade(movie),
    posterSrc: movie.poster_url || '/images/poster-1.png',
    backgroundSrc: movie.background_url || movie.poster_url || '/images/poster-1.png',
    genre: movie.genres?.[0] || 'Cinema',
    synopsis: movie.overview || 'Registro ausente.'
  });

  const FEATURED_FILMS: FilmEntry[] = programmeMovies.map(paraEntrada);

  // AS SESSÕES SÃO O PRÓPRIO PROGRAMA, e não duas linhas montadas aqui.
  //
  // O que havia: S·001 dizia "Foco: <diretor com mais filmes entre os 20>", e
  // como nos 20 primeiros do ranking todos os diretores são distintos, o
  // desempate por ordem sempre escolhia o do primeiro colocado — "Foco: Orson
  // Welles", para sempre, com 1 filme. S·002 era literal: "Descobertas
  // Recentes, 4 filmes, 7h 10m, Sáb · 20:00", escrito à mão, idêntico para
  // todo mundo.
  //
  // Agora cada linha é uma seção real do programa do dia, com a contagem e a
  // duração somadas dos filmes que ela de fato tem.
  const DYNAMIC_SESSIONS = secoes.map((secao, i) => ({
    number: `S·${String(i + 1).padStart(3, '0')}`,
    title: secao.titulo,
    films: secao.filmes.length,
    duration: getRuntimeStr(
      secao.filmes.reduce((acc, m) => acc + (Number(m.length_minutes) || 0), 0)),
    // A data do programa, e não um horário inventado. O antigo "Sáb · 20:00"
    // prometia uma sessão marcada que não existe em lugar nenhum.
    date: dataDoPrograma(programa?.dia).replace('PROGRAMA DE ', ''),
  }));

  const hoveredFeaturedFilm = FEATURED_FILMS.find(f => f.id === String(hoveredFeaturedId));

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--film)', minHeight: '100dvh', display: 'flex' }}>
      <main style={{ flex: 1, minWidth: 0, marginLeft: 0 }}>
        
        {heroMovie && (
          <HeroProgramme
            programmeNumber={`00${heroIndex + 1}`}
            title={heroMovie.title}
            subtitle={heroMovie.tagline || heroMovie.original_title || ''}
            director={heroMovie.director || 'Desconhecido'}
            year={String(heroMovie.year || '----')}
            country={heroMovie.country || 'N/A'}
            runtime={getRuntimeStr(heroMovie.length_minutes)}
            synopsis={heroMovie.overview || 'Sinopse não preservada no registro principal.'}
            qualities={etiquetasDeDisponibilidade(heroMovie)}
            backgroundSrc={heroMovie.background_url || ''} 
            posterSrc={heroMovie.poster_url || '/images/posters/2001.jpg'}
            trailerUrl={heroMovie.trailer_url} 
            accentColor={heroAccentColor}      
            logoUrl={heroMovie.logo_url}
            cinematographer={heroMovie.cinematographer}
            href={`/movie/${heroMovie.id}`}
            onNext={handleNextHero}
            onPrev={handlePrevHero}
          />
        )}

        <CinemaMarquee />

        <section style={{ position: 'relative' }}>
          <AnimatePresence>
            {hoveredFeaturedFilm?.backgroundSrc && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.15 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.2, ease: FINE_ART_EASE }}
                style={{
                  position: 'absolute', top: -100, left: 0, right: 0, bottom: -100, zIndex: 0, pointerEvents: 'none',
                  maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',
                  WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)'
                }}
              >
                <Image
                  src={hoveredFeaturedFilm.backgroundSrc}
                  alt=""
                  fill
                  sizes="100vw"
                  style={{ objectFit: 'cover', filter: 'grayscale(60%) contrast(1.1)' }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div style={{ position: 'relative', zIndex: 1 }}>
            {/* A DATA PRECISA ESTAR NA TELA.
                O programa é o mesmo do primeiro ao último acesso do dia, de
                propósito: um F5 que troca tudo não é vivo, é instável — a
                pessoa perde o filme que tinha visto de canto de olho. Mas uma
                home que não muda e não explica por quê se lê como defeito, e
                foi esse o relato. A data é a explicação. */}
            {programa?.dia && (
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.25em', color: 'var(--m3)', marginBottom: 20 }}>
                {dataDoPrograma(programa.dia)}
              </div>
            )}
            <FilmProgramme 
              title={primeira?.titulo || 'Obras-Primas do Acervo'} 
              subtitle={primeira?.subtitulo || 'Top TSPDT / Aclamados'} 
              films={FEATURED_FILMS} 
              onHover={setHoveredFeaturedId} 
            />
          </div>
        </section>

        {/* AS DEMAIS SEÇÕES DO PROGRAMA.
            Antes daqui a home tinha uma seção de filmes só — as obras-primas
            — e duas linhas de 'próximas projeções', uma delas literal. O
            acervo tem material medido para muito mais: 389 diretores com ≥10
            filmes, 394 fotógrafos, 6.482 filmes em preto e branco, 3.166
            curtas, 3.575 laureados em festival. */}
        {secoes.slice(1).map((secao) => (
          <section key={secao.chave} style={{ padding: '0 clamp(24px, 6vw, 96px) 80px' }}>
            <FilmProgramme
              title={secao.titulo}
              subtitle={secao.subtitulo}
              films={(secao.filmes as unknown as HomeMovie[]).map(paraEntrada)}
              onHover={() => {}}
            />
          </section>
        ))}

        {emCurso && (
          <NowProjecting
            title={emCurso.movie.title}
            director={emCurso.movie.director || 'Desconhecido'}
            year={String(emCurso.movie.year || '----')}
            progress={Math.round(emCurso.fraction * 100)}
            positionSeconds={emCurso.progress_seconds}
            remainingTime={formataRestante(emCurso.runtime_seconds - emCurso.progress_seconds)}
            frameSrc={emCurso.movie.background_url || emCurso.movie.poster_url || ''}
            href={`/player?id=${emCurso.movie.id}`}
          />
        )}

        <AfinidadeAferida />

        <section style={{ padding: '72px 72px 120px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 48, paddingBottom: 24, borderBottom: '1px solid rgba(237,232,220,0.05)' }}>
            <div style={{ overflow: 'hidden' }}>
              <motion.h2
                initial={{ y: '100%' }} whileInView={{ y: '0%' }} viewport={{ once: true }} transition={{ duration: 1.2, ease: FINE_ART_EASE }}
                style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(2rem, 3vw, 2.8rem)', fontWeight: 400, color: 'var(--film)', lineHeight: 1, letterSpacing: '-0.01em', margin: 0 }}
              >
                Próximas Projeções
              </motion.h2>
            </div>
            
            <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 1, delay: 0.3 }}>
              <Link href="/library" style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--m3)', textDecoration: 'none', borderBottom: '1px solid rgba(237,232,220,0.07)', paddingBottom: 2, transition: 'color 0.2s, border-color 0.2s' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--gold)'; e.currentTarget.style.borderColor = 'rgba(191,143,60,0.3)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--m3)'; e.currentTarget.style.borderColor = 'rgba(237,232,220,0.07)' }}
              >
                Explorar Arquivo →
              </Link>
            </motion.div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
            {DYNAMIC_SESSIONS.map((s, i) => (
              <motion.div
                key={s.number} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-5%" }} transition={{ delay: i * 0.08, duration: 0.8, ease: FINE_ART_EASE }}
              >
                <SessionRow session={s} isHovered={hoveredSessionId === s.number} isDimmed={hoveredSessionId !== null && hoveredSessionId !== s.number} onHover={setHoveredSessionId} />
              </motion.div>
            ))}
          </div>
        </section>

        {/* O convite aponta para a ÚLTIMA seção do programa — a mais
            distante das obras-primas, que é onde está a descoberta. Antes
            repetia "A Arte de Orson Welles" com 1 filme, pelo mesmo desempate
            que congelava as sessões. */}
        {secoes.length > 1 && (
          <AdmitOne
            sessionTitle={secoes[secoes.length - 1].titulo}
            filmCount={secoes[secoes.length - 1].filmes.length}
            totalDuration={secoes[secoes.length - 1].subtitulo}
            date={dataDoPrograma(programa?.dia).replace('PROGRAMA DE ', '')}
            sessionNumber={String(secoes.length).padStart(3, '0')}
            href="/library"
            filmList={secoes[secoes.length - 1].filmes.slice(0, 3).map((m) => m.title)}
          />
        )}

        <LibraryCount count={estatisticas?.movies ?? 0} hours={estatisticas?.hours ?? 0} countries={estatisticas?.countries ?? 0} />

        <footer style={{ padding: '120px 72px 40px', background: 'var(--void)', borderTop: '1px solid rgba(237,232,220,0.05)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 64, borderBottom: '1px solid rgba(237,232,220,0.05)', paddingBottom: 64, marginBottom: 32, alignItems: 'end' }}>
            <div>
              <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 1, ease: FINE_ART_EASE }} style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(4rem, 8vw, 7rem)', color: 'var(--film)', margin: 0, lineHeight: 0.85, letterSpacing: '-0.02em' }}>
                Lumière.
              </motion.h2>
              <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 1, delay: 0.3, ease: FINE_ART_EASE }} style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.4rem', color: 'var(--m2)', fontStyle: 'italic', marginTop: 24, margin: '24px 0 0 0' }}>
                A preservação da memória através da luz e do tempo.
              </motion.p>
            </div>

            <div style={{ display: 'flex', gap: 80 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: 'var(--gold)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>[ Diretório ]</span>
                {['Arquivo Completo', 'Sessões Programadas', 'O Manifesto'].map((item) => (
                  <Link key={item} href="/library" style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'var(--m3)', letterSpacing: '0.1em', textTransform: 'uppercase', textDecoration: 'none', transition: 'color 0.3s' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--film)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--m3)'}>
                    {item}
                  </Link>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: 'var(--gold)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>[ Sistema ]</span>
                {['Acessar Terminal', 'Configurações', 'Diagnóstico'].map((item) => (
                  <Link key={item} href="#" style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'var(--m3)', letterSpacing: '0.1em', textTransform: 'uppercase', textDecoration: 'none', transition: 'color 0.3s' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--film)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--m3)'}>
                    {item}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#4A4844' }}>
            <span>© 2026 Lumière Personal Cinema</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>Desenvolvido por Edwin G. David <span style={{ color: 'var(--gold)' }}>//</span> Porto Alegre, RS</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <motion.span animate={{ opacity: [1, 0.2, 1] }} transition={{ repeat: Infinity, duration: 3, ease: "linear" }} style={{ width: 4, height: 4, backgroundColor: 'var(--gold)', borderRadius: '50%', display: 'inline-block' }} /> Status: Operacional
            </span>
          </div>
        </footer>
      </main>
    </div>
  )
}