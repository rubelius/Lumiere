'use client';
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, CheckCircle2, ChevronLeft, Star, Clock, Calendar, Globe, Plus, Heart, Award, Camera, Bookmark, Layers, X, Settings2, Subtitles, Maximize, Volume2, SkipBack, SkipForward, Pause, Music } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MovieCard } from "@/components/ui/movie-card";

const FINE_ART_EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } }
};

const fadeUpItem = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { duration: 0.8, ease: FINE_ART_EASE } }
};

export default function MovieDetail() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");
  const [isTrailerOpen, setIsTrailerOpen] = useState(false);
  const [isCollectionOpen, setIsCollectionOpen] = useState(false);
  const [showFullSynopsis, setShowFullSynopsis] = useState(false);

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
    { label: "Processo", value: "Spherical (35mm)" },
    { label: "Som Original", value: "Mono (Westrex)" },
    { label: "Dir. Fotografia", value: "Aldo Scavarda" },
  ];

  return (
    <div style={{ background: '#080806', color: '#EDE8DC', minHeight: '100dvh', display: 'flex', overflowX: 'hidden', position: 'relative' }}>
      
      {/* ── TELA DO TRAILER (Monitor de Edição) ── */}
      <AnimatePresence>
        {isTrailerOpen && (
          <motion.div 
            key="trailer-modal"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
            style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px' }}
          >
            <div 
              onClick={() => setIsTrailerOpen(false)}
              style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(4,4,2,0.9)', backdropFilter: 'blur(12px)', cursor: 'pointer', zIndex: 0 }} 
            />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} transition={{ duration: 0.4, ease: FINE_ART_EASE }}
              onClick={(e) => e.stopPropagation()}
              className="group/player"
              style={{ position: 'relative', width: '100%', maxWidth: '1200px', aspectRatio: '16/9', backgroundColor: '#040402', border: '1px solid #BF8F3C', boxShadow: '0 0 100px rgba(0,0,0,1)', zIndex: 1, overflow: 'hidden' }}
            >
              <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
                <img src="/images/hero-backdrop.png" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(100%) contrast(125%)', opacity: 0.6 }} alt="Video Poster" />
              </div>
              
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 10, background: 'linear-gradient(to bottom, rgba(4,4,2,0.9), transparent)', opacity: 0, transition: 'opacity 0.3s' }} className="group-hover/player:opacity-100">
                <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#BF8F3C', letterSpacing: '0.2em', marginBottom: '8px' }}>[ SINAL DE VÍDEO ATIVO ]</div>
                  <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', color: '#EDE8DC', margin: 0 }}>L'Aventura - Trailer Oficial</h3>
                </motion.div>
                <motion.button 
                  onClick={() => setIsTrailerOpen(false)} 
                  whileHover={{ scale: 1.1, backgroundColor: 'rgba(191,143,60,0.1)', borderColor: '#BF8F3C', color: '#BF8F3C' }} whileTap={{ scale: 0.9 }}
                  style={{ background: 'transparent', border: '1px solid #565450', padding: '12px', color: '#565450', cursor: 'pointer', transition: 'all 0.3s' }}
                >
                  <X style={{ width: 20, height: 20 }} />
                </motion.button>
              </div>

              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '32px', zIndex: 10, background: 'linear-gradient(to top, rgba(4,4,2,0.95), transparent)', opacity: 0, transition: 'opacity 0.3s', display: 'flex', flexDirection: 'column', gap: '24px' }} className="group-hover/player:opacity-100">
                <div style={{ width: '100%', height: '2px', backgroundColor: 'rgba(86,84,80,0.3)', position: 'relative', cursor: 'pointer' }} className="group/timeline">
                  <motion.div variants={{ rest: { height: 2, filter: 'brightness(1)' }, hover: { height: 4, filter: 'brightness(1.5)' } }} initial="rest" whileHover="hover" style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: 0, height: '2px', backgroundColor: '#BF8F3C', width: '33%', boxShadow: '0 0 10px rgba(191,143,60,0.5)' }} />
                  <div className="absolute top-1/2 -translate-y-1/2 left-1/3 w-1.5 h-3 bg-[#EDE8DC] opacity-0 group-hover/timeline:opacity-100 transform -translate-x-1/2 transition-opacity" />
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <motion.button whileHover={{ color: '#EDE8DC', scale: 1.1 }} whileTap={{ scale: 0.9 }} style={{ background: 'transparent', border: 'none', color: '#8C8880', cursor: 'pointer' }}><SkipBack style={{ width: 20, height: 20 }} fill="currentColor" /></motion.button>
                      <motion.button whileHover={{ color: '#BF8F3C', scale: 1.1 }} whileTap={{ scale: 0.9 }} style={{ background: 'transparent', border: 'none', color: '#EDE8DC', cursor: 'pointer' }}><Pause style={{ width: 32, height: 32 }} fill="currentColor" /></motion.button>
                      <motion.button whileHover={{ color: '#EDE8DC', scale: 1.1 }} whileTap={{ scale: 0.9 }} style={{ background: 'transparent', border: 'none', color: '#8C8880', cursor: 'pointer' }}><SkipForward style={{ width: 20, height: 20 }} fill="currentColor" /></motion.button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', borderLeft: '1px solid rgba(86,84,80,0.3)', paddingLeft: '32px' }}>
                      <Volume2 style={{ width: 16, height: 16, color: '#8C8880' }} />
                      <div style={{ width: '96px', height: '1px', backgroundColor: 'rgba(86,84,80,0.3)', position: 'relative' }}><div style={{ width: '66%', height: '100%', backgroundColor: '#EDE8DC', boxShadow: '0 0 5px rgba(237,232,220,0.5)' }} /></div>
                    </div>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#565450', letterSpacing: '0.1em', marginLeft: '16px' }}>01:24 / 02:45</span>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <motion.button whileHover={{ color: '#EDE8DC' }} style={{ background: 'transparent', border: 'none', color: '#8C8880', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}><Settings2 style={{ width: 16, height: 16 }} /> [ AUDIO ]</motion.button>
                    <motion.button whileHover={{ color: '#EDE8DC' }} style={{ background: 'transparent', border: 'none', color: '#8C8880', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}><Subtitles style={{ width: 16, height: 16 }} /> [ LEG ]</motion.button>
                    <div style={{ height: '16px', width: '1px', backgroundColor: 'rgba(86,84,80,0.3)' }} />
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#BF8F3C', letterSpacing: '0.15em', border: '1px solid #BF8F3C', padding: '4px 8px', backgroundColor: 'rgba(191,143,60,0.1)' }}>4K HDR</span>
                    <motion.button whileHover={{ color: '#EDE8DC', scale: 1.1 }} whileTap={{ scale: 0.9 }} style={{ background: 'transparent', border: 'none', color: '#8C8880', cursor: 'pointer', marginLeft: '8px' }}><Maximize style={{ width: 20, height: 20 }} /></motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        
        {/* HERO FADE (Com Leve Ken Burns Effect) */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '85vh', zIndex: 0, overflow: 'hidden' }}>
          <motion.img 
            initial={{ scale: 1.1, opacity: 0 }} 
            animate={{ scale: 1.05, opacity: 0.25 }} 
            transition={{ scale: { duration: 20, ease: "linear", repeat: Infinity, repeatType: "reverse" }, opacity: { duration: 1.5, ease: FINE_ART_EASE } }}
            src="/images/hero-backdrop.png" 
            style={{ width: '100%', height: '100%', objectFit: 'cover', mixBlendMode: 'luminosity', filter: 'grayscale(100%) contrast(125%)' }} alt="" 
          />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #080806, rgba(8,8,6,0.8), transparent)' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, #080806, rgba(8,8,6,0.5), transparent)' }} />
        </div>

        {/* CONTAINER PRINCIPAL */}
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '96px 72px 120px', position: 'relative', zIndex: 10 }}>
          
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, ease: FINE_ART_EASE }} style={{ marginBottom: '64px' }}>
            <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '16px', color: '#565450', textDecoration: 'none', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', transition: 'color 0.3s' }} onMouseEnter={e => e.currentTarget.style.color = '#EDE8DC'} onMouseLeave={e => e.currentTarget.style.color = '#565450'}>
              <motion.div whileHover={{ x: -4 }} transition={{ type: 'spring', stiffness: 400 }}><ChevronLeft style={{ width: 16, height: 16 }} /></motion.div>
              [ Retornar ao Acervo ]
            </Link>
          </motion.div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '80px', alignItems: 'flex-start', marginBottom: '120px' }}>
            
            {/* ── COLUNA ESQUERDA: PÔSTER E AÇÕES ── */}
            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1, ease: FINE_ART_EASE }} style={{ width: '320px', flexShrink: 0 }}>
              
              <motion.div whileHover={{ y: -5, boxShadow: '0 20px 60px rgba(0,0,0,1)' }} transition={{ duration: 0.4, ease: FINE_ART_EASE }} style={{ position: 'relative', aspectRatio: '2/3', backgroundColor: '#040402', border: '1px solid rgba(191,143,60,0.3)', padding: '8px', marginBottom: '32px', overflow: 'hidden', boxShadow: '0 0 50px rgba(0,0,0,0.8)' }} className="group">
                <div style={{ position: 'relative', width: '100%', height: '100%', border: '1px solid rgba(86,84,80,0.3)', overflow: 'hidden' }}>
                  <img src="/images/poster-1.png" alt="Poster" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(100%) contrast(125%)', transition: 'all 0.7s' }} className="group-hover:grayscale-0 group-hover:scale-105" />
                  <motion.div animate={{ y: ['-10%', '110%'] }} transition={{ repeat: Infinity, duration: 4, ease: 'linear' }} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '1px', backgroundColor: '#BF8F3C', boxShadow: '0 0 10px rgba(191,143,60,0.8)', opacity: 0 }} className="group-hover:opacity-100" />
                </div>
                <button 
                  onClick={() => setIsTrailerOpen(true)}
                  style={{ position: 'absolute', inset: 0, margin: 'auto', width: '80px', height: '80px', backgroundColor: 'rgba(4,4,2,0.8)', border: '1px solid #BF8F3C', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#BF8F3C', cursor: 'pointer', transition: 'all 0.4s', opacity: 0, backdropFilter: 'blur(8px)' }}
                  className="group-hover:opacity-100 hover:bg-[#BF8F3C] hover:text-[#040402] hover:scale-110"
                >
                  <Play style={{ width: 32, height: 32, marginLeft: '4px' }} fill="currentColor" />
                </button>
              </motion.div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <motion.button 
                  onClick={() => router.push('/player')}
                  whileHover={{ backgroundColor: '#BF8F3C', color: '#040402', scale: 1.02, boxShadow: '0 0 20px rgba(191,143,60,0.4)' }} whileTap={{ scale: 0.98 }} 
                  style={{ width: '100%', padding: '16px 0', backgroundColor: 'transparent', border: '1px solid #BF8F3C', color: '#BF8F3C', fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.2em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', cursor: 'pointer', transition: 'all 0.3s' }}
                >
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
                        <motion.button whileHover={{ x: 4, backgroundColor: 'rgba(191,143,60,0.1)' }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', backgroundColor: 'transparent', border: 'none', color: '#EDE8DC', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', cursor: 'pointer', textAlign: 'left', transition: 'background-color 0.2s' }}>
                          <Heart style={{ width: 12, height: 12, color: '#BF8F3C' }} /> FAVORITOS
                        </motion.button>
                        <motion.button whileHover={{ x: 4, backgroundColor: 'rgba(191,143,60,0.1)' }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', backgroundColor: 'transparent', border: 'none', color: '#EDE8DC', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', cursor: 'pointer', textAlign: 'left', transition: 'background-color 0.2s' }}>
                          <Clock style={{ width: 12, height: 12, color: '#8C8880' }} /> ASSISTIR DEPOIS
                        </motion.button>
                        <div style={{ height: '1px', backgroundColor: 'rgba(86,84,80,0.3)', margin: '8px 0' }} />
                        <motion.button whileHover={{ x: 4, color: '#EDE8DC', backgroundColor: 'rgba(237,232,220,0.05)' }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', backgroundColor: 'transparent', border: 'none', color: '#565450', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}>
                          <Plus style={{ width: 12, height: 12 }} /> NOVO DIRETÓRIO
                        </motion.button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} style={{ marginTop: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#BF8F3C', letterSpacing: '0.15em', border: '1px solid rgba(191,143,60,0.2)', backgroundColor: 'rgba(191,143,60,0.05)', padding: '12px' }}>
                <CheckCircle2 style={{ width: 12, height: 12 }} /> CACHEADO: REAL-DEBRID
              </motion.div>
            </motion.div>

            {/* ── COLUNA DIREITA: INFORMAÇÕES E METADADOS ── */}
            <div style={{ flex: 1, minWidth: '300px', maxWidth: '1000px', paddingTop: '16px' }}>
              
              <motion.div variants={staggerContainer} initial="hidden" animate="visible">
                <motion.div variants={fadeUpItem} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                  <motion.span whileHover={{ scale: 1.05, borderColor: '#EDE8DC', color: '#EDE8DC' }} style={{ cursor: 'crosshair', transition: 'all 0.3s', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', padding: '6px 12px', border: '1px solid #BF8F3C', color: '#BF8F3C', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase' }}>
                    <Bookmark style={{ width: 12, height: 12 }} /> THE CRITERION COLLECTION #98
                  </motion.span>
                  <motion.span whileHover={{ scale: 1.05, borderColor: '#EDE8DC', color: '#EDE8DC' }} style={{ cursor: 'crosshair', transition: 'all 0.3s', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', padding: '6px 12px', border: '1px solid #565450', color: '#8C8880', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase' }}>
                    <Award style={{ width: 12, height: 12 }} /> SIGHT & SOUND TOP 250
                  </motion.span>
                </motion.div>
                
                <motion.h1 variants={fadeUpItem} style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(4rem, 8vw, 8rem)', fontWeight: 400, color: '#EDE8DC', marginBottom: '32px', lineHeight: 0.9, letterSpacing: '-0.02em', margin: '0 0 32px 0' }}>
                  L'Avventura
                </motion.h1>
                
                <motion.div variants={fadeUpItem} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '24px', color: '#8C8880', marginBottom: '48px', fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.2em' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Calendar style={{ width: 12, height: 12 }} /> 1960</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Star style={{ width: 12, height: 12, color: '#BF8F3C' }} /> MICHELANGELO ANTONIONI</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Clock style={{ width: 12, height: 12 }} /> 2H 23M</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Globe style={{ width: 12, height: 12 }} /> ITÁLIA</span>
                </motion.div>

                <motion.div variants={fadeUpItem} style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '64px' }}>
                  {[ "REMUX", "4K", "DOLBY VISION", "DOLBY ATMOS" ].map(tag => (
                    <motion.span whileHover={{ scale: 1.1, backgroundColor: '#BF8F3C' }} key={tag} style={{ cursor: 'crosshair', transition: 'background-color 0.3s', fontFamily: "'DM Mono', monospace", fontSize: '9px', fontWeight: 'bold', letterSpacing: '0.2em', padding: '6px 12px', backgroundColor: '#EDE8DC', color: '#040402' }}>
                      {tag}
                    </motion.span>
                  ))}
                </motion.div>

                <motion.div variants={fadeUpItem} style={{ marginBottom: '80px', maxWidth: '800px' }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#565450', letterSpacing: '0.2em', marginBottom: '16px' }}>// REGISTRO DE ENREDO</div>
                  <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', lineHeight: 1.6, color: '#8C8880', margin: 0, display: '-webkit-box', WebkitLineClamp: showFullSynopsis ? 'none' : 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    O desaparecimento de uma jovem durante uma viagem de barco pelo Mediterrâneo estimula seu amante e sua melhor amiga a iniciarem uma busca pela moça. Durante a procura, os dois se apaixonam, num processo de alienação e falta de comunicação característica do cinema de Antonioni. A paisagem estéril das ilhas eólias reflete o vazio existencial dos personagens, criando uma obra-prima do cinema moderno.
                  </p>
                  <motion.button whileHover={{ color: '#EDE8DC' }} onClick={() => setShowFullSynopsis(!showFullSynopsis)} style={{ marginTop: '24px', backgroundColor: 'transparent', border: 'none', color: '#BF8F3C', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', cursor: 'pointer', transition: 'color 0.3s' }}>
                    [ {showFullSynopsis ? 'OCULTAR DADOS' : 'EXPANDIR REGISTRO'} ]
                  </motion.button>
                </motion.div>
              </motion.div>

              {/* ABAS ARQUIVISTAS */}
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

              {/* TAB CONTENT: OVERVIEW */}
              <AnimatePresence mode="wait">
                {activeTab === "overview" && (
                  <motion.div key="overview" variants={staggerContainer} initial="hidden" animate="visible" exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} style={{ display: 'flex', flexDirection: 'column', gap: '96px' }}>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '48px' }}>
                      <motion.div variants={fadeUpItem} whileHover={{ y: -4 }} style={{ display: 'flex', alignItems: 'flex-start', gap: '24px' }} className="group cursor-crosshair">
                        <div style={{ width: '80px', aspectRatio: '3/4', backgroundColor: '#040402', border: '1px solid rgba(86,84,80,0.3)', padding: '4px', flexShrink: 0 }}>
                          <img src="https://i.pravatar.cc/150?u=antonioni" alt="Director" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(100%) contrast(125%)', transition: 'all 0.5s' }} className="group-hover:grayscale-0 group-hover:scale-105" />
                        </div>
                        <div>
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#BF8F3C', letterSpacing: '0.2em', marginBottom: '8px', transition: 'color 0.3s' }} className="group-hover:text-[#EDE8DC]">// DIREÇÃO</div>
                          <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.5rem', color: '#EDE8DC', margin: '0 0 12px 0' }}>Michelangelo Antonioni</h3>
                          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#8C8880', lineHeight: 1.6, margin: 0, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Mestre do modernismo italiano, redefiniu a narrativa cinematográfica focando no vazio e na alienação arquitetônica.</p>
                        </div>
                      </motion.div>

                      <motion.div variants={fadeUpItem} whileHover={{ y: -4 }} style={{ display: 'flex', alignItems: 'flex-start', gap: '24px' }} className="group cursor-crosshair">
                        <div style={{ width: '80px', aspectRatio: '3/4', backgroundColor: '#040402', border: '1px solid rgba(86,84,80,0.3)', padding: '4px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color 0.3s' }} className="group-hover:border-[#BF8F3C]">
                          <Camera style={{ width: 24, height: 24, color: '#565450', transition: 'color 0.3s' }} className="group-hover:text-[#BF8F3C]" />
                        </div>
                        <div>
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#565450', letterSpacing: '0.2em', marginBottom: '8px', transition: 'color 0.3s' }} className="group-hover:text-[#BF8F3C]">// FOTOGRAFIA</div>
                          <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.5rem', color: '#EDE8DC', margin: '0 0 12px 0' }}>Aldo Scavarda</h3>
                          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#8C8880', lineHeight: 1.6, margin: 0, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Criou composições milimetricamente calculadas usando película 35mm P&B, utilizando a paisagem como extensão psicológica.</p>
                        </div>
                      </motion.div>
                    </div>

                    <motion.div variants={fadeUpItem}>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#565450', letterSpacing: '0.2em', marginBottom: '32px' }}>// IDENTIFICAÇÃO DE ELENCO</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '24px' }}>
                        {cast.map((actor, i) => (
                          <motion.div key={i} whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 300 }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} className="group cursor-crosshair">
                            <div style={{ width: '100%', aspectRatio: '3/4', backgroundColor: '#040402', border: '1px solid rgba(86,84,80,0.3)', padding: '4px', overflow: 'hidden' }}>
                              <img src={actor.img} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(100%) contrast(125%)', transition: 'all 0.5s' }} className="group-hover:grayscale-0 group-hover:scale-105" alt={actor.name} />
                            </div>
                            <div>
                              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.6rem', color: '#EDE8DC', lineHeight: 1, marginBottom: '8px' }} className="group-hover:text-[#BF8F3C] transition-colors">{actor.name}</div>
                              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', color: '#8C8880', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{actor.role}</div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>

                    <motion.div variants={fadeUpItem}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '32px', borderBottom: '1px solid rgba(86,84,80,0.3)', paddingBottom: '16px' }}>
                        <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '3rem', color: '#EDE8DC', margin: 0 }}>Arquivos Disponíveis</h3>
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#BF8F3C', letterSpacing: '0.2em' }}>03 CÓPIAS LOCALIZADAS</span>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid rgba(86,84,80,0.3)', backgroundColor: '#040402', overflowX: 'auto' }}>
                        {releases.map((release, i) => (
                          <motion.div key={i} whileHover={{ x: 8, backgroundColor: 'rgba(191,143,60,0.05)' }} style={{ display: 'grid', gridTemplateColumns: '60px minmax(200px, 1fr) 1fr 100px 60px', alignItems: 'center', padding: '16px', borderBottom: i !== releases.length -1 ? '1px solid rgba(86,84,80,0.3)' : 'none', cursor: 'pointer' }} className="group">
                            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '14px', color: '#BF8F3C', textAlign: 'center', transition: 'transform 0.3s' }} className="group-hover:scale-110">{release.score}</div>
                            <div>
                              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', color: '#EDE8DC', marginBottom: '8px', transition: 'color 0.3s' }} className="group-hover:text-[#BF8F3C]">{release.group}</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', letterSpacing: '0.1em', color: '#8C8880', border: '1px solid rgba(86,84,80,0.5)', padding: '2px 4px' }}>{release.res}</span>
                                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', letterSpacing: '0.1em', color: '#040402', backgroundColor: '#EDE8DC', padding: '2px 4px' }}>{release.type}</span>
                              </div>
                            </div>
                            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#8C8880', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{release.audio}</div>
                            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#EDE8DC', letterSpacing: '0.1em', textAlign: 'right', paddingRight: '16px', borderRight: '1px solid rgba(86,84,80,0.3)' }}>{release.size}</div>
                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                              <motion.div whileHover={{ scale: 1.2, color: '#EDE8DC' }}><Play style={{ width: 16, height: 16, color: '#565450', transition: 'color 0.3s' }} className="group-hover:text-[#BF8F3C]" /></motion.div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>

                    <motion.div variants={fadeUpItem} style={{ border: '1px solid rgba(191,143,60,0.3)', background: 'linear-gradient(to bottom right, #040402, #080806)', padding: '48px', position: 'relative', overflow: 'hidden' }}>
                      <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }} transition={{ duration: 8, repeat: Infinity, ease: 'linear' }} style={{ position: 'absolute', top: 0, right: 0, width: '400px', height: '400px', backgroundColor: 'rgba(191,143,60,0.05)', borderRadius: '50%', filter: 'blur(100px)', pointerEvents: 'none', transform: 'translate(50%, -50%)' }} />
                      
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px', marginBottom: '48px' }}>
                        <Layers style={{ width: 20, height: 20, color: '#BF8F3C' }} />
                        <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '3rem', color: '#EDE8DC', margin: 0 }}>Sincronização Sugerida</h3>
                        <span style={{ marginLeft: 'auto', fontFamily: "'DM Mono', monospace", fontSize: '9px', padding: '8px 12px', border: '1px solid rgba(191,143,60,0.5)', color: '#BF8F3C', letterSpacing: '0.2em', backgroundColor: 'rgba(191,143,60,0.05)' }}>TEMA: O VAZIO EXISTENCIAL</span>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '48px', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ width: '192px', aspectRatio: '2/3', backgroundColor: '#040402', border: '1px solid rgba(86,84,80,0.3)', padding: '4px', flexShrink: 0 }}>
                          <img src="/images/poster-1.png" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(100%) contrast(125%)' }} alt="" />
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                          <div style={{ width: '1px', height: '48px', backgroundColor: 'rgba(191,143,60,0.3)' }} />
                          <motion.div animate={{ rotate: 180 }} transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}><Plus style={{ width: 24, height: 24, color: '#BF8F3C' }} /></motion.div>
                          <div style={{ width: '1px', height: '48px', backgroundColor: 'rgba(191,143,60,0.3)' }} />
                        </div>

                        <motion.div whileHover={{ scale: 1.05, boxShadow: '0 0 40px rgba(191,143,60,0.4)' }} style={{ width: '192px', aspectRatio: '2/3', backgroundColor: '#040402', border: '1px solid rgba(191,143,60,0.5)', padding: '4px', flexShrink: 0, boxShadow: '0 0 30px rgba(191,143,60,0.2)', position: 'relative', cursor: 'pointer' }} className="group">
                          <img src="/images/poster-3.png" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(100%) contrast(125%)', transition: 'all 0.7s' }} className="group-hover:grayscale-0" alt="" />
                          <div style={{ position: 'absolute', bottom: '16px', left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: 0, transition: 'opacity 0.3s' }} className="group-hover:opacity-100">
                             <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', backgroundColor: '#BF8F3C', color: '#040402', padding: '4px 8px', letterSpacing: '0.1em', fontWeight: 'bold' }}>ALVO PRINCIPAL</span>
                          </div>
                        </motion.div>

                        <div style={{ flex: 1, minWidth: '300px', paddingLeft: '48px', borderLeft: '1px solid rgba(86,84,80,0.3)' }}>
                          <h4 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '4rem', color: '#EDE8DC', marginBottom: '16px', lineHeight: 1 }}>L'Aventura + Persona</h4>
                          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#8C8880', letterSpacing: '0.05em', lineHeight: 1.6, textTransform: 'uppercase', marginBottom: '32px' }}>
                            Uma exploração profunda da incomunicabilidade e identidade. Comece com a paisagem estéril de Antonioni e termine com a desconstrução psicológica de Bergman. Ambas obras-primas do cinema europeu.
                          </p>
                          <motion.button whileHover={{ backgroundColor: '#EDE8DC', color: '#040402', scale: 1.02 }} whileTap={{ scale: 0.98 }} style={{ backgroundColor: 'transparent', border: '1px solid #EDE8DC', color: '#EDE8DC', padding: '16px 24px', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', cursor: 'pointer', transition: 'all 0.3s' }}>
                            [ SINCRONIZAR SESSÃO ]
                          </motion.button>
                        </div>
                      </div>
                    </motion.div>

                  </motion.div>
                )}

                {/* TAB CONTENT: DETAILS (Prêmios e Críticas) */}
                {activeTab === "details" && (
                  <motion.div key="details" variants={staggerContainer} initial="hidden" animate="visible" exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} style={{ display: 'flex', flexDirection: 'column', gap: '96px' }}>
                    
                    <motion.div variants={fadeUpItem}>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#565450', letterSpacing: '0.2em', marginBottom: '32px' }}>// RECONHECIMENTO INSTITUCIONAL</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                        {festivals.map((fest, i) => (
                          <motion.div key={i} whileHover={{ y: -4, borderColor: 'rgba(191,143,60,0.5)' }} style={{ display: 'flex', alignItems: 'center', gap: '24px', padding: '24px', border: '1px solid rgba(86,84,80,0.3)', backgroundColor: '#040402', cursor: 'crosshair', transition: 'border-color 0.3s' }}>
                            <Award style={{ width: 32, height: 32, color: '#BF8F3C' }} />
                            <div>
                              <h4 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.5rem', color: '#EDE8DC', margin: '0 0 8px 0' }}>{fest.award}</h4>
                              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#8C8880', letterSpacing: '0.1em', margin: 0, textTransform: 'uppercase' }}>{fest.name} • {fest.year}</p>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>

                    <motion.div variants={fadeUpItem}>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#565450', letterSpacing: '0.2em', marginBottom: '32px' }}>// ANÁLISE CRÍTICA</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '32px' }}>
                        {reviews.map((review, i) => (
                          <motion.div key={i} whileHover={{ y: -4, borderColor: 'rgba(191,143,60,0.3)' }} style={{ padding: '32px', border: '1px solid rgba(86,84,80,0.3)', background: 'linear-gradient(to bottom, #040402, #080806)', display: 'flex', flexDirection: 'column', cursor: 'crosshair', transition: 'border-color 0.3s' }}>
                            <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.2rem', color: '#EDE8DC', fontStyle: 'italic', fontWeight: 300, marginBottom: '32px', lineHeight: 1.6, flex: 1 }}>
                              "{review.text}"
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(86,84,80,0.3)', paddingTop: '24px', marginTop: 'auto' }}>
                              <div>
                                <h4 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', color: '#BF8F3C', margin: 0 }}>{review.author}</h4>
                                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', color: '#8C8880', letterSpacing: '0.1em', margin: 0, textTransform: 'uppercase' }}>{review.outlet}</p>
                              </div>
                              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '16px', color: '#EDE8DC', backgroundColor: 'rgba(86,84,80,0.2)', padding: '4px 12px', border: '1px solid rgba(86,84,80,0.5)' }}>
                                {review.score}
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>

                    <motion.div variants={fadeUpItem}>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#565450', letterSpacing: '0.2em', marginBottom: '32px' }}>// ESPECIFICAÇÕES TÉCNICAS DA OBRA</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', rowGap: '48px', columnGap: '64px', borderTop: '1px solid rgba(86,84,80,0.3)', borderBottom: '1px solid rgba(86,84,80,0.3)', padding: '48px 0' }}>
                        {technicalSpecs.map((spec, i) => (
                          <div key={i} className="group cursor-crosshair">
                            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', color: '#BF8F3C', letterSpacing: '0.2em', marginBottom: '8px', textTransform: 'uppercase', transition: 'color 0.3s' }} className="group-hover:text-[#EDE8DC]">{spec.label}</p>
                            <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.5rem', color: '#EDE8DC', margin: 0 }}>{spec.value}</p>
                          </div>
                        ))}
                      </div>
                    </motion.div>

                  </motion.div>
                )}

                {/* TAB CONTENT: MEDIA */}
                {activeTab === "media" && (
                  <motion.div key="media" variants={staggerContainer} initial="hidden" animate="visible" exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} style={{ display: 'flex', flexDirection: 'column', gap: '96px' }}>
                    
                    <motion.div variants={fadeUpItem}>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#565450', letterSpacing: '0.2em', marginBottom: '32px' }}>// CAPTURAS ÓPTICAS</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                        {["/images/poster-2.png", "/images/poster-3.png", "/images/poster-4.png", "/images/poster-5.png", "/images/poster-1.png"].map((img, i) => (
                          <motion.div key={i} whileHover={{ scale: 1.02, zIndex: 10, boxShadow: '0 10px 40px rgba(0,0,0,0.8)' }} style={{ backgroundColor: '#040402', border: '1px solid rgba(86,84,80,0.3)', padding: '4px', cursor: 'crosshair', position: 'relative' }} className={`group ${i === 0 ? 'col-span-2 row-span-2' : ''}`}>
                            <div style={{ aspectRatio: i === 0 ? '16/9' : '3/2', width: '100%', overflow: 'hidden' }}>
                              <img src={img} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(100%) contrast(125%)', transition: 'all 0.7s' }} className="group-hover:grayscale-0" alt="" />
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>

                    <motion.div variants={fadeUpItem} style={{ border: '1px solid rgba(86,84,80,0.3)', backgroundColor: '#040402', padding: '48px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '24px', marginBottom: '48px', borderBottom: '1px solid rgba(86,84,80,0.3)', paddingBottom: '32px' }}>
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}><Music style={{ width: 32, height: 32, color: '#BF8F3C' }} /></motion.div>
                        <div>
                          <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '3rem', color: '#EDE8DC', margin: '0 0 8px 0' }}>Trilha Sonora Original</h3>
                          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#8C8880', letterSpacing: '0.1em', margin: 0, textTransform: 'uppercase' }}>Composta por Giovanni Fusco</p>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {["MAIN THEME (L'AVVENTURA)", "THE ISLAND", "SEARCHING FOR ANNA"].map((track, i) => (
                          <motion.div key={i} whileHover={{ x: 8, borderColor: 'rgba(86,84,80,0.5)' }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', border: '1px solid transparent', backgroundColor: '#080806', cursor: 'pointer', transition: 'border-color 0.3s' }} className="group">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#565450' }}>0{i + 1}</span>
                              <Play style={{ width: 16, height: 16, color: '#565450', transition: 'color 0.3s' }} className="group-hover:text-[#BF8F3C]" />
                              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#EDE8DC', letterSpacing: '0.1em', transition: 'color 0.3s' }} className="group-hover:text-[#BF8F3C]">{track}</span>
                            </div>
                            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#8C8880' }}>03:{14 + i * 10}</span>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>

                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          </div>

          {/* ── OBRAS CORRELATAS ── */}
          <motion.section initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-10%" }} transition={{ duration: 0.8, ease: FINE_ART_EASE }} style={{ paddingTop: '96px', borderTop: '1px solid rgba(86,84,80,0.3)' }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#565450', letterSpacing: '0.2em', marginBottom: '48px' }}>// OBRAS CORRELATAS IDENTIFICADAS</div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '32px' }}>
              {similarMovies.map((movie, i) => (
                <motion.div key={movie.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.6, ease: FINE_ART_EASE }}>
                  <MovieCard id={movie.id} title={movie.title} year={movie.year} imageUrl={movie.img} qualities={movie.qualities} index={i} />
                </motion.div>
              ))}
            </div>
          </motion.section>

        </div>
      </main>
    </div>
  );
}