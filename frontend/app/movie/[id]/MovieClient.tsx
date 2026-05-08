'use client'; 
import { useState } from "react"; 
import { motion, AnimatePresence } from "framer-motion"; 

import { Play, CheckCircle2, ChevronLeft, Star, Clock, Calendar, Globe,
Plus, Heart, Award, Camera, Bookmark, Layers, X, Settings2, Subtitles, 
Maximize, Volume2, SkipBack, SkipForward, Pause, Music, AlertCircle, TrendingUp, User, StarHalf } from 
"lucide-react"; 
import Link from "next/link"; 
import { useRouter, useParams } from "next/navigation"; 
import { MovieCard } from "@/components/ui/movie-card"; 

import { useMovie } from "@/features/movies/hooks/useMovies";

const FINE_ART_EASE = [0.22, 1, 0.36, 1] as [number, number, number, number]; 

const staggerContainer = { 
  hidden: { opacity: 0 }, 
  visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } } 
}; 

const fadeUpItem = { 
  hidden: { y: 20, opacity: 0 }, 
  visible: { y: 0, opacity: 1, transition: { duration: 0.8, ease: FINE_ART_EASE } } 
}; 

const MissingData = ({ label }: { label: string }) => (
  <motion.div 
    initial={{ opacity: 0, scale: 0.98 }}
    animate={{ opacity: 1, scale: 1 }}
    whileHover={{ backgroundColor: 'rgba(191,143,60,0.05)', borderColor: 'rgba(191,143,60,0.5)' }}
    style={{ 
      width: '100%', padding: '32px', border: '1px dashed rgba(86,84,80,0.4)', 
      backgroundColor: 'rgba(4,4,2,0.3)', display: 'flex', flexDirection: 'column', 
      alignItems: 'center', justifyContent: 'center', gap: '12px', transition: 'all 0.3s'
    }}
  >
    <AlertCircle style={{ width: 24, height: 24, color: '#8C8880' }} />
    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#8C8880', letterSpacing: '0.2em', textTransform: 'uppercase', textAlign: 'center' }}>
      [ REGISTRO INCOMPLETO: "{label}" NÃO LOCALIZADO NO BANCO DE DADOS ]
    </span>
  </motion.div>
);

