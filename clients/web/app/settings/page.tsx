'use client';
import { motion, AnimatePresence } from "framer-motion";
import { Server, DownloadCloud, Tv, Key, Shield, Bell, Type, Palette, ArrowRight, Check, Copy, ChevronDown } from "lucide-react";
import { useState, useEffect } from "react";

const FINE_ART_EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

export default function Settings() {
  const [activeTab, setActiveTab] = useState("Reprodução"); // Começando em Reprodução para você testar

  // ── ESTADOS GLOBAIS (Prontos para o Backend) ──

  // Relógio do Sistema
  const [systemTime, setSystemTime] = useState("00:00:00");
  useEffect(() => {
    const interval = setInterval(() => {
      const d = new Date();
      setSystemTime(d.toLocaleTimeString('pt-BR', { hour12: false }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Toggles de Sistema
  const [toggles, setToggles] = useState({
    fxCinematic: true,
    scrobbleTrakt: true,
    telemetry: false,
    notifDownload: true,
    notifError: true,
    autoPlayNext: true,
    skipIntro: false
  });

  const handleToggle = (key: keyof typeof toggles) => {
    setToggles(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Efeito de Cópia
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copyToClipboard = (id: string) => {
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // ── ESTADOS DA ABA: REPRODUÇÃO ──
  const [playbackPrefs, setPlaybackPrefs] = useState({
    quality: "4K HDR REMUX",
    audio: "TRUEHD / DTS-HD MA",
    limit: "100 GB / FILME"
  });
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const toggleDropdown = (id: string) => {
    setOpenDropdown(prev => prev === id ? null : id);
  };

  // ── ESTADOS DA ABA: LEGENDAS ──
  const [subPrefs, setSubPrefs] = useState({
    size: 40,
    opacity: 40,
    color: '#FFFFFF'
  });


  // ── ESTRUTURA DE NAVEGAÇÃO ──
  const menuItems = [
    { icon: Server, label: "Conexões" },
    { icon: DownloadCloud, label: "Provedores" },
    { icon: Tv, label: "Reprodução" },
    { icon: Palette, label: "Aparência" },
    { icon: Type, label: "Legendas" },
    { icon: Key, label: "API Keys" },
    { icon: Shield, label: "Privacidade" },
    { icon: Bell, label: "Notificações" }
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#080806', color: '#EDE8DC', paddingBottom: 120 }}>
      <div className="fixed inset-0 bg-noise opacity-[0.03] mix-blend-overlay pointer-events-none z-50" />
      
      <main style={{ maxWidth: 1400, margin: '0 auto', padding: '120px 72px 0' }}>
        
        {/* ── CABEÇALHO DO PAINEL ── */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, ease: FINE_ART_EASE }}
          style={{ marginBottom: 80, borderBottom: '1px solid rgba(237,232,220,0.05)', paddingBottom: 40, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}
        >
          <div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#BF8F3C', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 16 }}>
              [ DIRETÓRIO DE CONFIGURAÇÃO ]
            </div>
            <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(4rem, 6vw, 5.5rem)', fontWeight: 400, margin: 0, lineHeight: 1, letterSpacing: '-0.02em' }}>
              Parâmetros do Sistema.
            </h1>
          </div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#565450', letterSpacing: '0.2em', textAlign: 'right' }}>
            <div style={{ marginBottom: 4 }}>TEMPO DE ATIVIDADE</div>
            <div style={{ color: '#BF8F3C' }}>{systemTime}</div>
          </div>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 80 }}>
          
          {/* ── MENU DE NAVEGAÇÃO LATERAL ── */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2, duration: 0.8, ease: FINE_ART_EASE }}
            style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            {menuItems.map((item) => {
              const isActive = activeTab === item.label;
              return (
                <motion.button 
                  key={item.label}
                  onClick={() => setActiveTab(item.label)}
                  animate={{ 
                    backgroundColor: isActive ? 'rgba(191,143,60,0.05)' : 'rgba(237,232,220,0)',
                    borderLeftColor: isActive ? '#BF8F3C' : 'rgba(191,143,60,0)',
                    color: isActive ? '#BF8F3C' : '#8C8880',
                    x: isActive ? 4 : 0
                  }}
                  whileHover={{ backgroundColor: isActive ? 'rgba(191,143,60,0.08)' : 'rgba(237,232,220,0.02)', x: 4 }}
                  transition={{ duration: 0.3 }}
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', 
                    border: 'none', borderLeft: '2px solid transparent', cursor: 'pointer', textAlign: 'left',
                    fontFamily: "'DM Mono', monospace", fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase'
                  }}
                >
                  <item.icon style={{ width: 16, height: 16, color: isActive ? '#BF8F3C' : '#565450' }} />
                  {item.label}
                </motion.button>
              )
            })}
          </motion.div>

          {/* ── CONTEÚDO TÉCNICO ── */}
          <div style={{ position: 'relative' }}>
            <AnimatePresence mode="wait">
              <motion.div 
                key={activeTab}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.4, ease: FINE_ART_EASE }}
                style={{ display: 'flex', flexDirection: 'column', gap: 64 }}
              >
                
                {/* ── REPRODUÇÃO (Totalmente Viva e Interativa) ── */}
                {activeTab === "Reprodução" && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 40 }}>
                      <Tv style={{ width: 24, height: 24, color: '#BF8F3C' }} />
                      <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '3rem', margin: 0, color: '#EDE8DC' }}>Preferências de Reprodução</h2>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      
                      {/* Menu 1: Qualidade Alvo */}
                      <div style={{ borderBottom: '1px solid rgba(237,232,220,0.05)' }}>
                        <motion.button 
                          onClick={() => toggleDropdown('quality')}
                          whileHover={{ backgroundColor: 'rgba(237,232,220,0.02)', x: 4 }}
                          style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr 40px', alignItems: 'center', padding: '24px 0', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                        >
                          <div>
                            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: '#EDE8DC', letterSpacing: '0.15em', marginBottom: 6 }}>QUALIDADE ALVO</div>
                            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', color: '#565450', letterSpacing: '0.1em' }}>AQUISIÇÃO PREFERENCIAL DO REAL-DEBRID</div>
                          </div>
                          <div style={{ textAlign: 'right', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', color: '#BF8F3C' }}>
                            [ {playbackPrefs.quality} ]
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', color: '#565450' }}>
                            <motion.div animate={{ rotate: openDropdown === 'quality' ? 180 : 0 }}><ChevronDown style={{ width: 16, height: 16 }} /></motion.div>
                          </div>
                        </motion.button>
                        <AnimatePresence>
                          {openDropdown === 'quality' && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 24 }}>
                                {["4K HDR REMUX", "4K WEB-DL", "1080P REMUX", "1080P WEB-DL"].map(opt => (
                                  <motion.button 
                                    key={opt} onClick={() => { setPlaybackPrefs(prev => ({...prev, quality: opt})); setOpenDropdown(null); }}
                                    whileHover={{ backgroundColor: 'rgba(191,143,60,0.05)', borderColor: '#BF8F3C' }}
                                    style={{ padding: '12px 16px', background: playbackPrefs.quality === opt ? 'rgba(191,143,60,0.1)' : 'transparent', border: playbackPrefs.quality === opt ? '1px solid #BF8F3C' : '1px solid rgba(237,232,220,0.05)', cursor: 'pointer', textAlign: 'left', fontFamily: "'DM Mono', monospace", fontSize: '10px', color: playbackPrefs.quality === opt ? '#EDE8DC' : '#8C8880', transition: 'all 0.2s' }}
                                  >
                                    {opt}
                                  </motion.button>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Menu 2: Prioridade de Áudio */}
                      <div style={{ borderBottom: '1px solid rgba(237,232,220,0.05)' }}>
                        <motion.button 
                          onClick={() => toggleDropdown('audio')}
                          whileHover={{ backgroundColor: 'rgba(237,232,220,0.02)', x: 4 }}
                          style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr 40px', alignItems: 'center', padding: '24px 0', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                        >
                          <div>
                            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: '#EDE8DC', letterSpacing: '0.15em', marginBottom: 6 }}>PRIORIDADE DE ÁUDIO</div>
                            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', color: '#565450', letterSpacing: '0.1em' }}>FORMATO PADRÃO SELECIONADO NO PLAYER</div>
                          </div>
                          <div style={{ textAlign: 'right', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', color: '#BF8F3C' }}>
                            [ {playbackPrefs.audio} ]
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', color: '#565450' }}>
                            <motion.div animate={{ rotate: openDropdown === 'audio' ? 180 : 0 }}><ChevronDown style={{ width: 16, height: 16 }} /></motion.div>
                          </div>
                        </motion.button>
                        <AnimatePresence>
                          {openDropdown === 'audio' && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 24 }}>
                                {["TRUEHD / DTS-HD MA", "E-AC3 / AC3 5.1", "AAC 2.0 (STEREO)"].map(opt => (
                                  <motion.button 
                                    key={opt} onClick={() => { setPlaybackPrefs(prev => ({...prev, audio: opt})); setOpenDropdown(null); }}
                                    whileHover={{ backgroundColor: 'rgba(191,143,60,0.05)', borderColor: '#BF8F3C' }}
                                    style={{ padding: '12px 16px', background: playbackPrefs.audio === opt ? 'rgba(191,143,60,0.1)' : 'transparent', border: playbackPrefs.audio === opt ? '1px solid #BF8F3C' : '1px solid rgba(237,232,220,0.05)', cursor: 'pointer', textAlign: 'left', fontFamily: "'DM Mono', monospace", fontSize: '10px', color: playbackPrefs.audio === opt ? '#EDE8DC' : '#8C8880', transition: 'all 0.2s' }}
                                  >
                                    {opt}
                                  </motion.button>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Menu 3: Limite de Tamanho */}
                      <div style={{ borderBottom: '1px solid rgba(237,232,220,0.05)' }}>
                        <motion.button 
                          onClick={() => toggleDropdown('limit')}
                          whileHover={{ backgroundColor: 'rgba(237,232,220,0.02)', x: 4 }}
                          style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr 40px', alignItems: 'center', padding: '24px 0', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                        >
                          <div>
                            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: '#EDE8DC', letterSpacing: '0.15em', marginBottom: 6 }}>LIMITE DE AQUISIÇÃO</div>
                            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', color: '#565450', letterSpacing: '0.1em' }}>TAMANHO MÁXIMO POR ARQUIVO DE FILME</div>
                          </div>
                          <div style={{ textAlign: 'right', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', color: '#BF8F3C' }}>
                            [ {playbackPrefs.limit} ]
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', color: '#565450' }}>
                            <motion.div animate={{ rotate: openDropdown === 'limit' ? 180 : 0 }}><ChevronDown style={{ width: 16, height: 16 }} /></motion.div>
                          </div>
                        </motion.button>
                        <AnimatePresence>
                          {openDropdown === 'limit' && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 24 }}>
                                {["SEM LIMITE", "100 GB / FILME", "50 GB / FILME", "20 GB / FILME"].map(opt => (
                                  <motion.button 
                                    key={opt} onClick={() => { setPlaybackPrefs(prev => ({...prev, limit: opt})); setOpenDropdown(null); }}
                                    whileHover={{ backgroundColor: 'rgba(191,143,60,0.05)', borderColor: '#BF8F3C' }}
                                    style={{ padding: '12px 16px', background: playbackPrefs.limit === opt ? 'rgba(191,143,60,0.1)' : 'transparent', border: playbackPrefs.limit === opt ? '1px solid #BF8F3C' : '1px solid rgba(237,232,220,0.05)', cursor: 'pointer', textAlign: 'left', fontFamily: "'DM Mono', monospace", fontSize: '10px', color: playbackPrefs.limit === opt ? '#EDE8DC' : '#8C8880', transition: 'all 0.2s' }}
                                  >
                                    {opt}
                                  </motion.button>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Toggles Extras */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '32px 0', borderBottom: '1px solid rgba(237,232,220,0.05)' }}>
                        <div>
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: '#EDE8DC', letterSpacing: '0.15em', marginBottom: 6 }}>REPRODUÇÃO AUTOMÁTICA</div>
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', color: '#565450', letterSpacing: '0.1em' }}>INICIAR PRÓXIMO EPISÓDIO DE SÉRIES AUTOMATICAMENTE.</div>
                        </div>
                        <motion.button onClick={() => handleToggle('autoPlayNext')} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} animate={{ color: toggles.autoPlayNext ? '#BF8F3C' : '#565450', borderColor: toggles.autoPlayNext ? '#BF8F3C' : '#565450' }} style={{ background: 'transparent', border: '1px solid', padding: '8px 16px', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', cursor: 'pointer' }}>
                          [ {toggles.autoPlayNext ? 'ON' : 'OFF'} ]
                        </motion.button>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '32px 0', borderBottom: '1px solid rgba(237,232,220,0.05)' }}>
                        <div>
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: '#EDE8DC', letterSpacing: '0.15em', marginBottom: 6 }}>PULAR ABERTURAS</div>
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', color: '#565450', letterSpacing: '0.1em' }}>PULA AUTOMATICAMENTE A INTRODUÇÃO SE MARCADA PELO SERVIDOR.</div>
                        </div>
                        <motion.button onClick={() => handleToggle('skipIntro')} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} animate={{ color: toggles.skipIntro ? '#BF8F3C' : '#565450', borderColor: toggles.skipIntro ? '#BF8F3C' : '#565450' }} style={{ background: 'transparent', border: '1px solid', padding: '8px 16px', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', cursor: 'pointer' }}>
                          [ {toggles.skipIntro ? 'ON' : 'OFF'} ]
                        </motion.button>
                      </div>

                    </div>
                  </div>
                )}

                {/* ── LEGENDAS (Interativas) ── */}
                {activeTab === "Legendas" && (
                   <div>
                     <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 40 }}>
                       <Type style={{ width: 24, height: 24, color: '#BF8F3C' }} />
                       <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '3rem', margin: 0, color: '#EDE8DC' }}>Renderização de Texto</h2>
                     </div>
                     
                     {/* O Preview Reage aos Sliders */}
                     <div style={{ aspectRatio: '21/9', width: '100%', backgroundColor: '#040402', border: '1px solid rgba(237,232,220,0.1)', marginBottom: 48, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: '5%' }}>
                       <img src="/images/poster-1.png" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(50%) contrast(1.2)', opacity: 0.5 }} alt="" />
                       
                       <motion.div animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ repeat: Infinity, duration: 4 }} style={{ position: 'absolute', inset: '5%', border: '1px dashed rgba(191,143,60,0.5)', pointerEvents: 'none' }}>
                          <span style={{ position: 'absolute', top: 4, left: 4, fontFamily: "'DM Mono', monospace", fontSize: '7px', color: 'rgba(191,143,60,0.8)', letterSpacing: '0.2em' }}>ACTION SAFE 90%</span>
                       </motion.div>
 
                       <p style={{ 
                         position: 'relative', zIndex: 10, fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic',
                         fontSize: `${subPrefs.size}px`, 
                         color: subPrefs.color, 
                         backgroundColor: `rgba(0,0,0,${subPrefs.opacity / 100})`, 
                         padding: '4px 16px', textShadow: '0 2px 10px rgba(0,0,0,0.8)' 
                       }}>
                         A ilha está completamente vazia.
                       </p>
                     </div>

                     <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
                        
                        {/* Fader de Escala (Invisível Input Trick) */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#565450', letterSpacing: '0.2em', textTransform: 'uppercase' }}>// ESCALA DA FONTE</span>
                            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#BF8F3C' }}>{subPrefs.size} PX</span>
                          </div>
                          <div style={{ width: '100%', height: 24, display: 'flex', alignItems: 'center', position: 'relative' }}>
                            <div style={{ width: '100%', height: 1, backgroundColor: 'rgba(237,232,220,0.1)' }} />
                            <div style={{ position: 'absolute', left: 0, height: 1, width: `${(subPrefs.size - 16) / (64 - 16) * 100}%`, backgroundColor: '#BF8F3C', pointerEvents: 'none' }} />
                            <div style={{ position: 'absolute', left: `${(subPrefs.size - 16) / (64 - 16) * 100}%`, width: 2, height: 12, backgroundColor: '#EDE8DC', transform: 'translate(-50%)', boxShadow: '0 0 5px rgba(237,232,220,0.5)', pointerEvents: 'none' }} />
                            <input 
                              type="range" min="16" max="64" value={subPrefs.size} 
                              onChange={(e) => setSubPrefs(prev => ({ ...prev, size: Number(e.target.value) }))}
                              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%' }}
                            />
                          </div>
                        </div>

                        {/* Fader de Fundo */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#565450', letterSpacing: '0.2em', textTransform: 'uppercase' }}>// OPACIDADE DO FUNDO</span>
                            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#BF8F3C' }}>{subPrefs.opacity} %</span>
                          </div>
                          <div style={{ width: '100%', height: 24, display: 'flex', alignItems: 'center', position: 'relative' }}>
                            <div style={{ width: '100%', height: 1, backgroundColor: 'rgba(237,232,220,0.1)' }} />
                            <div style={{ position: 'absolute', left: 0, height: 1, width: `${subPrefs.opacity}%`, backgroundColor: '#BF8F3C', pointerEvents: 'none' }} />
                            <div style={{ position: 'absolute', left: `${subPrefs.opacity}%`, width: 2, height: 12, backgroundColor: '#EDE8DC', transform: 'translate(-50%)', boxShadow: '0 0 5px rgba(237,232,220,0.5)', pointerEvents: 'none' }} />
                            <input 
                              type="range" min="0" max="100" value={subPrefs.opacity} 
                              onChange={(e) => setSubPrefs(prev => ({ ...prev, opacity: Number(e.target.value) }))}
                              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%' }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Cores */}
                      <div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#565450', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 24 }}>// PIGMENTAÇÃO DA FONTE</div>
                        <div style={{ display: 'flex', gap: 16 }}>
                          {[ '#FFFFFF', '#FACC15', '#22D3EE' ].map((hex) => {
                            const isActive = subPrefs.color === hex;
                            return (
                              <motion.button 
                                key={hex}
                                onClick={() => setSubPrefs(prev => ({ ...prev, color: hex }))}
                                whileHover={{ y: -4 }} whileTap={{ scale: 0.95 }}
                                style={{ 
                                  width: 40, height: 40, backgroundColor: hex, 
                                  border: isActive ? `2px solid #BF8F3C` : '1px solid rgba(237,232,220,0.2)',
                                  cursor: 'pointer', boxShadow: isActive ? '0 0 10px rgba(191,143,60,0.3)' : 'none'
                                }}
                              />
                            )
                          })}
                        </div>
                      </div>
                    </div>
                   </div>
                )}

                {/* ── APARÊNCIA ── */}
                {activeTab === "Aparência" && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 40 }}>
                      <Palette style={{ width: 24, height: 24, color: '#BF8F3C' }} />
                      <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '3rem', margin: 0, color: '#EDE8DC' }}>Calibração Visual</h2>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 64 }}>
                      <div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#565450', letterSpacing: '0.2em', marginBottom: 24 }}>// ESPECTRO DE COR (DESTAQUE)</div>
                        <div style={{ display: 'flex', gap: 24 }}>
                          {[ { name: 'OURO CINEMA', hex: '#BF8F3C', active: true }, { name: 'MONOCROMÁTICO', hex: '#EDE8DC', active: false }, { name: 'PÚRPURA NOIR', hex: '#6366f1', active: false } ].map(color => (
                            <motion.button key={color.name} whileHover={{ y: -4 }} whileTap={{ scale: 0.95 }} style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                              <div style={{ width: 48, height: 48, backgroundColor: color.hex, border: color.active ? `2px solid #EDE8DC` : '1px solid rgba(237,232,220,0.1)', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ width: '100%', height: '100%', border: `1px solid rgba(0,0,0,0.2)` }} />
                              </div>
                              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', color: color.active ? '#EDE8DC' : '#565450', letterSpacing: '0.1em' }}>{color.name}</span>
                            </motion.button>
                          ))}
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 24, borderBottom: '1px solid rgba(237,232,220,0.05)' }}>
                        <div>
                          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.6rem', color: '#EDE8DC', marginBottom: 8 }}>Efeitos Cinematográficos</div>
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#565450', letterSpacing: '0.1em' }}>HABILITA RUÍDO DE FILME, VIGNETTES E TRANSIÇÕES DE DESFOQUE NOS FUNDOS.</div>
                        </div>
                        <motion.button 
                          onClick={() => handleToggle('fxCinematic')}
                          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                          animate={{ color: toggles.fxCinematic ? '#BF8F3C' : '#565450', borderColor: toggles.fxCinematic ? '#BF8F3C' : '#565450' }}
                          style={{ background: 'transparent', border: '1px solid #BF8F3C', padding: '8px 16px', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', cursor: 'pointer' }}
                        >
                          [ {toggles.fxCinematic ? 'ON' : 'OFF'} ]
                        </motion.button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── API KEYS ── */}
                {activeTab === "API Keys" && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 40 }}>
                      <Key style={{ width: 24, height: 24, color: '#BF8F3C' }} />
                      <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '3rem', margin: 0, color: '#EDE8DC' }}>Autenticação</h2>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                      {[
                        { id: 'tmdb', name: 'TMDB V3 AUTH', prefix: 'eyJh...' },
                        { id: 'trakt', name: 'TRAKT.TV PIN', prefix: 'A7F9...' },
                        { id: 'osub', name: 'OPENSUBTITLES HASH', prefix: '98D2...' }
                      ].map(api => (
                        <div key={api.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 24, paddingBottom: 32, borderBottom: '1px solid rgba(237,232,220,0.05)' }}>
                          <div>
                            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#565450', letterSpacing: '0.2em', marginBottom: 12 }}>// {api.name}</div>
                            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '14px', color: '#EDE8DC', letterSpacing: '0.1em' }}>
                              {api.prefix}••••••••••••••••••••••••
                            </div>
                          </div>
                          
                          <div style={{ display: 'flex', gap: 16 }}>
                            <motion.button 
                              onClick={() => copyToClipboard(api.id)}
                              whileHover={{ color: '#BF8F3C', borderColor: '#BF8F3C' }} whileTap={{ scale: 0.95 }}
                              style={{ background: 'transparent', border: '1px solid rgba(237,232,220,0.2)', color: copiedKey === api.id ? '#10b981' : '#8C8880', padding: '12px 16px', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 8 }}
                            >
                              {copiedKey === api.id ? <Check style={{ width: 12, height: 12 }} /> : <Copy style={{ width: 12, height: 12 }} />}
                              [{copiedKey === api.id ? 'COPIADO' : 'COPIAR'}]
                            </motion.button>
                            <motion.button 
                              whileHover={{ color: '#040402', backgroundColor: '#BF8F3C', borderColor: '#BF8F3C' }} whileTap={{ scale: 0.95 }}
                              style={{ background: 'transparent', border: '1px solid rgba(191,143,60,0.4)', color: '#BF8F3C', padding: '12px 16px', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', cursor: 'pointer', transition: 'all 0.2s' }}
                            >
                              [ REGERAR ]
                            </motion.button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── PRIVACIDADE E TELEMETRIA ── */}
                {activeTab === "Privacidade" && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 40 }}>
                      <Shield style={{ width: 24, height: 24, color: '#BF8F3C' }} />
                      <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '3rem', margin: 0, color: '#EDE8DC' }}>Privacidade & Dados</h2>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 32, borderBottom: '1px solid rgba(237,232,220,0.05)' }}>
                        <div>
                          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.6rem', color: '#EDE8DC', marginBottom: 8 }}>Sincronização Trakt.tv (Scrobbling)</div>
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#565450', letterSpacing: '0.1em', maxWidth: 600, lineHeight: 1.6 }}>MARCA AUTOMATICAMENTE FILMES E SÉRIES COMO ASSISTIDOS NO SEU PERFIL DO TRAKT.TV.</div>
                        </div>
                        <motion.button onClick={() => handleToggle('scrobbleTrakt')} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} animate={{ color: toggles.scrobbleTrakt ? '#BF8F3C' : '#565450', borderColor: toggles.scrobbleTrakt ? '#BF8F3C' : '#565450' }} style={{ background: 'transparent', border: '1px solid', padding: '8px 16px', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', cursor: 'pointer' }}>
                          [ {toggles.scrobbleTrakt ? 'ON' : 'OFF'} ]
                        </motion.button>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 32, borderBottom: '1px solid rgba(237,232,220,0.05)' }}>
                        <div>
                          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.6rem', color: '#EDE8DC', marginBottom: 8 }}>Telemetria Anônima</div>
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#565450', letterSpacing: '0.1em', maxWidth: 600, lineHeight: 1.6 }}>ENVIA RELATÓRIOS DE CRASH E ESTATÍSTICAS DE DESEMPENHO DOS REPRODUTORES PARA MELHORIA DA PLATAFORMA.</div>
                        </div>
                        <motion.button onClick={() => handleToggle('telemetry')} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} animate={{ color: toggles.telemetry ? '#BF8F3C' : '#565450', borderColor: toggles.telemetry ? '#BF8F3C' : '#565450' }} style={{ background: 'transparent', border: '1px solid', padding: '8px 16px', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', cursor: 'pointer' }}>
                          [ {toggles.telemetry ? 'ON' : 'OFF'} ]
                        </motion.button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── NOTIFICAÇÕES ── */}
                {activeTab === "Notificações" && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 40 }}>
                      <Bell style={{ width: 24, height: 24, color: '#BF8F3C' }} />
                      <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '3rem', margin: 0, color: '#EDE8DC' }}>Sistema de Alertas</h2>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 32, borderBottom: '1px solid rgba(237,232,220,0.05)' }}>
                        <div>
                          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.6rem', color: '#EDE8DC', marginBottom: 8 }}>Integridade do Download</div>
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#565450', letterSpacing: '0.1em' }}>NOTIFICA QUANDO UM CACHE NO REAL-DEBRID FOR CONCLUÍDO.</div>
                        </div>
                        <motion.button onClick={() => handleToggle('notifDownload')} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} animate={{ color: toggles.notifDownload ? '#BF8F3C' : '#565450', borderColor: toggles.notifDownload ? '#BF8F3C' : '#565450' }} style={{ background: 'transparent', border: '1px solid', padding: '8px 16px', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', cursor: 'pointer' }}>
                          [ {toggles.notifDownload ? 'ON' : 'OFF'} ]
                        </motion.button>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 32, borderBottom: '1px solid rgba(237,232,220,0.05)' }}>
                        <div>
                          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.6rem', color: '#EDE8DC', marginBottom: 8 }}>Falhas de Comunicação</div>
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#565450', letterSpacing: '0.1em' }}>ALERTAS SOBRE INDISPONIBILIDADE DA API DO TMDB OU TIMEOUTS DE NÓS.</div>
                        </div>
                        <motion.button onClick={() => handleToggle('notifError')} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} animate={{ color: toggles.notifError ? '#BF8F3C' : '#565450', borderColor: toggles.notifError ? '#BF8F3C' : '#565450' }} style={{ background: 'transparent', border: '1px solid', padding: '8px 16px', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', cursor: 'pointer' }}>
                          [ {toggles.notifError ? 'ON' : 'OFF'} ]
                        </motion.button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── CONEXÕES E PROVEDORES ── */}
                {(activeTab === "Conexões" || activeTab === "Provedores") && (
                  <div>
                    {activeTab === "Conexões" ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 40 }}>
                        <Server style={{ width: 24, height: 24, color: '#BF8F3C' }} />
                        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '3rem', margin: 0, color: '#EDE8DC' }}>Servidor de Mídia</h2>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 40 }}>
                        <DownloadCloud style={{ width: 24, height: 24, color: '#BF8F3C' }} />
                        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '3rem', margin: 0, color: '#EDE8DC' }}>Integrações</h2>
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {(activeTab === "Conexões" ? [
                        { label: "PLEX MEDIA SERVER", value: "CONECTADO", status: "success", detail: "192.168.1.100:32400" },
                        { label: "JELLYFIN", value: "DESCONECTADO", status: "none", detail: "--" },
                        { label: "DIRETÓRIO BASE", value: "/MNT/MEDIA/MOVIES", status: "default", detail: "5.4 TB LIVRES" }
                      ] : [
                        { label: "REAL-DEBRID", value: "PREMIUM ATIVO", status: "success", detail: "EXPIRA EM 142 DIAS" },
                        { label: "ALLDEBRID", value: "NÃO CONFIGURADO", status: "none", detail: "--" },
                      ]).map((item, i) => (
                        <motion.button 
                          key={item.label}
                          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1, duration: 0.6, ease: FINE_ART_EASE }}
                          whileHover={{ backgroundColor: 'rgba(237,232,220,0.02)', x: 4 }}
                          whileTap={{ scale: 0.98 }}
                          style={{ 
                            display: 'grid', gridTemplateColumns: '1fr 1fr 40px', gap: 24, alignItems: 'center', 
                            padding: '24px 0', borderBottom: '1px solid rgba(237,232,220,0.05)',
                            background: 'transparent', borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                            cursor: 'pointer', textAlign: 'left'
                          }}
                        >
                          <div>
                            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: '#EDE8DC', letterSpacing: '0.15em', marginBottom: 6 }}>{item.label}</div>
                            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', color: '#565450', letterSpacing: '0.1em' }}>{item.detail}</div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                            {item.status === 'success' && <Check style={{ width: 12, height: 12, color: '#BF8F3C' }} />}
                            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', color: item.status === 'success' ? '#BF8F3C' : item.status === 'none' ? '#565450' : '#8C8880' }}>
                              [{item.value}]
                            </span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'flex-end', color: '#565450' }}>
                            <ArrowRight style={{ width: 16, height: 16 }} />
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}