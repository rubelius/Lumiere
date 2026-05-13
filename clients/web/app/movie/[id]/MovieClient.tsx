'use client'; 
import { useState } from "react"; 
import { motion, AnimatePresence } from "framer-motion"; 

import { Clock, Calendar, Globe, Award, Camera, Bookmark, Music, AlertCircle, User, StarHalf, MonitorPlay, FileText, Star, ChevronLeft, Play, X, Heart, Plus, CheckCircle2 } from "lucide-react"; 
import Link from "next/link"; 
import { useParams, useRouter } from "next/navigation"; 
import { MovieCard } from "@/components/ui/movie-card"; 

import { useMovie } from "@/features/movies/hooks/useMovies";

// ── NOSSOS MÓDULOS SEPARADOS (Isso é o que deixa este arquivo menor e mais limpo!) ──
import { MissingData } from "@/components/movie/MissingData";
import { TspdtHistoryChart } from "@/components/movie/TspdtHistoryChart";
import { MovieHero } from "@/components/movie/MovieHero";
import { MovieSidebar } from "@/components/movie/MovieSidebar";
import { FestivalLaurels } from "@/components/movie/FestivalLaurels";

const FINE_ART_EASE = [0.22, 1, 0.36, 1] as [number, number, number, number]; 

const staggerContainer = { 
  hidden: { opacity: 0 }, 
  visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } } 
}; 
const fadeUpItem = { 
  hidden: { y: 20, opacity: 0 }, 
  visible: { y: 0, opacity: 1, transition: { duration: 0.8, ease: FINE_ART_EASE } } 
}; 