// --- COMPONENTE: GAUSSIANA DE RELEVÂNCIA ARTÍSTICA ---
const TspdtHistoryChart = ({ history }: { history: any }) => {
  let parsedHistory: any = {};
  
  try {
    if (typeof history === 'string') {
      parsedHistory = JSON.parse(history);
    } else if (typeof history === 'object' && history !== null) {
      parsedHistory = history;
    }
  } catch (error) {
    parsedHistory = {};
  }

  const rawEntries = Object.entries(parsedHistory)
    .map(([year, rank]) => ({ year: Number(year), rank: Number(rank) }))
    .filter(e => !isNaN(e.year) && !isNaN(e.rank) && e.rank > 0)
    .sort((a, b) => a.year - b.year);

  if (rawEntries.length === 0) {
    return <MissingData label="HISTÓRICO DE RELEVÂNCIA (TSPDT)" />;
  }

  const minYear = rawEntries[0].year;
  const maxYear = rawEntries[rawEntries.length - 1].year;
  
  const numLabels = 7;
  const yearLabels = [];
  if (minYear === maxYear) {
     yearLabels.push({ year: minYear, x: '50%' });
  } else {
    for (let i=0; i<numLabels; i++) {
        const year = Math.round(minYear + (maxYear - minYear) * (i / (numLabels - 1)));
        const percentage = (i / (numLabels - 1)) * 100;
        yearLabels.push({ year, x: `${percentage}%` });
    }
  }

  if (rawEntries.length === 1) {
    return (
      <div style={{ border: '1px solid rgba(86,84,80,0.3)', backgroundColor: '#040402', padding: '48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#8C8880', letterSpacing: '0.2em' }}>REGISTRO ÚNICO TSPDT:</span>
        <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', color: '#BF8F3C' }}>#{rawEntries[0].rank} ({rawEntries[0].year})</span>
      </div>
    );
  }

  const W = 1000;
  const H = 200;
  
  const maxRankData = Math.max(...rawEntries.map(e => e.rank));
  const bestRankData = Math.min(...rawEntries.map(e => e.rank));

  const mapPoint = (entry: {year: number, rank: number}) => {
    const x = ((entry.year - minYear) / (maxYear - minYear)) * W;
    const rankRatio = maxRankData === bestRankData ? 0.5 : (entry.rank - bestRankData) / (maxRankData - bestRankData);
    const y = 30 + rankRatio * (180 - 30); 
    return { x, y };
  }

  const mappedPoints = rawEntries.map(mapPoint);

  const line = (p1: {x:number, y:number}, p2:{x:number, y:number}) => {
    const lengthX = p2.x - p1.x;
    const lengthY = p2.y - p1.y;
    return {
      length: Math.sqrt(Math.pow(lengthX, 2) + Math.pow(lengthY, 2)),
      angle: Math.atan2(lengthY, lengthX)
    }
  }
  const controlPoint = (p1: {x:number, y:number}, p0:{x:number, y:number}, p2:{x:number, y:number}, reverse = false) => {
    const smoothing = 0.2; 
    const opp = line(p0 || p1, p2 || p1);
    const angle = opp.angle + (reverse ? Math.PI : 0);
    const length = opp.length * smoothing;
    const x = p1.x + Math.cos(angle) * length;
    const y = p1.y + Math.sin(angle) * length;
    return {x, y};
  }

  // A MÁGICA ESTÁ AQUI: Separação dos Paths
  
  // 1. Path APENAS da linha (Não desce pro chão)
  let dStroke = `M ${mappedPoints[0].x},${mappedPoints[0].y}`;
  let curves = "";
  
  for (let i = 1; i < mappedPoints.length; i++) {
    const p1 = mappedPoints[i-1];
    const p2 = mappedPoints[i];
    const cp1 = controlPoint(p1, mappedPoints[i-2], p2);
    const cp2 = controlPoint(p2, p1, mappedPoints[i+1], true);
    curves += ` C ${cp1.x},${cp1.y} ${cp2.x},${cp2.y} ${p2.x},${p2.y}`;
  }
  dStroke += curves;
  
  // 2. Path do preenchimento do gradiente (Esse sim desce e fecha a forma geométrica)
  let dFill = `M ${mappedPoints[0].x},${H}`; 
  dFill += ` L ${mappedPoints[0].x},${mappedPoints[0].y}`; 
  dFill += curves;
  dFill += ` L ${mappedPoints[mappedPoints.length - 1].x},${H}`; 
  dFill += ` Z`; 

  return (
    <div style={{ border: '1px solid rgba(86,84,80,0.3)', backgroundColor: '#040402', padding: '32px 48px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px', position: 'relative', zIndex: 10 }}>
        <div>
          <h4 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', color: '#EDE8DC', margin: '0 0 8px 0' }}>Evolução de Relevância Artística</h4>
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#8C8880', letterSpacing: '0.1em', margin: 0, textTransform: 'uppercase' }}>Histórico Dinâmico Theyshootpictures.com</p>
        </div>
        <TrendingUp style={{ width: 24, height: 24, color: '#BF8F3C' }} />
      </div>
      
      <div style={{ position: 'relative', height: 180, width: '100%', borderBottom: '1px solid rgba(237,232,220,0.2)', marginBottom: '40px' }}>
        <svg viewBox="0 0 1000 200" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
          <defs>
              <linearGradient id="gaussian-gradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="rgba(191,143,60,0.2)" />
                <stop offset="100%" stopColor="rgba(191,143,60,0)" />
              </linearGradient>
              <filter id="gaussian-glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                  <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                  </feMerge>
              </filter>
          </defs>
          
          <motion.path 
              initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ duration: 2, ease: FINE_ART_EASE }}
              d={dFill}
              fill="url(#gaussian-gradient)"
          />
          
          <motion.path 
              initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 2, ease: FINE_ART_EASE }}
              d={dStroke}
              fill="none" stroke="#BF8F3C" strokeWidth="4" strokeLinecap="round" 
              style={{ filter: 'drop-shadow(0 0 8px rgba(191,143,60,0.6))', ...({filter: 'url(#gaussian-glow)'} as any) }}
          />
        </svg>

        <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 0 }}>
          {yearLabels.map((pt) => (
            <motion.div key={pt.year} whileHover="hover" initial="rest" animate="rest" style={{ position: 'absolute', left: pt.x, bottom: -24, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'crosshair', transform: 'translateX(-50%)' }}>
              <motion.span 
                variants={{ rest: { color: '#8C8880', scale: 1 }, hover: { color: '#BF8F3C', scale: 1.3 } }}
                transition={{ duration: 0.2 }}
                style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.1em' }}
              >
                {pt.year}
              </motion.span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};
// ----------------------------------------

export default function MovieClient() { 
  const router = useRouter(); 
  const params = useParams();
  const movieId = params?.id as string;

  const [activeTab, setActiveTab] = useState("overview"); 
  const [isTrailerOpen, setIsTrailerOpen] = useState(false); 
  const [isCollectionOpen, setIsCollectionOpen] = useState(false); 
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
  
  const festivals = movie.festivals || [];
  const reviews = movie.reviews || [];
  
  const technicalSpecs = [
    { label: "CLASSIFICAÇÃO", value: movie.mpaa_rating || "N/A" },
    { label: "ORÇAMENTO", value: movie.budget ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(movie.budget) : "Confidencial" },
    { label: "BILHETERIA", value: movie.revenue ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(movie.revenue) : "Confidencial" },
  ];

  const releases = movie.releases || [];
  const similarMovies = movie.similar_movies || [];
  const soundtrack = movie.soundtrack || [];
  const mediaCaptures = movie.media_captures || [];

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
      
      <AnimatePresence> 
        {isTrailerOpen && ( 
          <motion.div  
            key="trailer-modal" 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} 
            style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px' }} 
          > 
            <div  
              onClick={() => setIsTrailerOpen(false)} 
              style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(4,4,2,0.95)', backdropFilter: 'blur(20px)', cursor: 'pointer', zIndex: 0 }}  
            /> 
             
            <motion.div  
              initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} transition={{ duration: 0.4, ease: FINE_ART_EASE }} 
              onClick={(e) => e.stopPropagation()} 
              className="group/player" 
              style={{ position: 'relative', width: '100%', maxWidth: '1200px', aspectRatio: '16/9', backgroundColor: '#040402', border: '1px solid #BF8F3C', boxShadow: '0 0 100px rgba(0,0,0,1)', zIndex: 1, overflow: 'hidden' }} 
            > 
              <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}> 
                {ytId ? (
                  <iframe 
                    src={`https://www.youtube.com/embed/${ytId}?autoplay=1&controls=0&modestbranding=1&rel=0`}
                    allow="autoplay; encrypted-media"
                    style={{ width: '100%', height: '100%', border: 'none', pointerEvents: 'none' }}
                  />
                ) : (
                  <img src={backgroundUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(100%) contrast(125%)', opacity: 0.6 }} alt="Video Poster" /> 
                )}
              </div> 
               
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 10, background: 'linear-gradient(to bottom, rgba(4,4,2,0.9), transparent)', opacity: 0, transition: 'opacity 0.3s' }} className="group-hover/player:opacity-100"> 
                <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}> 
                  <motion.div animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 1.5, repeat: Infinity }} style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#BF8F3C', letterSpacing: '0.2em', marginBottom: '8px' }}>[ SINAL DE VÍDEO ATIVO ]</motion.div> 
                  <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', color: '#EDE8DC', margin: 0 }}>{movie.title} - {ytId ? 'Reproduzindo' : 'Trailer Ausente'}</h3> 
                </motion.div> 
                <motion.button  
                  onClick={() => setIsTrailerOpen(false)}  
                  whileHover={{ scale: 1.1, backgroundColor: 'rgba(191,143,60,0.1)', borderColor: '#BF8F3C', color: '#BF8F3C' }} whileTap={{ scale: 0.9 }} 
                  style={{ background: 'transparent', border: '1px solid #565450', padding: '12px', color: '#565450', cursor: 'pointer', transition: 'all 0.3s' }} 
                > 
                  <X style={{ width: 20, height: 20 }} /> 
                </motion.button> 
              </div> 
            </motion.div> 
          </motion.div> 
        )} 
      </AnimatePresence> 

      <main style={{ flex: 1, minWidth: 0, position: 'relative' }}> 
         
        {/* HERO FADE */} 
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '85vh', zIndex: 0, overflow: 'hidden' }}> 
          <motion.img  
            initial={{ scale: 1.1, opacity: 0 }}  
            animate={{ scale: 1.05, opacity: 0.25 }}  
            transition={{ scale: { duration: 20, ease: "linear", repeat: Infinity, repeatType: "reverse" }, opacity: { duration: 1.5, ease: FINE_ART_EASE } }} 
            src={backgroundUrl}  
            style={{ width: '100%', height: '100%', objectFit: 'cover', mixBlendMode: 'luminosity', filter: 'grayscale(100%) contrast(125%)' }} alt=""  
          /> 
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #080806, rgba(8,8,6,0.8), transparent)' }} /> 
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, #080806, rgba(8,8,6,0.5), transparent)' }} /> 
        </div> 

        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '96px 72px 120px', position: 'relative', zIndex: 10 }}> 
           
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, ease: FINE_ART_EASE }} style={{ marginBottom: '64px' }}> 
            <Link href="/library" style={{ display: 'inline-flex', alignItems: 'center', gap: '16px', color: '#565450', textDecoration: 'none', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', transition: 'color 0.3s' }} onMouseEnter={e => e.currentTarget.style.color = '#EDE8DC'} onMouseLeave={e => e.currentTarget.style.color = '#565450'}> 
              <motion.div whileHover={{ x: -4 }} transition={{ type: 'spring', stiffness: 400 }}><ChevronLeft style={{ width: 16, height: 16 }} /></motion.div> 
              [ Retornar ao Acervo ] 
            </Link> 
          </motion.div> 

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '80px', alignItems: 'flex-start', marginBottom: '120px' }}> 
             
            {/* COLUNA ESQUERDA: PÔSTER E AÇÕES */} 
            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1, ease: FINE_ART_EASE }} style={{ width: '320px', flexShrink: 0 }}> 
               
              <motion.div whileHover={{ y: -5, boxShadow: '0 20px 60px rgba(0,0,0,1)' }} transition={{ duration: 0.4, ease: FINE_ART_EASE }} style={{ position: 'relative', aspectRatio: '2/3', backgroundColor: '#040402', border: '1px solid rgba(191,143,60,0.3)', padding: '8px', marginBottom: '32px', overflow: 'hidden', boxShadow: '0 0 50px rgba(0,0,0,0.8)' }} className="group"> 
                <div style={{ position: 'relative', width: '100%', height: '100%', border: '1px solid rgba(86,84,80,0.3)', overflow: 'hidden' }}> 
                  <img src={posterUrl} alt="Poster" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'contrast(110%) saturate(110%)', transition: 'all 0.7s' }} className="group-hover:scale-105" /> 
                  <motion.div animate={{ y: ['-10%', '110%'] }} transition={{ repeat: Infinity, duration: 4, ease: 'linear' }} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '1px', backgroundColor: '#BF8F3C', boxShadow: '0 0 10px rgba(191,143,60,0.8)', opacity: 0 }} className="group-hover:opacity-100" /> 
                </div> 
                
                {ytId && (
                  <motion.button  
                    onClick={() => setIsTrailerOpen(true)} 
                    whileTap={{ scale: 0.9 }}
                    style={{ position: 'absolute', inset: 0, margin: 'auto', width: '80px', height: '80px', backgroundColor: 'rgba(4,4,2,0.8)', border: '1px solid #BF8F3C', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#BF8F3C', cursor: 'pointer', transition: 'all 0.4s', opacity: 0, backdropFilter: 'blur(8px)' }} 
                    className="group-hover:opacity-100 hover:bg-[#BF8F3C] hover:text-[#040402] hover:scale-110" 
                  > 
                    <Play style={{ width: 32, height: 32, marginLeft: '4px' }} fill="currentColor" /> 
                  </motion.button> 
                )}
              </motion.div> 
               
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}> 
                <motion.button  
                  onClick={() => router.push('/player')} 
                  whileHover={{ backgroundColor: '#BF8F3C', color: '#040402', scale: 1.02, boxShadow: '0 0 20px rgba(191,143,60,0.4)' }} whileTap={{ scale: 0.98 }}  
                  style={{ width: '100%', padding: '16px 0', backgroundColor: 'transparent', border: '1px solid #BF8F3C', color: '#BF8F3C', fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.2em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', cursor: 'pointer', transition: 'all 0.3s', position: 'relative' }} 
                > 
                  <motion.div animate={{ opacity: [0, 0.5, 0], scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 2 }} style={{ position: 'absolute', inset: 0, border: '1px solid #BF8F3C', pointerEvents: 'none' }} />
                  <Play style={{ width: 16, height: 16 }} /> [ INICIAR PROJEÇÃO ] 
                </motion.button> 
                 
                <div style={{ position: 'relative' }}> 
                  <motion.button  
                    onClick={() => setIsCollectionOpen(!isCollectionOpen)} 
                    whileHover={{ backgroundColor: 'rgba(237,232,220,0.05)', borderColor: '#EDE8DC', color: '#EDE8DC', scale: 1.02 }} whileTap={{ scale: 0.98 }} 
                    style={{ width: '100%', padding: '16px 0', backgroundColor: '#040402', border: '1px solid #565450', color: '#8C8880', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', cursor: 'pointer', transition: 'all 0.3s' }} 
                  > 
                    <Bookmark style={{ width: 16, height: 16 }} /> [ CATALOGAR ] 
                  </motion.button> 
                  <AnimatePresence> 
                    {isCollectionOpen && ( 
                      <motion.div  
                        initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }} transition={{ duration: 0.2 }} 
                        style={{ position: 'absolute', top: '100%', left: 0, width: '100%', marginTop: '8px', backgroundColor: '#040402', border: '1px solid rgba(191,143,60,0.5)', padding: '8px', zIndex: 50, boxShadow: '0 10px 40px rgba(0,0,0,0.8)' }} 
                      > 
                        <motion.button whileHover={{ x: 4, backgroundColor: 'rgba(191,143,60,0.1)' }} whileTap={{ scale: 0.98 }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', backgroundColor: 'transparent', border: 'none', color: '#EDE8DC', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', cursor: 'pointer', textAlign: 'left', transition: 'background-color 0.2s' }}> 
                          <Heart style={{ width: 12, height: 12, color: '#BF8F3C' }} /> FAVORITOS 
                        </motion.button> 
                        <motion.button whileHover={{ x: 4, backgroundColor: 'rgba(191,143,60,0.1)' }} whileTap={{ scale: 0.98 }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', backgroundColor: 'transparent', border: 'none', color: '#EDE8DC', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', cursor: 'pointer', textAlign: 'left', transition: 'background-color 0.2s' }}> 
                          <Clock style={{ width: 12, height: 12, color: '#8C8880' }} /> ASSISTIR DEPOIS 
                        </motion.button> 
                        <div style={{ height: '1px', backgroundColor: 'rgba(86,84,80,0.3)', margin: '8px 0' }} /> 
                        <motion.button whileHover={{ x: 4, color: '#EDE8DC', backgroundColor: 'rgba(237,232,220,0.05)' }} whileTap={{ scale: 0.98 }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', backgroundColor: 'transparent', border: 'none', color: '#565450', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}> 
                          <Plus style={{ width: 12, height: 12 }} /> NOVO DIRETÓRIO 
                        </motion.button> 
                      </motion.div> 
                    )} 
                  </AnimatePresence> 
                </div> 
              </div> 

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} style={{ marginTop: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontFamily: "'DM Mono', monospace", fontSize: '9px', color: movie.in_plex ? '#BF8F3C' : '#565450', letterSpacing: '0.15em', border: `1px solid ${movie.in_plex ? 'rgba(191,143,60,0.2)' : 'rgba(86,84,80,0.2)'}`, backgroundColor: movie.in_plex ? 'rgba(191,143,60,0.05)' : 'transparent', padding: '12px' }}> 
                <CheckCircle2 style={{ width: 12, height: 12 }} /> {movie.in_plex ? 'DISPONÍVEL NO PLEX' : 'NÃO SINCRONIZADO NO PLEX'}
              </motion.div> 
            </motion.div> 

            {/* COLUNA DIREITA: INFORMAÇÕES E METADADOS */} 
            <div style={{ flex: 1, minWidth: '300px', maxWidth: '1000px', paddingTop: '16px' }}> 
               
              <motion.div variants={staggerContainer} initial="hidden" animate="visible"> 
                <motion.div variants={fadeUpItem} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px', marginBottom: '24px' }}> 
                  <motion.span whileHover={{ scale: 1.05, borderColor: '#EDE8DC', color: '#EDE8DC' }} whileTap={{ scale: 0.95 }} style={{ cursor: 'crosshair', transition: 'all 0.3s', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', padding: '6px 12px', border: '1px solid #BF8F3C', color: '#BF8F3C', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase' }}> 
                    <Bookmark style={{ width: 12, height: 12 }} /> {movie.collection_name || "ARQUIVO GERAL"} 
                  </motion.span> 
                  
                  {movie.current_ranking && (
                    <motion.div className="group/rank" style={{ position: 'relative' }}>
                      <motion.span whileHover={{ scale: 1.05, borderColor: '#EDE8DC', color: '#EDE8DC', backgroundColor: 'rgba(237,232,220,0.05)' }} whileTap={{ scale: 0.95 }} style={{ cursor: 'crosshair', transition: 'all 0.3s', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', padding: '6px 12px', border: '1px solid #565450', color: '#8C8880', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase' }}> 
                        <Award style={{ width: 12, height: 12 }} /> TSPDT RANKING #{movie.current_ranking} 
                      </motion.span> 
                      <div className="group-hover/rank:opacity-100 opacity-0 transition-opacity" style={{ position: 'absolute', top: '-30px', left: '0', width: '200px', fontFamily: "'DM Mono', monospace", fontSize: '8px', color: '#BF8F3C', letterSpacing: '0.1em' }}>
                        *They Shoot Pictures, Don't They?
                      </div>
                    </motion.div>
                  )}
                </motion.div> 
                 
                {/* TÍTULOS E TAGLINE */}
                <motion.h1 variants={fadeUpItem} style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(4rem, 8vw, 8rem)', fontWeight: 400, color: '#EDE8DC', marginBottom: '8px', lineHeight: 0.9, letterSpacing: '-0.02em', margin: '0 0 8px 0' }}> 
                  {movie.title} 
                </motion.h1> 
                {movie.original_title && movie.original_title !== movie.title && (
                  <motion.h2 variants={fadeUpItem} style={{ fontFamily: "'DM Mono', monospace", fontSize: '14px', color: '#565450', letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: '32px' }}>
                    [ {movie.original_title} ]
                  </motion.h2>
                )}
                
                {movie.tagline && (
                  <motion.h3 variants={fadeUpItem} style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', fontStyle: 'italic', fontWeight: 300, color: '#BF8F3C', marginBottom: '32px', margin: '0 0 32px 0' }}> 
                    "{movie.tagline}"
                  </motion.h3>
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
                {[ { id: "overview", label: "01 VISÃO GERAL" }, { id: "details", label: "02 AUDITORIA & METADADOS" }, { id: "media", label: "03 ARQUIVOS DE MÍDIA" } ].map(tab => ( 
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
                {/* ── CONTEÚDO: 01 VISÃO GERAL ── */}
                {activeTab === "overview" && ( 
                  <motion.div key="overview" variants={staggerContainer} initial="hidden" animate="visible" exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} style={{ display: 'flex', flexDirection: 'column', gap: '96px' }}> 
                     
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '48px' }}> 
                      <motion.div variants={fadeUpItem} whileHover={{ y: -4, backgroundColor: 'rgba(237,232,220,0.02)' }} style={{ display: 'flex', alignItems: 'flex-start', gap: '24px', padding: '16px', borderRadius: '4px', transition: 'background-color 0.3s' }} className="group cursor-crosshair"> 
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', border: '1px solid rgba(86,84,80,0.3)', transition: 'border-color 0.3s' }} className="group-hover:border-[#BF8F3C]">
                          <Camera style={{ width: 32, height: 32, color: '#565450' }} className="group-hover:text-[#BF8F3C] transition-colors" />
                        </div>
                        <div> 
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#BF8F3C', letterSpacing: '0.2em', marginBottom: '8px', transition: 'color 0.3s' }} className="group-hover:text-[#EDE8DC]">// DIREÇÃO</div> 
                          <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.5rem', color: '#EDE8DC', margin: '0 0 12px 0' }}>{movie.director || 'NÃO REGISTRADO'}</h3> 
                        </div> 
                      </motion.div> 
                    </div> 

                    <motion.div variants={fadeUpItem}> 
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#565450', letterSpacing: '0.2em', marginBottom: '32px' }}>// IDENTIFICAÇÃO DE ELENCO</div> 
                      {cast.length > 0 ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '24px' }}> 
                          {cast.map((actor: any, i: number) => ( 
                            <motion.div key={i} whileHover={{ y: -4, scale: 1.02 }} whileTap={{ scale: 0.95 }} transition={{ type: 'spring', stiffness: 300 }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} className="group cursor-crosshair"> 
                              <div style={{ width: '100%', aspectRatio: '3/4', backgroundColor: '#040402', border: '1px solid rgba(86,84,80,0.3)', padding: '4px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}> 
                                {actor.img ? (
                                  <img src={actor.img} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(100%) contrast(125%)', transition: 'all 0.5s' }} className="group-hover:grayscale-0 group-hover:scale-105" alt={actor.name} /> 
                                ) : (
                                  <User style={{ width: 32, height: 32, color: '#565450' }} />
                                )}
                              </div> 
                              <div> 
                                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.6rem', color: '#EDE8DC', lineHeight: 1, marginBottom: '8px' }} className="group-hover:text-[#BF8F3C] transition-colors">{actor.name}</div> 
                                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', color: '#8C8880', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{actor.role}</div> 
                              </div> 
                            </motion.div> 
                          ))} 
                        </div> 
                      ) : (
                        <MissingData label="ELENCO" />
                      )}
                    </motion.div> 

                    <motion.div variants={fadeUpItem}> 
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '32px', borderBottom: '1px solid rgba(86,84,80,0.3)', paddingBottom: '16px' }}> 
                        <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '3rem', color: '#EDE8DC', margin: 0 }}>Arquivos Disponíveis</h3> 
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
                        <MissingData label="ARQUIVOS (RELEASES)" />
                      )}
                    </motion.div> 

                    {movie.suggested_sync ? (
                      <motion.div variants={fadeUpItem} style={{ border: '1px solid rgba(191,143,60,0.3)', background: 'linear-gradient(to bottom right, #040402, #080806)', padding: '48px', position: 'relative', overflow: 'hidden' }}> 
                        <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }} transition={{ duration: 8, repeat: Infinity, ease: 'linear' }} style={{ position: 'absolute', top: 0, right: 0, width: '400px', height: '400px', backgroundColor: 'rgba(191,143,60,0.05)', borderRadius: '50%', filter: 'blur(100px)', pointerEvents: 'none', transform: 'translate(50%, -50%)' }} /> 
                        
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px', marginBottom: '48px' }}> 
                          <Layers style={{ width: 20, height: 20, color: '#BF8F3C' }} /> 
                          <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '3rem', color: '#EDE8DC', margin: 0 }}>Sincronização Sugerida</h3> 
                          <span style={{ marginLeft: 'auto', fontFamily: "'DM Mono', monospace", fontSize: '9px', padding: '8px 12px', border: '1px solid rgba(191,143,60,0.5)', color: '#BF8F3C', letterSpacing: '0.2em', backgroundColor: 'rgba(191,143,60,0.05)' }}>TEMA: {movie.suggested_sync.theme?.toUpperCase()}</span> 
                        </div> 

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '48px', alignItems: 'center', justifyContent: 'center' }}> 
                          <div style={{ width: '192px', aspectRatio: '2/3', backgroundColor: '#040402', border: '1px solid rgba(86,84,80,0.3)', padding: '4px', flexShrink: 0 }}> 
                            <img src={posterUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(100%) contrast(125%)' }} alt="" /> 
                          </div> 
                          
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}> 
                            <div style={{ width: '1px', height: '48px', backgroundColor: 'rgba(191,143,60,0.3)' }} /> 
                            <motion.div animate={{ rotate: 180 }} transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}><Plus style={{ width: 24, height: 24, color: '#BF8F3C' }} /></motion.div> 
                            <div style={{ width: '1px', height: '48px', backgroundColor: 'rgba(191,143,60,0.3)' }} /> 
                          </div> 

                          <motion.div whileHover={{ scale: 1.05, boxShadow: '0 0 40px rgba(191,143,60,0.4)' }} whileTap={{ scale: 0.95 }} style={{ width: '192px', aspectRatio: '2/3', backgroundColor: '#040402', border: '1px solid rgba(191,143,60,0.5)', padding: '4px', flexShrink: 0, boxShadow: '0 0 30px rgba(191,143,60,0.2)', position: 'relative', cursor: 'pointer' }} className="group"> 
                            <img src={movie.suggested_sync.partner_poster || "/images/poster-placeholder.png"} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(100%) contrast(125%)', transition: 'all 0.7s' }} className="group-hover:grayscale-0" alt="" /> 
                            <div style={{ position: 'absolute', bottom: '16px', left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: 0, transition: 'opacity 0.3s' }} className="group-hover:opacity-100"> 
                              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', backgroundColor: '#BF8F3C', color: '#040402', padding: '4px 8px', letterSpacing: '0.1em', fontWeight: 'bold' }}>ALVO PRINCIPAL</span> 
                            </div> 
                          </motion.div> 

                          <div style={{ flex: 1, minWidth: '300px', paddingLeft: '48px', borderLeft: '1px solid rgba(86,84,80,0.3)' }}> 
                            <h4 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '4rem', color: '#EDE8DC', marginBottom: '16px', lineHeight: 1 }}>{movie.title} + {movie.suggested_sync.partner_title}</h4> 
                            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#8C8880', letterSpacing: '0.05em', lineHeight: 1.6, textTransform: 'uppercase', marginBottom: '32px' }}> 
                              {movie.suggested_sync.description}
                            </p> 
                            <motion.button 
                              whileHover={{ backgroundColor: '#EDE8DC', color: '#040402', scale: 1.02 }} 
                              whileTap={{ scale: 0.98 }} 
                              style={{ 
                                backgroundColor: 'transparent', 
                                border: '1px solid #EDE8DC', 
                                color: '#EDE8DC', 
                                padding: '16px 24px', 
                                fontFamily: "'DM Mono', monospace", 
                                fontSize: '9px', 
                                letterSpacing: '0.2em', 
                                cursor: 'pointer', 
                                transition: 'all 0.3s' 
                              }}
                            > 
                              [ SINCRONIZAR SESSÃO ] 
                            </motion.button>
                          </div> 
                        </div> 
                      </motion.div> 
                    ) : (
                      <MissingData label="DOUBLE FEATURE / SINCRONIZAÇÃO" />
                    )}
                  </motion.div> 
                )} 

                {/* ── CONTEÚDO: 02 AUDITORIA & METADADOS ── */}
                {activeTab === "details" && ( 
                  <motion.div key="details" variants={staggerContainer} initial="hidden" animate="visible" exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} style={{ display: 'flex', flexDirection: 'column', gap: '96px' }}> 
                     
                    {/* GRÁFICO TSPDT ESTILO PERFIL (Dynamic Bézier Gaussian) */}
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

                    <motion.div variants={fadeUpItem}> 
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#565450', letterSpacing: '0.2em', marginBottom: '32px' }}>// RECONHECIMENTO INSTITUCIONAL</div> 
                      {festivals.length > 0 ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}> 
                          {festivals.map((fest: any, i: number) => ( 
                            <motion.div key={i} whileHover={{ y: -4, borderColor: 'rgba(191,143,60,0.5)', backgroundColor: 'rgba(191,143,60,0.02)' }} whileTap={{ scale: 0.98 }} style={{ display: 'flex', alignItems: 'center', gap: '24px', padding: '24px', border: '1px solid rgba(86,84,80,0.3)', backgroundColor: '#040402', cursor: 'crosshair', transition: 'all 0.3s' }}> 
                              <Award style={{ width: 32, height: 32, color: '#BF8F3C' }} /> 
                              <div> 
                                <h4 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.5rem', color: '#EDE8DC', margin: '0 0 8px 0' }}>{fest.award}</h4> 
                                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#8C8880', letterSpacing: '0.1em', margin: 0, textTransform: 'uppercase' }}>{fest.name} • {fest.year}</p> 
                              </div> 
                            </motion.div> 
                          ))} 
                        </div> 
                      ) : (
                        <MissingData label="FESTIVAIS / PREMIAÇÕES" />
                      )}
                    </motion.div> 
                  </motion.div> 
                )} 

                {/* ── CONTEÚDO: 03 ARQUIVOS DE MÍDIA ── */}
                {activeTab === "media" && ( 
                  <motion.div key="media" variants={staggerContainer} initial="hidden" animate="visible" exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} style={{ display: 'flex', flexDirection: 'column', gap: '96px' }}> 
                     
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
                        <MissingData label="GALERIA DE IMAGENS (backgroundS)" />
                      )}
                    </motion.div> 

                    <motion.div variants={fadeUpItem} style={{ border: '1px solid rgba(86,84,80,0.3)', backgroundColor: '#040402', padding: '48px' }}> 
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '24px', marginBottom: '48px', borderBottom: '1px solid rgba(86,84,80,0.3)', paddingBottom: '32px' }}> 
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}><Music style={{ width: 32, height: 32, color: '#BF8F3C' }} /></motion.div> 
                        <div> 
                          <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '3rem', color: '#EDE8DC', margin: '0 0 8px 0' }}>Trilha Sonora Original</h3> 
                          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#8C8880', letterSpacing: '0.1em', margin: 0, textTransform: 'uppercase' }}>Composta por {movie.composer || 'Desconhecido'}</p> 
                        </div> 
                      </div> 

                      {soundtrack.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}> 
                          {soundtrack.map((track: any, i: number) => ( 
                            <motion.div key={i} whileHover={{ x: 8, borderColor: 'rgba(191,143,60,0.5)', backgroundColor: 'rgba(191,143,60,0.02)' }} whileTap={{ scale: 0.98 }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', border: '1px solid transparent', backgroundColor: '#080806', cursor: 'pointer', transition: 'all 0.3s' }} className="group"> 
                              <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}> 
                                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#565450' }}>{String(i + 1).padStart(2, '0')}</span> 
                                <Play style={{ width: 16, height: 16, color: '#565450', transition: 'color 0.3s' }} className="group-hover:text-[#BF8F3C]" /> 
                                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#EDE8DC', letterSpacing: '0.1em', transition: 'color 0.3s' }} className="group-hover:text-[#BF8F3C]">{track.title}</span> 
                              </div> 
                              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#8C8880' }}>{track.duration}</span> 
                            </motion.div> 
                          ))} 
                        </div> 
                      ) : (
                        <MissingData label="FAIXAS MUSICAIS (SOUNDTRACK)" />
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