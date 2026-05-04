'use client';
import { motion, AnimatePresence } from "framer-motion";
import { Users, Link as LinkIcon, Play, CalendarPlus, X, Search, TerminalSquare, Radio, CheckCircle2, Activity, Settings2, Share2, SkipBack, SkipForward, Pause, Volume2, Subtitles, Maximize } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

const FINE_ART_EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.1 } }
};

const fadeUpItem = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { duration: 0.8, ease: FINE_ART_EASE } }
};

// Tipagem das Mensagens de Log
type Message = {
  id: number;
  time: string;
  sender: string;
  isSelf: boolean;
  type: 'text' | 'poll';
  text?: string;
  poll?: {
    question: string;
    options: { label: string; votes: number }[];
    totalVotes: number;
    userVoted: number | null;
  };
};

export default function Party() {
  const router = useRouter();
  
  // Estados de Interface
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isTrailerOpen, setIsTrailerOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Estados do Chat e Enquete
  const [inputValue, setInputValue] = useState("");
  const [isCreatingPoll, setIsCreatingPoll] = useState(false);
  const [pollQ, setPollQ] = useState("");
  const [pollOpt1, setPollOpt1] = useState("");
  const [pollOpt2, setPollOpt2] = useState("");

  const [messages, setMessages] = useState<Message[]>([
    { id: 1, time: "01:10:05", sender: "ANA C.", isSelf: false, type: 'text', text: "A fotografia desse filme é absurda! A forma como ele enquadra o vazio..." },
    { id: 2, time: "01:11:20", sender: "VOCÊ", isSelf: true, type: 'text', text: "Sim. Especialmente nas cenas da ilha vulcânica." },
    { 
      id: 3, time: "01:12:40", sender: "CARLOS M.", isSelf: false, type: 'poll', 
      poll: { 
        question: "Análise do ritmo narrativo até o momento:", 
        options: [{ label: "LENTO, PORÉM HIPNÓTICO", votes: 3 }, { label: "EXCESSIVAMENTE PARADO", votes: 2 }], 
        totalVotes: 5, userVoted: null 
      } 
    }
  ]);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll sempre que uma mensagem nova entrar
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const users = [
    { id: "01", name: "VOCÊ", host: true, status: "SYNCED", avatar: "/images/perfil.jpg", pos: "52%" },
    { id: "02", name: "ANA C.", host: false, status: "SYNCED", avatar: "/images/avatar.png", pos: "51%" },
    { id: "03", name: "CARLOS M.", host: false, status: "BUFFERING", avatar: "/images/perfil.jpg", pos: "53%" },
  ];

  // Lógica de Comandos
  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;
    const now = new Date();
    const timeString = `01:14:${now.getSeconds().toString().padStart(2, '0')}`;
    
    setMessages(prev => [...prev, { id: Date.now(), time: timeString, sender: "VOCÊ", isSelf: true, type: 'text', text: inputValue }]);
    setInputValue("");
  };

  const handleSendPoll = () => {
    if (!pollQ.trim() || !pollOpt1.trim() || !pollOpt2.trim()) return;
    const now = new Date();
    const timeString = `01:14:${now.getSeconds().toString().padStart(2, '0')}`;
    
    setMessages(prev => [...prev, { 
      id: Date.now(), time: timeString, sender: "VOCÊ", isSelf: true, type: 'poll', 
      poll: { question: pollQ, options: [{ label: pollOpt1, votes: 0 }, { label: pollOpt2, votes: 0 }], totalVotes: 0, userVoted: null } 
    }]);
    
    setIsCreatingPoll(false);
    setPollQ(""); setPollOpt1(""); setPollOpt2("");
  };

  const handleVote = (msgId: number, optIndex: number) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id === msgId && msg.type === 'poll' && msg.poll && msg.poll.userVoted === null) {
        const newOptions = [...msg.poll.options];
        newOptions[optIndex].votes += 1;
        return { ...msg, poll: { ...msg.poll, options: newOptions, totalVotes: msg.poll.totalVotes + 1, userVoted: optIndex } };
      }
      return msg;
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSendMessage();
  };

  return (
    <div style={{ background: '#080806', color: '#EDE8DC', minHeight: '100dvh', display: 'flex', overflowX: 'hidden' }}>
      <div className="fixed inset-0 bg-noise opacity-[0.03] mix-blend-overlay pointer-events-none z-0" />

      {/* ── MODAL DO PLAYER DE REFERÊNCIA ── */}
      <AnimatePresence>
        {isTrailerOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px' }}>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
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
              
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 10, background: 'linear-gradient(to bottom, rgba(4,4,2,0.9), rgba(0,0,0,0))', opacity: 0, transition: 'opacity 0.3s' }} className="group-hover/player:opacity-100">
                <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#BF8F3C', letterSpacing: '0.2em', marginBottom: '8px' }}>[ SINAL DE VÍDEO ATIVO ]</div>
                  <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', color: '#EDE8DC', margin: 0 }}>L'Aventura - Projeção Integrada</h3>
                </motion.div>
                <motion.button 
                  onClick={() => setIsTrailerOpen(false)} 
                  whileHover={{ scale: 1.1, backgroundColor: 'rgba(191,143,60,0.1)', borderColor: '#BF8F3C', color: '#BF8F3C' }} whileTap={{ scale: 0.9 }}
                  style={{ background: 'rgba(0,0,0,0)', border: '1px solid #565450', padding: '12px', color: '#565450', cursor: 'pointer', transition: 'all 0.3s' }}
                >
                  <X style={{ width: 20, height: 20 }} />
                </motion.button>
              </div>

              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '32px', zIndex: 10, background: 'linear-gradient(to top, rgba(4,4,2,0.95), rgba(0,0,0,0))', opacity: 0, transition: 'opacity 0.3s', display: 'flex', flexDirection: 'column', gap: '24px' }} className="group-hover/player:opacity-100">
                <div style={{ width: '100%', height: '2px', backgroundColor: 'rgba(86,84,80,0.3)', position: 'relative', cursor: 'pointer' }} className="group/timeline">
                  <motion.div variants={{ rest: { height: 2, filter: 'brightness(1)' }, hover: { height: 4, filter: 'brightness(1.5)' } }} initial="rest" whileHover="hover" style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: 0, height: '2px', backgroundColor: '#BF8F3C', width: '52%', boxShadow: '0 0 10px rgba(191,143,60,0.5)' }} />
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <motion.button whileHover={{ color: '#EDE8DC', scale: 1.1 }} whileTap={{ scale: 0.9 }} style={{ background: 'rgba(0,0,0,0)', border: 'none', color: '#8C8880', cursor: 'pointer' }}><SkipBack style={{ width: 20, height: 20 }} fill="currentColor" /></motion.button>
                      <motion.button whileHover={{ color: '#BF8F3C', scale: 1.1 }} whileTap={{ scale: 0.9 }} style={{ background: 'rgba(0,0,0,0)', border: 'none', color: '#EDE8DC', cursor: 'pointer' }}><Pause style={{ width: 32, height: 32 }} fill="currentColor" /></motion.button>
                      <motion.button whileHover={{ color: '#EDE8DC', scale: 1.1 }} whileTap={{ scale: 0.9 }} style={{ background: 'rgba(0,0,0,0)', border: 'none', color: '#8C8880', cursor: 'pointer' }}><SkipForward style={{ width: 20, height: 20 }} fill="currentColor" /></motion.button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', borderLeft: '1px solid rgba(86,84,80,0.3)', paddingLeft: '32px' }}>
                      <Volume2 style={{ width: 16, height: 16, color: '#8C8880' }} />
                      <div style={{ width: '96px', height: '1px', backgroundColor: 'rgba(86,84,80,0.3)', position: 'relative' }}><div style={{ width: '66%', height: '100%', backgroundColor: '#EDE8DC', boxShadow: '0 0 5px rgba(237,232,220,0.5)' }} /></div>
                    </div>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#565450', letterSpacing: '0.1em', marginLeft: '16px' }}>01:14:20 / 02:23:00</span>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <motion.button whileHover={{ color: '#EDE8DC' }} style={{ background: 'rgba(0,0,0,0)', border: 'none', color: '#8C8880', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}><Settings2 style={{ width: 16, height: 16 }} /> [ AUDIO ]</motion.button>
                    <motion.button whileHover={{ color: '#EDE8DC' }} style={{ background: 'rgba(0,0,0,0)', border: 'none', color: '#8C8880', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}><Subtitles style={{ width: 16, height: 16 }} /> [ LEG ]</motion.button>
                    <div style={{ height: '16px', width: '1px', backgroundColor: 'rgba(86,84,80,0.3)' }} />
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#BF8F3C', letterSpacing: '0.15em', border: '1px solid #BF8F3C', padding: '4px 8px', backgroundColor: 'rgba(191,143,60,0.1)' }}>4K HDR</span>
                    <motion.button whileHover={{ color: '#EDE8DC', scale: 1.1 }} whileTap={{ scale: 0.9 }} style={{ background: 'rgba(0,0,0,0)', border: 'none', color: '#8C8880', cursor: 'pointer', marginLeft: '8px' }}><Maximize style={{ width: 20, height: 20 }} /></motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL DE AGENDAMENTO ── */}
      <AnimatePresence>
        {isScheduleOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px' }}>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
              onClick={() => setIsScheduleOpen(false)}
              style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(4,4,2,0.9)', backdropFilter: 'blur(12px)', cursor: 'pointer', zIndex: 0 }} 
            />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} transition={{ duration: 0.4, ease: FINE_ART_EASE }}
              onClick={(e) => e.stopPropagation()}
              style={{ position: 'relative', width: '100%', maxWidth: '600px', backgroundColor: '#040402', border: '1px solid #BF8F3C', padding: '48px', boxShadow: '0 0 80px rgba(0,0,0,0.8)', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '32px' }}
            >
              <button onClick={() => setIsScheduleOpen(false)} style={{ position: 'absolute', top: 24, right: 24, background: 'rgba(0,0,0,0)', border: 'none', color: '#565450', cursor: 'pointer', padding: '8px', transition: 'color 0.3s' }} onMouseEnter={e => e.currentTarget.style.color = '#EDE8DC'} onMouseLeave={e => e.currentTarget.style.color = '#565450'}>
                <X style={{ width: 20, height: 20 }} />
              </button>

              <div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#BF8F3C', letterSpacing: '0.2em', marginBottom: '8px' }}>[ PROTOCOLO DE TRANSMISSÃO ]</div>
                <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '3rem', color: '#EDE8DC', margin: 0 }}>Agendar Projeção</h2>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                <div>
                  <label style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#8C8880', letterSpacing: '0.2em', display: 'block', marginBottom: '12px' }}>TÍTULO DA SESSÃO</label>
                  <input type="text" placeholder="EX: ANÁLISE DE KUBRICK" style={{ width: '100%', background: 'rgba(237,232,220,0.02)', border: 'none', borderBottom: '1px solid #565450', padding: '16px', color: '#EDE8DC', fontFamily: "'DM Mono', monospace", fontSize: '12px', letterSpacing: '0.1em', outline: 'none', transition: 'border-color 0.3s' }} onFocus={e => e.currentTarget.style.borderColor = '#BF8F3C'} onBlur={e => e.currentTarget.style.borderColor = '#565450'} />
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                  <div>
                    <label style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#8C8880', letterSpacing: '0.2em', display: 'block', marginBottom: '12px' }}>DATA TEMPORAL</label>
                    <input type="date" style={{ width: '100%', background: 'rgba(237,232,220,0.02)', border: 'none', borderBottom: '1px solid #565450', padding: '16px', color: '#8C8880', fontFamily: "'DM Mono', monospace", fontSize: '12px', outline: 'none', colorScheme: 'dark' }} />
                  </div>
                  <div>
                    <label style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#8C8880', letterSpacing: '0.2em', display: 'block', marginBottom: '12px' }}>HORÁRIO DE INÍCIO</label>
                    <input type="time" style={{ width: '100%', background: 'rgba(237,232,220,0.02)', border: 'none', borderBottom: '1px solid #565450', padding: '16px', color: '#8C8880', fontFamily: "'DM Mono', monospace", fontSize: '12px', outline: 'none', colorScheme: 'dark' }} />
                  </div>
                </div>

                <div>
                  <label style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#8C8880', letterSpacing: '0.2em', display: 'block', marginBottom: '12px' }}>CÓDIGO DA OBRA</label>
                  <motion.button whileHover={{ borderColor: '#BF8F3C', color: '#EDE8DC' }} whileTap={{ scale: 0.98 }} style={{ width: '100%', background: 'rgba(237,232,220,0.02)', border: '1px dashed #565450', padding: '24px', color: '#565450', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', transition: 'all 0.3s' }}>
                    <Search style={{ width: 16, height: 16 }} /> [ BUSCAR DIRETÓRIO DE MÍDIA ]
                  </motion.button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginTop: '16px' }}>
                <motion.button onClick={() => setIsScheduleOpen(false)} whileHover={{ backgroundColor: 'rgba(237,232,220,0.05)' }} whileTap={{ scale: 0.95 }} style={{ background: 'rgba(0,0,0,0)', border: '1px solid rgba(86,84,80,0.5)', color: '#EDE8DC', padding: '16px 24px', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', cursor: 'pointer' }}>[ CANCELAR ]</motion.button>
                <motion.button whileHover={{ backgroundColor: 'rgba(0,0,0,0)', color: '#BF8F3C' }} whileTap={{ scale: 0.95 }} style={{ background: '#BF8F3C', border: '1px solid #BF8F3C', color: '#040402', padding: '16px 32px', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', fontWeight: 'bold', cursor: 'pointer' }}>[ CONFIRMAR AGENDAMENTO ]</motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <main style={{ flex: 1, minWidth: 0, position: 'relative', paddingLeft: '80px' }}>
        
        {/* CONTAINER PRINCIPAL */}
        <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '96px 72px 120px', position: 'relative', zIndex: 10 }}>
          
          {/* HEADER DA SESSÃO */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: FINE_ART_EASE }} style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '80px', borderBottom: '1px solid rgba(86,84,80,0.3)', paddingBottom: '32px' }}>
            <div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#BF8F3C', letterSpacing: '0.2em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <motion.div animate={{ opacity: [1, 0.2, 1] }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }} style={{ width: 6, height: 6, backgroundColor: '#BF8F3C', borderRadius: '50%' }} />
                [ REDE DE CURADORIA CONECTADA ]
              </div>
              <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(3rem, 5vw, 5rem)', fontWeight: 400, color: '#EDE8DC', margin: 0, lineHeight: 1, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '24px' }}>
                <TerminalSquare style={{ width: 48, height: 48, color: '#565450' }} /> Sessão em Conjunto
              </h1>
            </div>

            <div style={{ display: 'flex', gap: '16px' }}>
              <motion.button 
                onClick={() => setIsScheduleOpen(true)}
                whileHover={{ backgroundColor: '#BF8F3C', color: '#040402' }} whileTap={{ scale: 0.98 }}
                style={{ background: 'rgba(0,0,0,0)', border: '1px solid #BF8F3C', color: '#BF8F3C', padding: '16px 24px', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.3s' }}
              >
                <CalendarPlus style={{ width: 14, height: 14 }} /> [ AGENDAR SESSÃO ]
              </motion.button>
              
              <motion.button 
                onClick={handleCopyLink}
                whileHover={{ backgroundColor: linkCopied ? '#8C8880' : '#EDE8DC', color: '#040402', borderColor: linkCopied ? '#8C8880' : '#EDE8DC' }} whileTap={{ scale: 0.98 }}
                style={{ background: linkCopied ? '#8C8880' : 'rgba(0,0,0,0)', border: `1px solid ${linkCopied ? '#8C8880' : '#565450'}`, color: linkCopied ? '#040402' : '#EDE8DC', padding: '16px 24px', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.3s' }}
              >
                <LinkIcon style={{ width: 14, height: 14 }} /> {linkCopied ? '[ Link Copiado ]' : '[ Copiar Link ]'}
              </motion.button>
            </div>
          </motion.div>

          {/* GRID PRINCIPAL */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 450px', gap: '64px', alignItems: 'start' }}>
            
            {/* ── PAINEL ESQUERDO: CONTROLE DE PROJEÇÃO ── */}
            <motion.div variants={staggerContainer} initial="hidden" animate="visible" style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
              
              <motion.div variants={fadeUpItem} style={{ border: '1px solid rgba(191,143,60,0.3)', backgroundColor: '#040402', padding: '48px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: '50%', width: '600px', height: '600px', backgroundColor: 'rgba(191,143,60,0.03)', borderRadius: '50%', filter: 'blur(100px)', pointerEvents: 'none', transform: 'translate(-50%, -50%)' }} />
                
                <div style={{ display: 'flex', gap: '48px' }}>
                  <div style={{ width: '240px', flexShrink: 0 }}>
                    <div style={{ position: 'relative', aspectRatio: '2/3', backgroundColor: '#080806', border: '1px solid rgba(86,84,80,0.3)', padding: '4px', overflow: 'hidden', boxShadow: '0 0 40px rgba(0,0,0,0.8)' }} className="group">
                      <img src="/images/poster-1.png" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(100%) contrast(125%)' }} alt="Poster" />
                    </div>
                  </div>
                  
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingTop: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#BF8F3C', letterSpacing: '0.2em', marginBottom: '24px', backgroundColor: 'rgba(191,143,60,0.05)', border: '1px solid rgba(191,143,60,0.2)', padding: '8px 16px', width: 'fit-content' }}>
                      <motion.div animate={{ opacity: [1, 0.2, 1] }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }} style={{ width: 6, height: 6, backgroundColor: '#BF8F3C', borderRadius: '50%' }} />
                      SINAL DE TRANSMISSÃO ATIVO
                    </div>
                    
                    <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '5rem', color: '#EDE8DC', margin: '0 0 8px 0', lineHeight: 1 }}>L'Aventura</h2>
                    <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#8C8880', letterSpacing: '0.1em', margin: '0 0 48px 0', textTransform: 'uppercase' }}>1960 • MICHELANGELO ANTONIONI</p>
                    
                    {/* TIMELINE DE PRECISÃO */}
                    <div style={{ marginTop: 'auto' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#8C8880', letterSpacing: '0.1em', marginBottom: '16px' }}>
                        <span style={{ color: '#EDE8DC' }}>01:14:20:05</span>
                        <span>02:23:00:00</span>
                      </div>
                      <div style={{ width: '100%', height: '2px', backgroundColor: 'rgba(86,84,80,0.3)', position: 'relative', cursor: 'crosshair' }} className="group/progress">
                        <motion.div style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: 0, height: '100%', backgroundColor: '#BF8F3C', width: '52%', boxShadow: '0 0 10px rgba(191,143,60,0.5)', transition: 'height 0.2s' }} className="group-hover/progress:h-1" />
                        
                        <div style={{ position: 'absolute', top: '-4px', bottom: '-4px', left: '51%', width: '2px', backgroundColor: '#565450' }} title="Ana C." />
                        <div style={{ position: 'absolute', top: '-4px', bottom: '-4px', left: '53%', width: '2px', backgroundColor: '#8C8880' }} title="Carlos M." />
                      </div>
                    </div>

                    {/* Botões de Ação */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '48px' }}>
                      <motion.button 
                        onClick={() => setIsTrailerOpen(true)}
                        whileHover={{ scale: 1.05, backgroundColor: '#BF8F3C', color: '#040402' }} whileTap={{ scale: 0.95 }}
                        style={{ width: '64px', height: '64px', backgroundColor: 'rgba(0,0,0,0)', border: '1px solid #BF8F3C', color: '#BF8F3C', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.3s' }}
                      >
                        <Play style={{ width: 24, height: 24, marginLeft: '4px' }} fill="currentColor" />
                      </motion.button>
                      <motion.button 
                        whileHover={{ backgroundColor: '#EDE8DC', color: '#040402' }} whileTap={{ scale: 0.98 }}
                        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0)', border: '1px solid #565450', color: '#EDE8DC', padding: '0 24px', height: '64px', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', cursor: 'pointer', transition: 'all 0.3s' }}
                      >
                        <LinkIcon style={{ width: 14, height: 14 }} /> [ FORÇAR SINCRONIA MESTRE ]
                      </motion.button>
                      <motion.button 
                        onClick={() => router.push('/settings')}
                        whileHover={{ borderColor: '#EDE8DC', color: '#EDE8DC', scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        style={{ width: '64px', height: '64px', backgroundColor: 'rgba(0,0,0,0)', border: '1px solid #565450', color: '#8C8880', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.3s' }}
                      >
                        <Settings2 style={{ width: 18, height: 18 }} />
                      </motion.button>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Status Rede */}
              <motion.div variants={fadeUpItem} style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(86,84,80,0.3)', borderBottom: '1px solid rgba(86,84,80,0.3)', padding: '24px 0', fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#565450', letterSpacing: '0.15em' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Activity style={{ width: 12, height: 12 }} /> LARGURA DE BANDA: 85 MBPS</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 style={{ width: 12, height: 12 }} /> LATÊNCIA MÉDIA: 12MS</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Share2 style={{ width: 12, height: 12 }} /> PEERS CONECTADOS: 03</span>
              </motion.div>

            </motion.div>

            {/* ── PAINEL DIREITO: REGISTRO DE COMUNICAÇÃO ── */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4, duration: 0.8, ease: FINE_ART_EASE }} style={{ border: '1px solid rgba(86,84,80,0.3)', backgroundColor: '#040402', display: 'flex', flexDirection: 'column', height: '800px' }}>
              
              {/* Cabeçalho: Operadores */}
              <div style={{ padding: '24px', borderBottom: '1px solid rgba(86,84,80,0.3)', backgroundColor: '#080806' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                  <Users style={{ width: 16, height: 16, color: '#BF8F3C' }} />
                  <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.8rem', color: '#EDE8DC', margin: 0 }}>Cinéfilos Conectados</h3>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {users.map((user) => (
                    <motion.div whileHover={{ x: 4, backgroundColor: 'rgba(237,232,220,0.05)' }} key={user.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px', border: '1px solid rgba(86,84,80,0.2)', backgroundColor: 'rgba(237,232,220,0.02)', cursor: 'crosshair', transition: 'all 0.2s' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ position: 'relative', width: '32px', height: '32px', filter: 'grayscale(100%)', border: '1px solid rgba(86,84,80,0.5)', overflow: 'hidden' }}>
                          <img src={user.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#EDE8DC', letterSpacing: '0.15em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {user.name} 
                            {user.host && <span style={{ color: '#BF8F3C', border: '1px solid #BF8F3C', padding: '2px 4px', fontSize: '7px' }}>ADMIN</span>}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', color: user.status === 'SYNCED' ? '#565450' : '#BF8F3C', letterSpacing: '0.1em' }}>{user.pos}</span>
                        <motion.div animate={{ opacity: user.status === 'SYNCED' ? 1 : [1, 0.2, 1] }} transition={{ repeat: Infinity, duration: 1 }} style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: user.status === 'SYNCED' ? '#8C8880' : '#BF8F3C' }} />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Corpo: Transcrição */}
              <div style={{ flex: 1, padding: '32px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ textAlign: 'center', fontFamily: "'DM Mono', monospace", fontSize: '8px', color: '#565450', letterSpacing: '0.2em', borderBottom: '1px dashed rgba(86,84,80,0.3)', paddingBottom: '16px', marginBottom: '8px' }}>
                  [20:00:00] SYSTEM: INÍCIO DA TRANSMISSÃO SIMULTÂNEA
                </div>
                
                <AnimatePresence initial={false}>
                  {messages.map((msg) => (
                    <motion.div 
                      key={msg.id} layout initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.3 }}
                      style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', fontFamily: "'DM Mono', monospace", letterSpacing: '0.1em' }}>
                        <span style={{ fontSize: '9px', color: '#565450' }}>[{msg.time}]</span>
                        <span style={{ fontSize: '10px', color: msg.isSelf ? '#BF8F3C' : '#8C8880', fontWeight: 'bold' }}>{msg.sender}</span>
                      </div>
                      
                      {msg.type === 'text' && (
                        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.6rem', color: msg.isSelf ? '#BF8F3C' : '#EDE8DC', fontStyle: 'italic', paddingLeft: '62px' }}>
                          "{msg.text}"
                        </div>
                      )}

                      {msg.type === 'poll' && msg.poll && (
                        <div style={{ marginLeft: '62px', border: '1px solid rgba(86,84,80,0.5)', padding: '24px', backgroundColor: '#080806' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#8C8880', letterSpacing: '0.15em', marginBottom: '16px' }}>
                            <Activity style={{ width: 12, height: 12 }} /> [ Enquete ]
                          </div>
                          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.8rem', color: '#EDE8DC', margin: '0 0 24px 0' }}>{msg.poll.question}</p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {msg.poll.options.map((opt, i) => {
                              const percent = msg.poll!.totalVotes > 0 ? Math.round((opt.votes / msg.poll!.totalVotes) * 100) : 0;
                              const isVoted = msg.poll!.userVoted === i;
                              
                              return (
                                <motion.button 
                                  key={i} onClick={() => handleVote(msg.id, i)}
                                  whileHover={msg.poll!.userVoted === null ? { scale: 1.01, borderColor: '#EDE8DC' } : {}} whileTap={msg.poll!.userVoted === null ? { scale: 0.98 } : {}}
                                  style={{ width: '100%', background: 'rgba(0,0,0,0)', border: `1px solid ${isVoted ? '#BF8F3C' : 'rgba(86,84,80,0.5)'}`, position: 'relative', overflow: 'hidden', padding: '12px 16px', textAlign: 'left', cursor: msg.poll!.userVoted === null ? 'pointer' : 'default' }}
                                >
                                  <motion.div animate={{ width: `${percent}%` }} style={{ position: 'absolute', top: 0, left: 0, bottom: 0, backgroundColor: isVoted ? 'rgba(191,143,60,0.3)' : 'rgba(86,84,80,0.2)', zIndex: 0, transition: 'all 0.5s ease-out' }} />
                                  <span style={{ position: 'relative', zIndex: 1, fontFamily: "'DM Mono', monospace", fontSize: '9px', color: isVoted ? '#BF8F3C' : '#EDE8DC', letterSpacing: '0.1em', display: 'flex', justifyContent: 'space-between' }}>
                                    {opt.label.toUpperCase()} <span>{percent}%</span>
                                  </span>
                                </motion.button>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
                <div ref={chatEndRef} />
              </div>

              {/* Rodapé: Input & Criação de Enquete */}
              <div style={{ borderTop: '1px solid rgba(86,84,80,0.3)', backgroundColor: '#080806', padding: '24px' }}>
                
                {isCreatingPoll ? (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#BF8F3C', letterSpacing: '0.2em' }}>[ MODO DE Enquete ATIVO ]</div>
                    <input autoFocus value={pollQ} onChange={e => setPollQ(e.target.value)} placeholder="TÓPICO DA Enquete..." style={{ width: '100%', background: 'rgba(237,232,220,0.02)', border: '1px solid rgba(86,84,80,0.5)', color: '#EDE8DC', padding: '16px', fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.1em', outline: 'none' }} />
                    <div style={{ display: 'flex', gap: '16px' }}>
                      <input value={pollOpt1} onChange={e => setPollOpt1(e.target.value)} placeholder="PARÂMETRO A" style={{ flex: 1, background: 'rgba(237,232,220,0.02)', border: '1px solid rgba(86,84,80,0.5)', color: '#EDE8DC', padding: '16px', fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.1em', outline: 'none' }} />
                      <input value={pollOpt2} onChange={e => setPollOpt2(e.target.value)} placeholder="PARÂMETRO B" style={{ flex: 1, background: 'rgba(237,232,220,0.02)', border: '1px solid rgba(86,84,80,0.5)', color: '#EDE8DC', padding: '16px', fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.1em', outline: 'none' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginTop: '8px' }}>
                      <button onClick={() => setIsCreatingPoll(false)} style={{ background: 'rgba(0,0,0,0)', border: 'none', color: '#8C8880', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.1em', cursor: 'pointer' }}>[ ABORTAR ]</button>
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleSendPoll} style={{ background: '#BF8F3C', border: 'none', color: '#040402', padding: '12px 24px', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.1em', fontWeight: 'bold', cursor: 'pointer' }}>[ LANÇAR Enquete ]</motion.button>
                    </div>
                  </motion.div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', borderBottom: '1px solid rgba(191,143,60,0.5)', paddingBottom: '8px' }} className="group">
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '12px', color: '#BF8F3C', fontWeight: 'bold' }}>&gt;</span>
                      <input 
                        type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleKeyDown}
                        placeholder="REGISTRAR OBSERVAÇÃO..." 
                        style={{ flex: 1, background: 'rgba(0,0,0,0)', border: 'none', color: '#EDE8DC', fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.15em', outline: 'none' }}
                      />
                      <motion.button 
                        whileHover={{ color: '#EDE8DC' }} whileTap={{ scale: 0.95 }} onClick={handleSendMessage}
                        style={{ background: 'rgba(0,0,0,0)', border: 'none', color: inputValue.trim() ? '#BF8F3C' : '#565450', cursor: inputValue.trim() ? 'pointer' : 'default', transition: 'color 0.3s', fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.1em' }}
                      >
                        [ ENVIAR ]
                      </motion.button>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
                      <div style={{ display: 'flex', gap: '16px' }}>
                        <motion.button onClick={() => setIsCreatingPoll(true)} whileHover={{ color: '#EDE8DC', scale: 1.05 }} whileTap={{ scale: 0.95 }} style={{ background: 'rgba(0,0,0,0)', border: 'none', color: '#565450', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.1em', cursor: 'pointer', transition: 'color 0.3s' }}>[ + Enquete ]</motion.button>
                        <motion.button whileHover={{ color: '#EDE8DC', scale: 1.05 }} whileTap={{ scale: 0.95 }} style={{ background: 'rgba(0,0,0,0)', border: 'none', color: '#565450', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.1em', cursor: 'pointer', transition: 'color 0.3s' }}>[ + Sinal ]</motion.button>
                      </div>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', color: '#565450', letterSpacing: '0.1em' }}>[ ENTER ] PARA CONFIRMAR</span>
                    </div>
                  </>
                )}
              </div>

            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}