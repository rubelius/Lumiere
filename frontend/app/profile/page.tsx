'use client';
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Film, HardDrive, Edit3, Settings, Award, Star, Flame, Trophy, BarChart3, Activity, Bookmark, History, CalendarDays, TerminalSquare, X, Camera, Globe } from "lucide-react";
import { useRouter } from "next/navigation";

const FINE_ART_EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.2 } }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { duration: 0.8, ease: FINE_ART_EASE } }
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.98, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.5, ease: FINE_ART_EASE } },
  exit: { opacity: 0, scale: 0.98, y: 20, transition: { duration: 0.4, ease: FINE_ART_EASE } }
};

export default function Profile() {
  const [userName, setUserName] = useState("Edwin David");
  const [userBio, setUserBio] = useState("Desenvolvedor chefe e curador do acervo. Apaixonado por clássicos noir, ficção científica contemplativa e arquivos REMUX 4K sem compressão.");
  const router = useRouter();
  
  const [draftName, setDraftName] = useState(userName);
  const [draftBio, setDraftBio] = useState(userBio);

  const [activeModal, setActiveModal] = useState<"edit" | "lists" | "log" | "achievement" | null>(null);
  const [selectedAchievement, setSelectedAchievement] = useState<any>(null);

  const stats = [
    { label: "TEMPO DE EXIBIÇÃO", value: "342 H", icon: Clock, detail: "TOP 5% DA PLATAFORMA" },
    { label: "ACERVO ASSISTIDO", value: "128", icon: Film, detail: "OBRAS CATALOGADAS" },
    { label: "AVALIAÇÃO MÉDIA", value: "4.2", icon: Star, detail: "CRÍTICO EXIGENTE" },
  ];

  const achievements = [
    { title: "MARATONISTA", desc: "5 PROJEÇÕES EM 24H", fullDesc: "Você manteve o sistema em operação contínua por mais de 12 horas reprodutivas em um único ciclo de rotação da Terra.", icon: Flame },
    { title: "CINÉFILO NOIR", desc: "10 CLÁSSICOS NOIR", fullDesc: "Aquisição e visualização integral de 10 obras do movimento Noir. O contraste absoluto foi calibrado.", icon: Star },
    { title: "NOUVELLE VAGUE", desc: "AUTORES FRANCESES", fullDesc: "Exploração profunda do cinema francês de vanguarda. Godard e Truffaut aprovariam sua curadoria.", icon: Camera },
    { title: "ARQUIVISTA", desc: "100 REVIEWS ESCRITAS", fullDesc: "Seu diário de filmes atingiu a marca de 100 críticas documentadas para a posteridade.", icon: Trophy },
  ];

  const handleSaveProfile = () => {
    setUserName(draftName);
    setUserBio(draftBio);
    setActiveModal(null);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#080806', color: '#EDE8DC', paddingBottom: 120 }}>
      <div className="fixed inset-0 bg-noise opacity-[0.03] mix-blend-overlay pointer-events-none z-0" />
      
      <main style={{ maxWidth: 1400, margin: '0 auto', padding: '120px 72px 0', position: 'relative', zIndex: 10 }}>
        
        <motion.div initial="hidden" animate="visible" variants={containerVariants}>
          
          {/* ── CABEÇALHO / DOSSIÊ DO USUÁRIO ── */}
          <motion.div variants={itemVariants} style={{ display: 'flex', alignItems: 'flex-end', gap: 64, marginBottom: 120, paddingBottom: 64, borderBottom: '1px solid rgba(237,232,220,0.05)' }}>
            <div style={{ position: 'relative', width: 220, aspectRatio: '3/4', border: '1px solid rgba(237,232,220,0.2)', backgroundColor: '#040402', overflow: 'hidden' }}>
              <img src="/images/perfil.jpg" alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(100%) contrast(1.2)' }} />
              <motion.div animate={{ y: ['-10%', '110%'] }} transition={{ repeat: Infinity, duration: 3, ease: 'linear' }} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 2, backgroundColor: 'rgba(191,143,60,0.5)', boxShadow: '0 0 15px rgba(191,143,60,0.8)' }} />
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                <div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#BF8F3C', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 12 }}>[ ID DE OPERAÇÃO: 001 ]</div>
                  <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '4.5rem', fontWeight: 400, margin: 0, lineHeight: 1, letterSpacing: '-0.02em', color: '#FFFFFF' }}>{userName}</h1>
                </div>
                
                <div style={{ display: 'flex', gap: 16 }}>
                  {/* Botão de Editar Perfil (Abre o Modal) */}
                  <motion.button 
                    onClick={() => { setDraftName(userName); setDraftBio(userBio); setActiveModal('edit'); }}
                    whileHover={{ backgroundColor: '#BF8F3C', color: '#040402', scale: 1.05, borderColor: '#BF8F3C' }} whileTap={{ scale: 0.95 }}
                    style={{ background: 'transparent', border: '1px solid rgba(237,232,220,0.2)', width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8C8880', cursor: 'pointer', transition: 'all 0.3s' }}
                  >
                    <Edit3 style={{ width: 16, height: 16 }} />
                  </motion.button>

                  {/* Botão de Configurações (Redireciona para /settings) */}
                  <motion.button 
                    onClick={() => router.push('/settings')}
                    whileHover={{ backgroundColor: '#EDE8DC', color: '#040402', scale: 1.05, borderColor: '#EDE8DC' }} whileTap={{ scale: 0.95 }}
                    style={{ background: 'transparent', border: '1px solid rgba(237,232,220,0.2)', width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8C8880', cursor: 'pointer', transition: 'all 0.3s' }}
                  >
                    <Settings style={{ width: 16, height: 16 }} />
                  </motion.button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', padding: '6px 12px', border: '1px solid #BF8F3C', color: '#BF8F3C', backgroundColor: 'rgba(191,143,60,0.05)' }}>ADMINISTRADOR LUMIÈRE</span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', padding: '6px 12px', border: '1px solid rgba(237,232,220,0.1)', color: '#565450' }}>ACESSO MASTER</span>
              </div>
              <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.6rem', color: '#8C8880', fontStyle: 'italic', margin: 0, maxWidth: 700, lineHeight: 1.4 }}>{userBio}</p>
            </div>
          </motion.div>

          {/* ── TELEMETRIA GERAL ── */}
          <motion.div variants={itemVariants} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 48, marginBottom: 120 }}>
            {stats.map((stat) => (
              <div key={stat.label} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid rgba(237,232,220,0.1)', paddingBottom: 16 }}>
                  <stat.icon style={{ width: 16, height: 16, color: '#BF8F3C' }} />
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#565450', letterSpacing: '0.2em' }}>[ {stat.label} ]</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '3.5rem', color: '#EDE8DC', lineHeight: 1 }}>{stat.value}</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', color: '#BF8F3C', letterSpacing: '0.1em', paddingBottom: 6 }}>{stat.detail}</span>
                </div>
              </div>
            ))}
          </motion.div>

          {/* ── PAINEL DE GRÁFICOS (VISIBILIDADE APRIMORADA E FÍSICA FINA) ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '80px 64px', marginBottom: 120 }}>
            
            {/* 1. Espectro de Gêneros */}
            <motion.div variants={itemVariants}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 40 }}>
                <Film style={{ width: 24, height: 24, color: '#BF8F3C' }} />
                <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.5rem', margin: 0, color: '#EDE8DC' }}>Espectro de Gêneros</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {[ { label: 'SCI-FI', percent: 85 }, { label: 'NOIR', percent: 65 }, { label: 'DRAMA', percent: 45 }, { label: 'FANTASIA (ÉPICA)', percent: 30 } ].map(genre => (
                  <motion.div key={genre.label} whileHover="hover" initial="rest" animate="rest" style={{ cursor: 'crosshair' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.15em', marginBottom: 10 }}>
                      <motion.span variants={{ rest: { color: '#EDE8DC' }, hover: { color: '#BF8F3C' } }} transition={{ duration: 0.15 }}>{genre.label}</motion.span>
                      <motion.span variants={{ rest: { color: '#8C8880' }, hover: { color: '#EDE8DC' } }} transition={{ duration: 0.15 }}>{genre.percent}%</motion.span>
                    </div>
                    {/* Barra mais grossa (6px) para visibilidade real */}
                    <div style={{ height: 6, width: '100%', backgroundColor: 'rgba(237,232,220,0.1)', position: 'relative', borderRadius: 2 }}>
                      <motion.div 
                        variants={{ 
                          rest: { backgroundColor: '#A3A098', boxShadow: 'none' }, 
                          hover: { backgroundColor: '#BF8F3C', boxShadow: '0 0 12px rgba(191,143,60,0.8)' } 
                        }}
                        initial={{ width: 0 }} whileInView={{ width: `${genre.percent}%` }} viewport={{ once: true }} 
                        transition={{ width: { duration: 1.5, ease: FINE_ART_EASE }, default: { duration: 0.2 } }}
                        style={{ position: 'absolute', top: 0, left: 0, height: '100%', borderRadius: 2 }}
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* 2. Dispersão Temporal */}
            <motion.div variants={itemVariants}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 40 }}>
                <Clock style={{ width: 24, height: 24, color: '#BF8F3C' }} />
                <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.5rem', margin: 0, color: '#EDE8DC' }}>Dispersão Temporal</h2>
              </div>
              <div style={{ position: 'relative', height: 180, borderBottom: '1px solid rgba(237,232,220,0.2)', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: 8 }}>
                <div style={{ position: 'absolute', top: '50%', left: 0, width: '100%', height: 1, borderTop: '1px dashed rgba(237,232,220,0.1)', zIndex: 0 }} />
                
                {[ { dec: '1920', val: 15 }, { dec: '1940', val: 30 }, { dec: '1960', val: 80 }, { dec: '1980', val: 60 }, { dec: '2000', val: 90 }, { dec: '2020', val: 40 } ].map((d, i) => (
                  <motion.div key={d.dec} whileHover="hover" initial="rest" animate="rest" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, height: '100%', flex: 1, zIndex: 1, cursor: 'crosshair' }}>
                    <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                      <motion.div 
                        /* Colunas largas e em Prata Metálico para destaque imediato */
                        variants={{ 
                          rest: { backgroundColor: '#A3A098', scaleX: 1, scaleY: 1, boxShadow: 'none' }, 
                          hover: { backgroundColor: '#BF8F3C', scaleX: 1.2, scaleY: 1.05, boxShadow: '0 0 15px rgba(191,143,60,0.5)' } 
                        }}
                        initial={{ height: 0 }} whileInView={{ height: `${d.val}%` }} viewport={{ once: true }} 
                        transition={{ height: { duration: 1.2, delay: i * 0.1, ease: FINE_ART_EASE }, default: { duration: 0.2 } }}
                        style={{ width: 32, borderTopLeftRadius: 4, borderTopRightRadius: 4, transformOrigin: 'bottom' }}
                      />
                    </div>
                    <motion.span variants={{ rest: { color: '#8C8880', y: 0 }, hover: { color: '#BF8F3C', y: -2 } }} transition={{ duration: 0.2 }} style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.1em' }}>{d.dec}S</motion.span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* 3. Curva de Avaliações (Gaussiana Limpa) */}
            <motion.div variants={itemVariants}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 40 }}>
                <Star style={{ width: 24, height: 24, color: '#BF8F3C' }} />
                <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.5rem', margin: 0, color: '#EDE8DC' }}>Curva de Avaliações</h2>
              </div>
              <div style={{ position: 'relative', height: 180, width: '100%', borderBottom: '1px solid rgba(237,232,220,0.2)' }}>
                <svg viewBox="0 0 1000 200" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
                   <motion.path 
                     initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ duration: 2, ease: FINE_ART_EASE }}
                     d="M 0,200 L 0,190 C 60,190 60,185 125,185 C 190,185 190,175 250,175 C 310,175 310,150 375,150 C 440,150 440,100 500,100 C 560,100 560,50 625,50 C 690,50 690,20 750,20 C 810,20 810,70 875,70 C 940,70 940,150 1000,150 L 1000,200 Z"
                     fill="url(#gaussian-gradient)"
                   />
                   <defs>
                     <linearGradient id="gaussian-gradient" x1="0" x2="0" y1="0" y2="1">
                       <stop offset="0%" stopColor="rgba(191,143,60,0.2)" />
                       <stop offset="100%" stopColor="rgba(191,143,60,0)" />
                     </linearGradient>
                   </defs>
                   <motion.path 
                     initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 2, ease: FINE_ART_EASE }}
                     d="M 0,190 C 60,190 60,185 125,185 C 190,185 190,175 250,175 C 310,175 310,150 375,150 C 440,150 440,100 500,100 C 560,100 560,50 625,50 C 690,50 690,20 750,20 C 810,20 810,70 875,70 C 940,70 940,150 1000,150"
                     fill="none" stroke="#BF8F3C" strokeWidth="4" strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 8px rgba(191,143,60,0.6))' }}
                   />
                </svg>

                {/* Eixo X com Precisão 0.5 - Sem bolinhas */}
                <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 0 }}>
                  {[ { r: '1.0', x: '0%' }, { r: '1.5', x: '12.5%' }, { r: '2.0', x: '25%' }, { r: '2.5', x: '37.5%' }, { r: '3.0', x: '50%' }, { r: '3.5', x: '62.5%' }, { r: '4.0', x: '75%' }, { r: '4.5', x: '87.5%' }, { r: '5.0', x: '100%' } ].map((pt) => (
                    <motion.div key={pt.r} whileHover="hover" initial="rest" animate="rest" style={{ position: 'absolute', left: pt.x, bottom: -24, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'crosshair', transform: 'translateX(-50%)' }}>
                      <motion.span 
                        variants={{ rest: { color: '#8C8880', scale: 1 }, hover: { color: '#BF8F3C', scale: 1.3 } }}
                        transition={{ duration: 0.2 }}
                        style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.1em' }}
                      >
                        {pt.r}
                      </motion.span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* 4. Autores Recorrentes */}
            <motion.div variants={itemVariants}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 40 }}>
                <Camera style={{ width: 24, height: 24, color: '#BF8F3C' }} />
                <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.5rem', margin: 0, color: '#EDE8DC' }}>Autores Recorrentes</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {[ { dir: 'M. ANTONIONI', val: 18 }, { dir: 'A. TARKOVSKY', val: 14 }, { dir: 'S. KUBRICK', val: 12 }, { dir: 'I. BERGMAN', val: 10 } ].map((d, i) => (
                  <motion.div key={i} whileHover="hover" initial="rest" animate="rest" style={{ display: 'grid', gridTemplateColumns: '120px 1fr 30px', alignItems: 'center', gap: 16, cursor: 'crosshair' }}>
                    <motion.span variants={{ rest: { color: '#EDE8DC', x: 0 }, hover: { color: '#BF8F3C', x: 4 } }} transition={{ duration: 0.2 }} style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em' }}>
                      {d.dir}
                    </motion.span>
                    <div style={{ height: 6, width: '100%', backgroundColor: 'rgba(237,232,220,0.1)', position: 'relative', borderRadius: 2 }}>
                      <motion.div 
                        variants={{ 
                          rest: { backgroundColor: '#A3A098', boxShadow: 'none' }, 
                          hover: { backgroundColor: '#BF8F3C', boxShadow: '0 0 10px rgba(191,143,60,0.8)' } 
                        }}
                        initial={{ width: 0 }} whileInView={{ width: `${(d.val / 18) * 100}%` }} viewport={{ once: true }} 
                        transition={{ width: { duration: 1.5, delay: i * 0.1, ease: FINE_ART_EASE }, default: { duration: 0.2 } }}
                        style={{ position: 'absolute', top: 0, left: 0, height: '100%', borderRadius: 2 }}
                      />
                    </div>
                    <motion.span variants={{ rest: { color: '#8C8880', scale: 1 }, hover: { color: '#BF8F3C', scale: 1.2 } }} transition={{ duration: 0.2 }} style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', textAlign: 'right' }}>
                      {d.val}
                    </motion.span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* 5. Geografia Cinematográfica (Restaurado o Monolito em Degradê) */}
            <motion.div variants={itemVariants}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 40 }}>
                <Globe style={{ width: 24, height: 24, color: '#BF8F3C' }} />
                <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.5rem', margin: 0, color: '#EDE8DC' }}>Geografia Cinematográfica</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: 180 }}>
                <div style={{ display: 'flex', width: '100%', height: 32, gap: 4, marginBottom: 24 }}>
                  {[ 
                    /* Cores originais mantidas para formar o degradê escuro contínuo amado */
                    { c: 'EUA', p: 40, col: '#565450' }, 
                    { c: 'FRA', p: 25, col: '#8C8880' }, 
                    { c: 'ITA', p: 15, col: '#302E2A' }, 
                    { c: 'JAP', p: 10, col: 'rgba(237,232,220,0.2)' }, 
                    { c: 'BRA', p: 10, col: 'rgba(237,232,220,0.1)' } 
                  ].map((country, i) => (
                    <motion.div 
                      key={country.c} whileHover="hover" initial="hidden" whileInView="rest" viewport={{ once: true }} animate="rest"
                      variants={{
                        hidden: { width: "0%", opacity: 0 },
                        rest: { width: `${country.p}%`, opacity: 1, transition: { duration: 1.2, delay: i * 0.1, ease: FINE_ART_EASE } }
                      }}
                      style={{ height: '100%', position: 'relative', cursor: 'crosshair', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                       <motion.div 
                         variants={{ 
                           hidden: { backgroundColor: country.col },
                           rest: { backgroundColor: country.col, scaleY: 1, zIndex: 1 }, 
                           hover: { backgroundColor: '#BF8F3C', scaleY: 1.4, zIndex: 10, boxShadow: '0 0 15px rgba(191,143,60,0.5)' } 
                         }}
                         transition={{ duration: 0.2 }}
                         style={{ width: '100%', height: '100%', transformOrigin: 'center' }}
                       />
                    </motion.div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 8px' }}>
                   {[ { c: 'EUA', p: 40 }, { c: 'FRA', p: 25 }, { c: 'ITA', p: 15 }, { c: 'JAP', p: 10 }, { c: 'BRA', p: 10 } ].map((country, i) => (
                     <motion.div key={i} whileHover="hover" initial="rest" animate="rest" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'crosshair' }}>
                       <motion.span variants={{ rest: { color: '#8C8880', y: 0 }, hover: { color: '#BF8F3C', y: -2 } }} transition={{ duration: 0.2 }} style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.1em' }}>{country.c}</motion.span>
                       <motion.span variants={{ rest: { color: '#565450' }, hover: { color: '#EDE8DC' } }} transition={{ duration: 0.2 }} style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px' }}>{country.p}%</motion.span>
                     </motion.div>
                   ))}
                </div>
              </div>
            </motion.div>

            {/* 6. Frequência de Projeção */}
            <motion.div variants={itemVariants}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 40 }}>
                <Activity style={{ width: 24, height: 24, color: '#BF8F3C' }} />
                <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.5rem', margin: 0, color: '#EDE8DC' }}>Frequência Semanal</h2>
              </div>
              <div style={{ height: 180, display: 'flex', alignItems: 'flex-end', gap: 16, borderBottom: '1px solid rgba(237,232,220,0.2)', paddingBottom: 8 }}>
                {[40, 60, 30, 80, 100, 50, 70].map((h, i) => (
                  <motion.div key={i} whileHover="hover" initial="rest" animate="rest" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, height: '100%', cursor: 'crosshair' }}>
                    <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end', position: 'relative', justifyContent: 'center' }}>
                      <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 10, height: '100%', backgroundColor: 'rgba(237,232,220,0.05)', borderRadius: 2 }} />
                      <motion.div 
                        /* Colunas largas (10px) e Prata Metálico para garantir leitura */
                        variants={{ 
                          rest: { backgroundColor: '#A3A098', scaleX: 1, boxShadow: 'none' }, 
                          hover: { backgroundColor: '#BF8F3C', scaleX: 1.4, boxShadow: '0 0 15px rgba(191,143,60,0.6)' } 
                        }}
                        initial={{ height: 0 }} whileInView={{ height: `${h}%` }} viewport={{ once: true }} 
                        transition={{ height: { duration: 1, delay: i * 0.1, ease: FINE_ART_EASE }, default: { duration: 0.2 } }}
                        style={{ position: 'relative', width: 10, borderRadius: 2, transformOrigin: 'bottom' }}
                      />
                    </div>
                    <motion.span variants={{ rest: { color: '#8C8880', y: 0 }, hover: { color: '#BF8F3C', y: -2 } }} transition={{ duration: 0.2 }} style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', letterSpacing: '0.1em' }}>
                      {['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB', 'DOM'][i]}
                    </motion.span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

          </div>

          {/* ── LISTAS E DIÁRIO TÉCNICO ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, marginBottom: 120 }}>
            <motion.div variants={itemVariants}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <Bookmark style={{ width: 24, height: 24, color: '#BF8F3C' }} />
                  <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.5rem', margin: 0, color: '#EDE8DC' }}>Diretórios Organizados</h2>
                </div>
                <motion.button 
                  onClick={() => setActiveModal('lists')}
                  whileHover={{ color: '#EDE8DC' }} whileTap={{ scale: 0.95 }}
                  style={{ background: 'transparent', border: 'none', color: '#565450', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', cursor: 'pointer', transition: 'color 0.3s' }}
                >
                  [ VER TODOS ]
                </motion.button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {[ { title: "FILMES ESSENCIAIS NOIR", count: "24 ARQUIVOS" }, { title: "REFERÊNCIAS DE CAMPANHA (D&D)", count: "18 ARQUIVOS" }, { title: "SESSÃO DUPLA: ANOS 70", count: "08 ARQUIVOS" } ].map((list, i) => (
                  <motion.button 
                    key={i} onClick={() => setActiveModal('lists')}
                    whileHover={{ backgroundColor: 'rgba(237,232,220,0.02)', paddingLeft: 16 }}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 0', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(237,232,220,0.05)', cursor: 'pointer', transition: 'all 0.3s' }}
                  >
                    <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.6rem', color: '#EDE8DC' }}>{list.title}</span>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#565450', letterSpacing: '0.15em' }}>{list.count}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>

            <motion.div variants={itemVariants}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <CalendarDays style={{ width: 24, height: 24, color: '#BF8F3C' }} />
                  <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.5rem', margin: 0, color: '#EDE8DC' }}>Registro Histórico</h2>
                </div>
                <motion.button 
                  onClick={() => setActiveModal('log')}
                  whileHover={{ color: '#EDE8DC' }} whileTap={{ scale: 0.95 }}
                  style={{ background: 'transparent', border: 'none', color: '#565450', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', cursor: 'pointer', transition: 'color 0.3s' }}
                >
                  [ ABRIR REGISTRO ]
                </motion.button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {[ { title: "O Sétimo Selo", date: "15 OUT", rating: "5.0", hasReview: true }, { title: "A Doce Vida", date: "12 OUT", rating: "4.0", hasReview: false }, { title: "Acossado", date: "10 OUT", rating: "4.5", hasReview: true }, { title: "Os Incompreendidos", date: "05 OUT", rating: "5.0", hasReview: true } ].map((entry, i) => (
                  <motion.button 
                    key={i} onClick={() => setActiveModal('log')}
                    whileHover={{ backgroundColor: 'rgba(237,232,220,0.02)', paddingLeft: 16 }}
                    style={{ display: 'grid', gridTemplateColumns: '60px 1fr auto 40px', gap: 16, alignItems: 'center', padding: '24px 0', border: 'none', borderBottom: '1px solid rgba(237,232,220,0.05)', background: 'transparent', cursor: 'pointer', transition: 'all 0.3s', textAlign: 'left' }}
                  >
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#565450', letterSpacing: '0.1em' }}>{entry.date}</span>
                    <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.4rem', color: '#EDE8DC' }}>{entry.title}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{entry.hasReview && <History style={{ width: 12, height: 12, color: '#8C8880' }} />}</div>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#BF8F3C', textAlign: 'right' }}>{entry.rating}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </div>

          {/* ── RODAPÉ DE AUDITORIA ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80 }}>
            
            <motion.div variants={itemVariants}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 40 }}>
                <Award style={{ width: 24, height: 24, color: '#BF8F3C' }} />
                <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.5rem', margin: 0, color: '#EDE8DC' }}>Certificações Obtidas</h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                {achievements.map((ach, i) => (
                  <motion.div 
                    key={i} onClick={() => { setSelectedAchievement(ach); setActiveModal('achievement'); }}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    style={{ position: 'relative', cursor: 'pointer', padding: 2, background: 'linear-gradient(135deg, rgba(191,143,60,0.4) 0%, rgba(191,143,60,0) 100%)' }}
                    className="group"
                  >
                    <div style={{ backgroundColor: '#040402', border: '1px dashed rgba(191,143,60,0.3)', padding: 24, height: '100%', display: 'flex', flexDirection: 'column', gap: 16, transition: 'all 0.4s' }} className="group-hover:bg-[#080806] group-hover:border-[rgba(191,143,60,0.6)]">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                        <div style={{ padding: 8, border: '1px solid rgba(191,143,60,0.2)', backgroundColor: 'rgba(191,143,60,0.05)' }}>
                          <ach.icon style={{ width: 20, height: 20, color: '#BF8F3C' }} />
                        </div>
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', color: '#565450' }}>[ CLICK PARA VER ]</span>
                      </div>
                      <div>
                        <h4 style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: '#EDE8DC', letterSpacing: '0.15em', marginBottom: 8 }}>{ach.title}</h4>
                        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', color: '#8C8880', letterSpacing: '0.1em', margin: 0 }}>{ach.desc}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div variants={itemVariants}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 40 }}>
                <TerminalSquare style={{ width: 24, height: 24, color: '#BF8F3C' }} />
                <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.5rem', margin: 0, color: '#EDE8DC' }}>Log do Sistema</h2>
              </div>
              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 32, paddingLeft: 16, borderLeft: '1px solid rgba(237,232,220,0.1)' }}>
                {[ { action: "SESSÃO CONCLUÍDA", target: "L'AVVENTURA", time: "ONTEM, 21:30", type: "system" }, { action: "DOWNLOAD COMPLETO", target: "SOLARIS (75.2 GB)", time: "HÁ 2 DIAS", type: "network" }, { action: "CERTIFICADO OBTIDO", target: "MARATONISTA", time: "HÁ 5 DIAS", type: "auth" } ].map((log, i) => (
                  <motion.div key={i} whileHover={{ x: 4 }} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 8, cursor: 'default' }}>
                    <div style={{ position: 'absolute', left: -20, top: 4, width: 7, height: 7, backgroundColor: '#080806', border: '1px solid #BF8F3C' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em' }}>
                      <span style={{ color: '#BF8F3C' }}>[{log.type.toUpperCase()}]</span>
                      <span style={{ color: '#565450' }}>{log.time}</span>
                    </div>
                    <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.6rem', color: '#EDE8DC', lineHeight: 1 }}>
                      <span style={{ color: '#8C8880', fontStyle: 'italic', marginRight: 8 }}>{log.action}:</span> {log.target}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

          </div>
        </motion.div>
      </main>

      {/* ── MODAIS INTERATIVOS (Arquitetura Blindada Anti-Bugs) ── */}
      <AnimatePresence>
        {activeModal && (
          <motion.div 
            key="modal-backdrop"
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            transition={{ duration: 0.3 }}
            onClick={() => setActiveModal(null)}
            style={{ 
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999999, 
              backgroundColor: 'rgba(4,4,2,0.85)', backdropFilter: 'blur(12px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px'
            }}
          >
            {/* A Caixa Principal (Física forçada direto no objeto, sem usar variants) */}
            <motion.div 
              initial={{ scale: 0.95, y: 20, opacity: 0 }} 
              animate={{ scale: 1, y: 0, opacity: 1 }} 
              exit={{ scale: 0.95, y: 20, opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
              onClick={(e) => e.stopPropagation()}
              style={{ 
                position: 'relative', width: '100%', maxWidth: 600, backgroundColor: '#040402', 
                border: '1px solid #BF8F3C', padding: '48px', boxShadow: '0 0 80px rgba(191,143,60,0.3)', 
                display: 'flex', flexDirection: 'column' 
              }}
            >
              <button onClick={() => setActiveModal(null)} style={{ position: 'absolute', top: 24, right: 24, background: 'transparent', border: 'none', color: '#565450', cursor: 'pointer', padding: 8 }}>
                <X style={{ width: 24, height: 24 }} />
              </button>

              {/* CONTEÚDO: EDITAR PERFIL */}
              {activeModal === 'edit' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#BF8F3C', letterSpacing: '0.2em' }}>[ ATUALIZAÇÃO DE DOSSIÊ ]</div>
                  <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '3rem', margin: 0, color: '#EDE8DC' }}>Dados do Operador</h2>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                    <div>
                      <label style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#8C8880', letterSpacing: '0.2em', display: 'block', marginBottom: 12 }}>NOME DE IDENTIFICAÇÃO</label>
                      <input 
                        type="text" value={draftName} onChange={(e) => setDraftName(e.target.value)}
                        style={{ width: '100%', background: 'rgba(237,232,220,0.02)', border: 'none', borderBottom: '1px solid #BF8F3C', padding: '16px', color: '#EDE8DC', fontFamily: "'DM Mono', monospace", fontSize: '14px', outline: 'none' }} 
                      />
                    </div>
                    <div>
                      <label style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#8C8880', letterSpacing: '0.2em', display: 'block', marginBottom: 12 }}>DADOS BIOGRÁFICOS / DESCRIÇÃO TÉCNICA</label>
                      <textarea 
                        value={draftBio} onChange={(e) => setDraftBio(e.target.value)} rows={4}
                        style={{ width: '100%', background: 'rgba(237,232,220,0.02)', border: 'none', borderBottom: '1px solid #BF8F3C', padding: '16px', color: '#EDE8DC', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.4rem', fontStyle: 'italic', outline: 'none', resize: 'none' }} 
                      />
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, marginTop: 16 }}>
                     <button onClick={() => setActiveModal(null)} style={{ background: 'transparent', border: '1px solid rgba(237,232,220,0.2)', color: '#EDE8DC', padding: '16px 24px', fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.2em', cursor: 'pointer' }}>[ CANCELAR ]</button>
                     <button onClick={handleSaveProfile} style={{ background: '#BF8F3C', border: '1px solid #BF8F3C', color: '#040402', padding: '16px 32px', fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.2em', cursor: 'pointer', fontWeight: 'bold' }}>[ GRAVAR ALTERAÇÕES ]</button>
                  </div>
                </div>
              )}

              {/* CONTEÚDO: CERTIFICADOS */}
              {activeModal === 'achievement' && selectedAchievement && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 32, alignItems: 'center', textAlign: 'center' }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#BF8F3C', letterSpacing: '0.2em' }}>[ AUTENTICAÇÃO DE MÉRITO CULTURAL ]</div>
                  <div style={{ position: 'relative', width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '16px 0' }}>
                     <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 20, ease: 'linear' }} style={{ position: 'absolute', inset: 0, border: '1px dashed rgba(191,143,60,0.5)', borderRadius: '50%' }} />
                     <motion.div animate={{ rotate: -360 }} transition={{ repeat: Infinity, duration: 15, ease: 'linear' }} style={{ position: 'absolute', inset: 8, border: '1px solid rgba(191,143,60,0.2)', borderRadius: '50%' }} />
                     <div style={{ width: 80, height: 80, backgroundColor: 'rgba(191,143,60,0.1)', border: '1px solid #BF8F3C', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                       <selectedAchievement.icon style={{ width: 32, height: 32, color: '#BF8F3C' }} />
                     </div>
                  </div>
                  <div>
                    <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '3.5rem', margin: '0 0 16px 0', color: '#EDE8DC', lineHeight: 1 }}>{selectedAchievement.title}</h2>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#BF8F3C', letterSpacing: '0.2em' }}>{selectedAchievement.desc}</span>
                  </div>
                  <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.6rem', color: '#8C8880', fontStyle: 'italic', lineHeight: 1.6, margin: 0, padding: '0 24px' }}>"{selectedAchievement.fullDesc}"</p>
                  <button onClick={() => setActiveModal(null)} style={{ background: 'transparent', border: '1px solid rgba(237,232,220,0.2)', color: '#EDE8DC', padding: '16px 32px', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', marginTop: 16, cursor: 'pointer' }}>[ FECHAR DOCUMENTO ]</button>
                </div>
              )}

              {/* CONTEÚDO: LISTAS E LOGS GENÉRICOS */}
              {(activeModal === 'lists' || activeModal === 'log') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#BF8F3C', letterSpacing: '0.2em' }}>[ ACESSO AO BANCO DE DADOS ]</div>
                  <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '3rem', margin: 0, color: '#EDE8DC' }}>
                    {activeModal === 'lists' ? 'Diretórios Completos' : 'Registro Integral'}
                  </h2>
                  <div style={{ height: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, border: '1px dashed rgba(237,232,220,0.1)', backgroundColor: 'rgba(237,232,220,0.02)' }}>
                    <motion.div animate={{ opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 1.5 }} style={{ width: 16, height: 16, backgroundColor: '#BF8F3C' }} />
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#565450', letterSpacing: '0.1em' }}>PULLING DATA FROM MAINFRAME...</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                     <button onClick={() => setActiveModal(null)} style={{ background: '#BF8F3C', border: 'none', color: '#040402', padding: '16px 32px', fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.2em', cursor: 'pointer', fontWeight: 'bold' }}>[ RETORNAR ]</button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}