export default function MovieClient() { 
  const router = useRouter(); 
  const params = useParams();
  const movieId = params?.id as string;

  const [activeTab, setActiveTab] = useState("overview"); 
  const [showFullSynopsis, setShowFullSynopsis] = useState(false); 

  const { data: movie, isLoading, error } = useMovie(movieId);

  if (isLoading) {
    return (
      <div style={{ background: '#080806', minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }} style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#BF8F3C', letterSpacing: '0.2em' }}>
          ACESSANDO REGISTROS DA OBRA...
        </motion.div>
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div style={{ background: '#080806', minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '24px' }}>
        <AlertCircle style={{ width: 48, height: 48, color: '#B05050' }} />
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#B05050', letterSpacing: '0.2em' }}>
          FALHA NA RECUPERAÇÃO DOS DADOS. DIRETÓRIO CORROMPIDO.
        </motion.div>
        <Link href="/library" style={{ color: '#8C8880', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', textDecoration: 'none', borderBottom: '1px solid #8C8880', paddingBottom: '2px' }}>
          [ RETORNAR AO ACERVO ]
        </Link>
      </div>
    );
  }

  const hours = Math.floor((movie.length_minutes || 0) / 60);
  const mins = (movie.length_minutes || 0) % 60;
  const runtime = movie.length_minutes ? `${hours}H ${mins}M` : "--H --M";
  
  const posterUrl = movie.poster_url || "/images/poster-1.png";
  const backgroundUrl = movie.background_url || posterUrl; 
  
  const cast = movie.cast?.map((c: any) => ({
    name: c.name, role: c.character, img: c.profile_url
  })) || [];
  
// ── LEITURA BLINDADA DA EQUIPE ──
  const getCrewData = (jobName: string) => {
    let crewArray = [];
    try {
      // Se o Django mandou como texto, a gente converte. Se mandou como Array, a gente usa direto.
      crewArray = typeof movie.crew === 'string' ? JSON.parse(movie.crew) : (movie.crew || []);
    } catch (e) {
      return null;
    }
    
    if (!Array.isArray(crewArray)) return null;
    return crewArray.find((c: any) => c.job === jobName || c.department === jobName);
  };
  
  const directorData = getCrewData("Director");
  const dopData = getCrewData("Director of Photography");
  const composerData = getCrewData("Original Music Composer");
  const writerData = getCrewData("Screenplay") || getCrewData("Writer");

  // Premiações puxadas pelo nosso ETL Mestre
  const festivals = (movie as any).festivals || []; 
  
  const technicalSpecs = [
    { label: "CLASSIFICAÇÃO (MPAA)", value: movie.mpaa_rating || "N/A" },
    { label: "COLORAÇÃO", value: movie.color || "N/A" },
    { label: "ASPECT RATIO", value: (movie as any).aspect_ratio || "N/A" },
    { label: "TESTE DE BECHDEL", value: (movie as any).bechdel_status || "N/A" },
    { label: "ORÇAMENTO", value: movie.budget ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(movie.budget) : "Confidencial" },
    { label: "BILHETERIA", value: movie.revenue ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(movie.revenue) : "Confidencial" },
  ];

  const releases = (movie as any).releases || [];
  const similarMovies = movie.similar_movies || [];
  const mediaCaptures = (movie as any).media_captures || [];

  const getYoutubeId = (url: string) => {
    if (!url) return null;
    const match = url.match(/[?&]v=([^&]+)/);
    return match ? match[1] : null;
  };
  const ytId = getYoutubeId(movie.trailer_url);

  const renderStars = (rating: any) => {
    const score = (Number(rating) / 2); 
    const fullStars = Math.floor(score);
    const hasHalf = score - fullStars >= 0.5;
    const stars = [];
    for(let i=0; i<5; i++) {
      if (i < fullStars) stars.push(<Star key={i} style={{ width: 12, height: 12, color: '#BF8F3C' }} fill="currentColor" />);
      else if (i === fullStars && hasHalf) stars.push(<StarHalf key={i} style={{ width: 12, height: 12, color: '#BF8F3C' }} fill="currentColor" />);
      else stars.push(<Star key={i} style={{ width: 12, height: 12, color: '#565450' }} />);
    }
    return <div style={{ display: 'flex', gap: '2px' }}>{stars}</div>;
  }

  return ( 
    <div style={{ background: '#080806', color: '#EDE8DC', minHeight: '100dvh', display: 'flex', overflowX: 'hidden', position: 'relative' }}> 
      
      <main style={{ flex: 1, minWidth: 0, position: 'relative' }}> 
        
        {/* COMPONENTE DO HERO */}
        <MovieHero ytId={ytId} backgroundUrl={backgroundUrl} />

        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '96px 72px 120px', position: 'relative', zIndex: 10 }}> 
           
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, ease: FINE_ART_EASE }} style={{ marginBottom: '64px' }}> 
            <Link href="/library" style={{ display: 'inline-flex', alignItems: 'center', gap: '16px', color: '#565450', textDecoration: 'none', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', transition: 'color 0.3s' }} onMouseEnter={e => e.currentTarget.style.color = '#EDE8DC'} onMouseLeave={e => e.currentTarget.style.color = '#565450'}> 
              <motion.div whileHover={{ x: -4 }} transition={{ type: 'spring', stiffness: 400 }}><ChevronLeft style={{ width: 16, height: 16 }} /></motion.div> 
              [ Retornar ao Acervo ] 
            </Link> 
          </motion.div> 

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '80px', alignItems: 'flex-start', marginBottom: '120px' }}> 
             
            {/* COMPONENTE DO SIDEBAR ESQUERDO (Ações) */}
            <MovieSidebar movie={movie} posterUrl={posterUrl} ytId={ytId} onPlayTrailer={() => {}} />

            {/* COLUNA DIREITA: INFORMAÇÕES E METADADOS */} 
            <div style={{ flex: 1, minWidth: '300px', maxWidth: '1000px', paddingTop: '16px' }}> 
               
              <motion.div variants={staggerContainer} initial="hidden" animate="visible"> 
                <motion.div variants={fadeUpItem} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px', marginBottom: '32px' }}> 
                  <motion.span whileHover={{ scale: 1.05, borderColor: '#EDE8DC', color: '#EDE8DC' }} whileTap={{ scale: 0.95 }} style={{ cursor: 'crosshair', transition: 'all 0.3s', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', padding: '6px 12px', border: '1px solid #BF8F3C', color: '#BF8F3C', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase' }}> 
                    <Bookmark style={{ width: 12, height: 12 }} /> {movie.collection_name || "ARQUIVO GERAL"} 
                  </motion.span> 
                  
                  {movie.current_ranking && (
                    <motion.div className="group/rank" style={{ position: 'relative' }}>
                      <motion.span whileHover={{ scale: 1.05, borderColor: '#EDE8DC', color: '#EDE8DC', backgroundColor: 'rgba(237,232,220,0.05)' }} whileTap={{ scale: 0.95 }} style={{ cursor: 'crosshair', transition: 'all 0.3s', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', padding: '6px 12px', border: '1px solid #565450', color: '#8C8880', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase' }}> 
                        <Award style={{ width: 12, height: 12 }} /> TSPDT RANKING #{movie.current_ranking} 
                      </motion.span> 
                    </motion.div>
                  )}
                </motion.div> 
                 
                {/* ── TÍTULO OU LOGO CINEMATOGRÁFICO ── */}
                {movie.logo_url ? (
                  <motion.div variants={fadeUpItem} style={{ marginBottom: '16px', maxHeight: '120px', maxWidth: '500px', display: 'flex', justifyContent: 'flex-start' }}>
                    <img src={movie.logo_url} alt={movie.title} style={{ objectFit: 'contain', maxHeight: '120px', width: 'auto', filter: 'drop-shadow(0 0 20px rgba(191,143,60,0.3)) brightness(1.2)' }} />
                  </motion.div>
                ) : (
                  <motion.h1 variants={fadeUpItem} style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(7rem, 14vw, 14rem)', fontWeight: 400, color: '#EDE8DC', marginBottom: '8px', lineHeight: 0.85, letterSpacing: '-0.02em', margin: '0 0 8px 0' }}> 
                    {movie.title} 
                  </motion.h1> 
                )}
                
                {movie.original_title && movie.original_title !== movie.title && (
                  <motion.h2 variants={fadeUpItem} style={{ fontFamily: "'DM Mono', monospace", fontSize: '14px', color: '#565450', letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: '32px' }}>
                    [ {movie.original_title} ]
                  </motion.h2>
                )}

                {/* ── PLATAFORMAS DE STREAMING ── */}
                {movie.streaming_providers && movie.streaming_providers.length > 0 && (
                  <motion.div variants={fadeUpItem} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', color: '#8C8880', letterSpacing: '0.15em', textTransform: 'uppercase' }}>ASSISTIR EM:</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {movie.streaming_providers.map((p: any, idx: number) => (
                        <a key={idx} href={`https://www.justwatch.com/br/busca?q=${encodeURIComponent(movie.title)}`} target="_blank" rel="noreferrer" title={`Buscar no JustWatch: ${p.name}`} style={{ width: 24, height: 24, borderRadius: '4px', overflow: 'hidden', border: '1px solid rgba(86,84,80,0.3)', transition: 'all 0.3s' }} className="hover:scale-110 hover:border-[#BF8F3C]">
                          <img src={p.logo} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </a>
                      ))}
                    </div>
                  </motion.div>
                )}
                
                {movie.tagline && (
                  <motion.h3 variants={fadeUpItem} style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', fontStyle: 'italic', fontWeight: 300, color: '#BF8F3C', marginBottom: '16px', margin: '0 0 16px 0' }}> 
                    "{movie.tagline}"
                  </motion.h3>
                )}

                {/* ── TÍTULOS ALTERNATIVOS ── */}
                {movie.alternative_titles && movie.alternative_titles.length > 0 && (
                  <motion.div variants={fadeUpItem} style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '16px', marginBottom: '32px' }} className="scrollbar-none">
                    {movie.alternative_titles.map((alt: any, i: number) => (
                       <span key={i} style={{ flexShrink: 0, fontFamily: "'DM Mono', monospace", fontSize: '8px', color: '#565450', border: '1px solid rgba(86,84,80,0.3)', padding: '2px 6px', letterSpacing: '0.1em' }}>
                         {alt.country}: {alt.title}
                       </span>
                    ))}
                  </motion.div>
                )}

                 
                {/* FICHA RESUMO + AVALIAÇÃO TMDB */}
                <motion.div variants={fadeUpItem} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '24px', color: '#8C8880', marginBottom: '48px', fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.2em' }}> 
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Calendar style={{ width: 12, height: 12 }} /> {movie.year || "----"}</span> 
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Clock style={{ width: 12, height: 12 }} /> {runtime}</span> 
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Globe style={{ width: 12, height: 12 }} /> {movie.country?.toUpperCase() || 'ORIGEM DESCONHECIDA'}</span> 
                  
                  {movie.tmdb_rating && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderLeft: '1px solid rgba(86,84,80,0.3)', paddingLeft: '24px' }}>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', color: '#565450', letterSpacing: '0.1em' }}>[ TMDB AVALIAÇÃO ]</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {renderStars(movie.tmdb_rating)}
                        <span style={{ color: '#EDE8DC' }}>
                          {Number(movie.tmdb_rating).toFixed(1)} <span style={{ color: '#565450' }}>/ 10</span>
                        </span>
                      </div>
                    </div>
                  )}
                </motion.div> 

                <motion.div variants={fadeUpItem} style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '64px' }}> 
                  {movie.genres?.length > 0 ? (
                    movie.genres.map((tag: string) => ( 
                      <motion.span whileHover={{ scale: 1.1, backgroundColor: '#BF8F3C' }} whileTap={{ scale: 0.95 }} key={tag} style={{ cursor: 'crosshair', transition: 'background-color 0.3s', fontFamily: "'DM Mono', monospace", fontSize: '9px', fontWeight: 'bold', letterSpacing: '0.2em', padding: '6px 12px', backgroundColor: '#EDE8DC', color: '#040402' }}> 
                        {tag} 
                      </motion.span> 
                    ))
                  ) : (
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#565450', letterSpacing: '0.15em' }}>[ GÊNEROS NÃO DEFINIDOS ]</span>
                  )}
                </motion.div> 

                <motion.div variants={fadeUpItem} style={{ marginBottom: '80px', maxWidth: '800px' }}> 
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#565450', letterSpacing: '0.2em', marginBottom: '16px' }}>// REGISTRO DE ENREDO</div> 
                  <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', lineHeight: 1.6, color: '#8C8880', margin: 0, display: '-webkit-box', WebkitLineClamp: showFullSynopsis ? 'none' : 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}> 
                    {movie.overview || "O registro descritivo desta obra encontra-se indisponível no banco de dados central no momento."} 
                  </p> 
                  {movie.overview && (
                    <motion.button whileHover={{ color: '#EDE8DC' }} whileTap={{ scale: 0.95 }} onClick={() => setShowFullSynopsis(!showFullSynopsis)} style={{ marginTop: '24px', backgroundColor: 'transparent', border: 'none', color: '#BF8F3C', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', cursor: 'pointer', transition: 'color 0.3s' }}> 
                      [ {showFullSynopsis ? 'OCULTAR DADOS' : 'EXPANDIR REGISTRO'} ] 
                    </motion.button> 
                  )}
                </motion.div> 
              </motion.div> 

              {/* BARRAS DE NAVEGAÇÃO INTERNA */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '48px', marginBottom: '64px', borderBottom: '1px solid rgba(86,84,80,0.3)' }}> 
                {[ { id: "overview", label: "01 EQUIPE & ELENCO" }, { id: "details", label: "02 AUDITORIA & METADADOS" }, { id: "media", label: "03 ARQUIVOS DE MÍDIA" } ].map(tab => ( 
                  <button 
                    key={tab.id} onClick={() => setActiveTab(tab.id)} 
                    style={{ paddingBottom: '16px', backgroundColor: 'transparent', border: 'none', fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.2em', cursor: 'pointer', transition: 'color 0.3s', position: 'relative', color: activeTab === tab.id ? '#BF8F3C' : '#565450' }} 
                    onMouseEnter={e => { if (activeTab !== tab.id) e.currentTarget.style.color = '#8C8880' }} 
                    onMouseLeave={e => { if (activeTab !== tab.id) e.currentTarget.style.color = '#565450' }} 
                  > 
                    {tab.label} 
                    {activeTab === tab.id && <motion.div layoutId="activeTabMovie" transition={{ duration: 0.3 }} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '2px', backgroundColor: '#BF8F3C', boxShadow: '0 0 8px rgba(191,143,60,0.6)' }} />} 
                  </button> 
                ))} 
              </div> 

              <AnimatePresence mode="wait"> 
                {/* ── CONTEÚDO: 01 EQUIPE E ELENCO ── */}
                {activeTab === "overview" && ( 
                  <motion.div key="overview" variants={staggerContainer} initial="hidden" animate="visible" exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} style={{ display: 'flex', flexDirection: 'column', gap: '96px' }}> 

                    
                     
                    {/* GRID DE EQUIPE TÉCNICA PRINCIPAL */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}> 
                      
                      {/* DIREÇÃO */}
                      <motion.div variants={fadeUpItem} whileHover={{ y: -4, backgroundColor: 'rgba(237,232,220,0.02)' }} style={{ display: 'flex', alignItems: 'center', gap: '24px', padding: '16px', borderRadius: '4px', transition: 'background-color 0.3s' }} className="group cursor-crosshair"> 
                        <div style={{ width: '96px', flexShrink: 0, aspectRatio: '3/4', backgroundColor: '#040402', border: '1px solid rgba(86,84,80,0.3)', padding: '4px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {directorData?.profile_url ? (
                            <img src={directorData.profile_url} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(100%) contrast(125%)', transition: 'all 0.5s' }} className="group-hover:grayscale-0 group-hover:scale-105" alt={movie.director} />
                          ) : (
                            <MonitorPlay style={{ width: 32, height: 32, color: '#565450' }} />
                          )}
                        </div>
                        <div> 
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#BF8F3C', letterSpacing: '0.2em', marginBottom: '8px' }}>// DIREÇÃO</div> 
                          <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.2rem', color: '#EDE8DC', margin: '0 0 4px 0', lineHeight: 1 }}>{movie.director || 'Desconhecido'}</h3> 
                        </div> 
                      </motion.div> 

                      {/* FOTOGRAFIA */}
                      {movie.cinematographer && (
                        <motion.div variants={fadeUpItem} whileHover={{ y: -4, backgroundColor: 'rgba(237,232,220,0.02)' }} style={{ display: 'flex', alignItems: 'center', gap: '24px', padding: '16px', borderRadius: '4px', transition: 'background-color 0.3s' }} className="group cursor-crosshair"> 
                          <div style={{ width: '96px', flexShrink: 0, aspectRatio: '3/4', backgroundColor: '#040402', border: '1px solid rgba(86,84,80,0.3)', padding: '4px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {dopData?.profile_url ? (
                              <img src={dopData.profile_url} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(100%) contrast(125%)', transition: 'all 0.5s' }} className="group-hover:grayscale-0 group-hover:scale-105" alt={movie.cinematographer} />
                            ) : (
                              <Camera style={{ width: 32, height: 32, color: '#565450' }} />
                            )}
                          </div>
                          <div> 
                            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#BF8F3C', letterSpacing: '0.2em', marginBottom: '8px' }}>// FOTOGRAFIA</div> 
                            <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.2rem', color: '#EDE8DC', margin: '0 0 4px 0', lineHeight: 1 }}>{movie.cinematographer}</h3> 
                          </div> 
                        </motion.div> 
                      )}

                      {/* ROTEIRO */}
                      {movie.writer && (
                        <motion.div variants={fadeUpItem} whileHover={{ y: -4, backgroundColor: 'rgba(237,232,220,0.02)' }} style={{ display: 'flex', alignItems: 'center', gap: '24px', padding: '16px', borderRadius: '4px', transition: 'background-color 0.3s' }} className="group cursor-crosshair"> 
                          <div style={{ width: '96px', flexShrink: 0, aspectRatio: '3/4', backgroundColor: '#040402', border: '1px solid rgba(86,84,80,0.3)', padding: '4px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {writerData?.profile_url ? (
                              <img src={writerData.profile_url} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(100%) contrast(125%)', transition: 'all 0.5s' }} className="group-hover:grayscale-0 group-hover:scale-105" alt={movie.writer} />
                            ) : (
                              <FileText style={{ width: 32, height: 32, color: '#565450' }} />
                            )}
                          </div>
                          <div> 
                            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#BF8F3C', letterSpacing: '0.2em', marginBottom: '8px' }}>// ROTEIRO</div> 
                            <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.2rem', color: '#EDE8DC', margin: '0 0 4px 0', lineHeight: 1 }}>{movie.writer}</h3> 
                          </div> 
                        </motion.div> 
                      )}

                      {/* TRILHA SONORA */}
                      {movie.composer && (
                        <motion.div variants={fadeUpItem} whileHover={{ y: -4, backgroundColor: 'rgba(237,232,220,0.02)' }} style={{ display: 'flex', alignItems: 'center', gap: '24px', padding: '16px', borderRadius: '4px', transition: 'background-color 0.3s' }} className="group cursor-crosshair"> 
                          <div style={{ width: '96px', flexShrink: 0, aspectRatio: '3/4', backgroundColor: '#040402', border: '1px solid rgba(86,84,80,0.3)', padding: '4px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {composerData?.profile_url ? (
                              <img src={composerData.profile_url} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(100%) contrast(125%)', transition: 'all 0.5s' }} className="group-hover:grayscale-0 group-hover:scale-105" alt={movie.composer} />
                            ) : (
                              <Music style={{ width: 32, height: 32, color: '#565450' }} />
                            )}
                          </div>
                          <div> 
                            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#BF8F3C', letterSpacing: '0.2em', marginBottom: '8px' }}>// TRILHA SONORA</div> 
                            <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.2rem', color: '#EDE8DC', margin: '0 0 4px 0', lineHeight: 1 }}>{movie.composer}</h3> 
                          </div> 
                        </motion.div> 
                      )}
                    </div>

                    <motion.div variants={fadeUpItem}> 
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#565450', letterSpacing: '0.2em', marginBottom: '32px' }}>// IDENTIFICAÇÃO DE ELENCO</div> 
                      {cast.length > 0 ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '32px 24px' }}> 
                          {cast.map((actor: any, i: number) => ( 
                            <motion.div key={i} whileHover={{ y: -4, scale: 1.02 }} whileTap={{ scale: 0.95 }} transition={{ type: 'spring', stiffness: 300 }} style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', textAlign: 'center' }} className="group cursor-crosshair"> 
                              <div style={{ width: '100%', aspectRatio: '3/4', backgroundColor: '#040402', border: '1px solid rgba(86,84,80,0.3)', padding: '4px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}> 
                                {actor.img ? (
                                  <img src={actor.img} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(100%) contrast(125%)', transition: 'all 0.5s' }} className="group-hover:grayscale-0 group-hover:scale-105" alt={actor.name} /> 
                                ) : (
                                  <User style={{ width: 24, height: 24, color: '#565450' }} />
                                )}
                              </div> 
                              <div> 
                                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.6rem', color: '#EDE8DC', lineHeight: 1, marginBottom: '6px' }} className="group-hover:text-[#BF8F3C] transition-colors">{actor.name}</div> 
                                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', color: '#8C8880', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{actor.role}</div> 
                              </div> 
                            </motion.div> 
                          ))} 
                        </div> 
                      ) : (
                        <MissingData label="ELENCO" />
                      )}
                    </motion.div> 
                  </motion.div> 
                )} 

                {/* ── CONTEÚDO: 02 AUDITORIA & METADADOS ── */}
                {activeTab === "details" && ( 
                  <motion.div key="details" variants={staggerContainer} initial="hidden" animate="visible" exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} style={{ display: 'flex', flexDirection: 'column', gap: '96px' }}> 
                     
                    <motion.div variants={fadeUpItem}>
                      <TspdtHistoryChart history={movie.tspdt_history} />
                    </motion.div>

                    <motion.div variants={fadeUpItem}> 
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#565450', letterSpacing: '0.2em', marginBottom: '32px' }}>// ESPECIFICAÇÕES TÉCNICAS E FINANCEIRAS</div> 
                      {technicalSpecs.length > 0 ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', rowGap: '48px', columnGap: '64px', borderTop: '1px solid rgba(86,84,80,0.3)', borderBottom: '1px solid rgba(86,84,80,0.3)', padding: '48px 0' }}> 
                          {technicalSpecs.map((spec: any, i: number) => ( 
                            <motion.div key={i} whileHover={{ x: 4 }} className="group cursor-crosshair"> 
                              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', color: '#BF8F3C', letterSpacing: '0.2em', marginBottom: '8px', textTransform: 'uppercase', transition: 'color 0.3s' }} className="group-hover:text-[#EDE8DC]">{spec.label}</p> 
                              <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.5rem', color: '#EDE8DC', margin: 0 }}>{spec.value}</p> 
                            </motion.div> 
                          ))} 
                        </div> 
                      ) : (
                        <MissingData label="ESPECIFICAÇÕES (ASPECT RATIO, LENTES, ETC)" />
                      )}
                    </motion.div> 
                  </motion.div> 
                )} 

                {/* ── CONTEÚDO: 03 ARQUIVOS DE MÍDIA ── */}
                {activeTab === "media" && ( 
                  <motion.div key="media" variants={staggerContainer} initial="hidden" animate="visible" exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} style={{ display: 'flex', flexDirection: 'column', gap: '96px' }}> 
                     
                    <motion.div variants={fadeUpItem}> 
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '32px', borderBottom: '1px solid rgba(86,84,80,0.3)', paddingBottom: '16px' }}> 
                        <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '3rem', color: '#EDE8DC', margin: 0 }}>Arquivos Disponíveis (Prowlarr)</h3> 
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#BF8F3C', letterSpacing: '0.2em' }}>{String(releases.length).padStart(2, '0')} CÓPIAS LOCALIZADAS</span> 
                      </div> 
                       
                      {releases.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid rgba(86,84,80,0.3)', backgroundColor: '#040402', overflowX: 'auto' }}> 
                          {releases.map((release: any, i: number) => ( 
                            <motion.div key={i} whileHover={{ x: 8, backgroundColor: 'rgba(191,143,60,0.05)' }} whileTap={{ scale: 0.98 }} style={{ display: 'grid', gridTemplateColumns: '60px minmax(200px, 1fr) 1fr 100px 60px', alignItems: 'center', padding: '16px', borderBottom: i !== releases.length -1 ? '1px solid rgba(86,84,80,0.3)' : 'none', cursor: 'pointer' }} className="group"> 
                              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '14px', color: '#BF8F3C', textAlign: 'center', transition: 'transform 0.3s' }} className="group-hover:scale-110">{release.score || '--'}</div> 
                              <div> 
                                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', color: '#EDE8DC', marginBottom: '8px', transition: 'color 0.3s' }} className="group-hover:text-[#BF8F3C]">{release.group || 'N/A'}</div> 
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}> 
                                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', letterSpacing: '0.1em', color: '#8C8880', border: '1px solid rgba(86,84,80,0.5)', padding: '2px 4px' }}>{release.res || 'N/A'}</span> 
                                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', letterSpacing: '0.1em', color: '#040402', backgroundColor: '#EDE8DC', padding: '2px 4px' }}>{release.type || 'N/A'}</span> 
                                </div> 
                              </div> 
                              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#8C8880', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{release.audio || 'N/A'}</div> 
                              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#EDE8DC', letterSpacing: '0.1em', textAlign: 'right', paddingRight: '16px', borderRight: '1px solid rgba(86,84,80,0.3)' }}>{release.size || '-- GB'}</div> 
                              <div style={{ display: 'flex', justifyContent: 'center' }}> 
                                <motion.div whileHover={{ scale: 1.2, color: '#EDE8DC' }}><Play style={{ width: 16, height: 16, color: '#565450', transition: 'color 0.3s' }} className="group-hover:text-[#BF8F3C]" /></motion.div> 
                              </div> 
                            </motion.div> 
                          ))} 
                        </div> 
                      ) : (
                        <MissingData label="ARQUIVOS (RELEASES TORRENT)" />
                      )}
                    </motion.div> 

                    <motion.div variants={fadeUpItem}> 
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#565450', letterSpacing: '0.2em', marginBottom: '32px' }}>// CAPTURAS ÓPTICAS</div> 
                      {mediaCaptures.length > 0 ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}> 
                          {mediaCaptures.map((img: string, i: number) => ( 
                            <motion.div key={i} whileHover={{ scale: 1.02, zIndex: 10, boxShadow: '0 10px 40px rgba(0,0,0,0.8)' }} whileTap={{ scale: 0.95 }} style={{ backgroundColor: '#040402', border: '1px solid rgba(86,84,80,0.3)', padding: '4px', cursor: 'crosshair', position: 'relative' }} className={`group ${i === 0 ? 'col-span-2 row-span-2' : ''}`}> 
                              <div style={{ aspectRatio: i === 0 ? '16/9' : '3/2', width: '100%', overflow: 'hidden' }}> 
                                <img src={img} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(100%) contrast(125%)', transition: 'all 0.7s' }} className="group-hover:grayscale-0" alt="" /> 
                              </div> 
                            </motion.div> 
                          ))} 
                        </div> 
                      ) : (
                        <MissingData label="GALERIA DE IMAGENS" />
                      )}
                    </motion.div> 

                  </motion.div> 
                )} 
              </AnimatePresence> 
            </div> 
          </div> 

          {/* ── OBRAS CORRELATAS IDENTIFICADAS ── */}
          <motion.section initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-10%" }} transition={{ duration: 0.8, ease: FINE_ART_EASE }} style={{ paddingTop: '96px', borderTop: '1px solid rgba(86,84,80,0.3)' }}> 
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#565450', letterSpacing: '0.2em', marginBottom: '48px' }}>// OBRAS CORRELATAS IDENTIFICADAS</div> 
             
            {similarMovies.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '32px' }}> 
                {similarMovies.map((similar: any, i: number) => ( 
                  <motion.div key={similar.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} transition={{ delay: i * 0.1, duration: 0.6, ease: FINE_ART_EASE }}> 
                    <MovieCard id={similar.id} title={similar.title} year={similar.year} imageUrl={similar.img} qualities={similar.qualities} index={i} /> 
                  </motion.div> 
                ))} 
              </div> 
            ) : (
              <MissingData label="ALGORITMO DE RECOMENDAÇÃO" />
            )}
          </motion.section> 

        </div> 
      </main> 
    </div> 
  ); 
}