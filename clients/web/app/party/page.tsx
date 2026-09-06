'use client';
import { motion, AnimatePresence } from "framer-motion";
import { FINE_ART_EASE } from '@/lib/motion';
import Image from 'next/image';
import { Users, Link as LinkIcon, Play, CalendarPlus, X, Search, TerminalSquare, Radio, CheckCircle2, Activity, Settings2, Share2, SkipBack, SkipForward, Pause, Volume2, Subtitles, Maximize } from "lucide-react";
import { http } from '@/services/http/client';
import { useSessaoRelevante } from '@/features/sessions/hooks/useSessoes';
import { useCriarConvite, useCriarSessao } from '@/features/sessions/hooks/useSessaoMutations';
import { useMovies } from '@/features/movies/hooks/useMovies';
import { useCanalDaSessao } from '@/features/sessions/hooks/useCanalDaSessao';
import type { Fala, Participante } from '@/features/sessions/hooks/useCanalDaSessao';
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";


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

/** Segundos em HH:MM:SS. */
function timecode(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos || 0));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
    .map((p) => String(p).padStart(2, '0')).join(':');
}

export default function Party() {
  const router = useRouter();
  
  // Estados de Interface
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);

  // O formulário de agendamento existia na tela com os campos soltos — sem
  // `value`, sem `onChange` — e o botão de confirmar sem `onClick`. Preencher
  // e confirmar não fazia absolutamente nada.
  const [novoTitulo, setNovoTitulo] = useState('');
  const [novaData, setNovaData] = useState('');
  const [novaHora, setNovaHora] = useState('20:00');
  const [buscaDeFilme, setBuscaDeFilme] = useState('');
  const [escolhidos, setEscolhidos] = useState<{ id: string; title: string }[]>([]);
  const [erroDoForm, setErroDoForm] = useState('');
  const [conviteGerado, setConviteGerado] = useState('');
  const [erroDoConvite, setErroDoConvite] = useState('');

  const criarSessao = useCriarSessao();
  const criarConvite = useCriarConvite();
  const { data: resultadosDaBusca } = useMovies(
    buscaDeFilme.length >= 3 ? { page: 1, search: buscaDeFilme } : { page: 1 });
  const [isTrailerOpen, setIsTrailerOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Estados do Chat e Enquete
  const [inputValue, setInputValue] = useState("");
  // A enquete existia como maquete — votos escritos no código, 3 contra 2, e
  // um botão que só mexia no estado local. Agora tem modelo no servidor, e o
  // voto sobrevive a recarregar a página.
  const [isCreatingPoll, setIsCreatingPoll] = useState(false);
  const [pollQ, setPollQ] = useState('');
  const [pollOpt1, setPollOpt1] = useState('');
  const [pollOpt2, setPollOpt2] = useState('');

  const handleSendPoll = () => {
    const alternativas = [pollOpt1, pollOpt2].map((o) => o.trim()).filter(Boolean);
    // Duas alternativas no mínimo: uma só não é enquete, é afirmação com
    // botão. O servidor recusa igual, mas avisar aqui poupa a ida.
    if (!pollQ.trim() || alternativas.length < 2) return;
    if (criaEnquete(pollQ.trim(), alternativas, minhaPosicao)) {
      setPollQ(''); setPollOpt1(''); setPollOpt2(''); setIsCreatingPoll(false);
    }
  };

  // A conversa vinha com três falas já digitadas — "ANA C." elogiando a
  // fotografia, uma resposta "sua" e uma enquete com 3 votos contra 2. Nada
  // disso existia no servidor. Agora chega pelo canal da sessão.
  // /upcoming/ exclui in_progress, e é justamente numa projeção em curso que
  // esta tela existe para servir — a sessão nunca era encontrada e o canal
  // nunca conectava. Mesmo defeito que a tela de sessão tinha.
  const { data: sessaoRelevante } = useSessaoRelevante();
  const sessionId = sessaoRelevante?.id;
  const { estado: estadoDoCanal, sessao, participantes, falas, setFalas, dizAlgo,
          criaEnquete, vota, reportaPosicao } = useCanalDaSessao(sessionId);

  // Histórico: o canal só entrega o que acontece de agora em diante, e quem
  // chega no meio precisa da conversa desde o começo.
  useEffect(() => {
    if (!sessionId) return;
    let cancelado = false;
    http.get<Fala[]>(`/api/sessions/${sessionId}/messages/`)
      .then((antigas) => { if (!cancelado) setFalas(antigas); })
      .catch(() => {});
    return () => { cancelado = true; };
  }, [sessionId, setFalas]);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll sempre que uma mensagem nova entrar
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [falas]);

  // Eram três pessoas escritas no código, com posições fixas em 51%, 52% e
  // 53% e um "BUFFERING" decorativo. Agora vêm da presença real do canal.
  const duracao = (sessao?.estimated_duration_minutes ?? 0) * 60;
  // Minha posição no filme, que acompanha cada fala enviada: o comentário só
  // faz sentido junto da cena em que foi feito.
  const minhaPosicao = participantes.find((p) => p.role === 'host')?.playback_position_seconds ?? 0;

  // O filme em projeção é o primeiro da fila da sessão. Antes era L'Aventura
  // escrito no código, com pôster fixo em /images/poster-1.png e o timecode
  // parado em 01:14:20 de um total de 02:23:00 — os mesmos números para
  // qualquer conta, em qualquer visita, sem sessão nenhuma existir.
  const emProjecao = sessao?.session_movies?.[0]?.movie;
  const fracao = duracao > 0 ? Math.min(1, minhaPosicao / duracao) : 0;
  const users = participantes.map((p: Participante) => ({
    id: p.id,
    name: p.display_name || p.username,
    host: p.role === 'host',
    status: !p.present ? 'AUSENTE'
      : p.playback_state === 'buffering' ? 'BUFFERING'
      : p.playback_state === 'paused' ? 'PAUSADO' : 'SYNCED',
    avatar: '/images/perfil.jpg',
    pos: duracao > 0
      ? `${Math.min(100, Math.round((p.playback_position_seconds / duracao) * 100))}%`
      : '0%',
  }));

  // Lógica de Comandos
  const handleCriarSessao = async () => {
    setErroDoForm('');
    if (!novoTitulo.trim()) return setErroDoForm('A sessão precisa de um nome.');
    if (!novaData) return setErroDoForm('Escolha a data da projeção.');

    // O <input type="date"> devolve a data no fuso local; montar o ISO com o
    // Date local e converter preserva a hora que a pessoa escolheu. Concatenar
    // com 'Z' marcaria 20:00 como UTC e a sessão apareceria três horas fora.
    const quando = new Date(`${novaData}T${novaHora || '20:00'}`);
    if (Number.isNaN(quando.getTime())) return setErroDoForm('Data inválida.');

    try {
      await criarSessao.mutateAsync({
        name: novoTitulo.trim(),
        scheduled_date: quando.toISOString(),
        movie_ids: escolhidos.map((f) => f.id),
      });
      setIsScheduleOpen(false);
      setNovoTitulo(''); setNovaData(''); setEscolhidos([]); setBuscaDeFilme('');
    } catch {
      setErroDoForm('Não foi possível agendar. Tente de novo.');
    }
  };

  const handleCopyLink = async () => {
    // Copiava `window.location.href` — a URL da própria página, que não dá
    // acesso nenhum a quem a receba. O convite é um código que autoriza uma
    // conta a entrar na sessão, e que expira.
    if (!sessionId) return;
    try {
      const { code } = await criarConvite.mutateAsync(sessionId);
      // O código vai para a TELA antes de ir para a área de transferência.
      // A cópia falha em situações banais — permissão negada, aba sem foco —
      // e, se ela fosse o único caminho, a pessoa ficaria sem o convite e
      // sem saber que ele existe.
      setConviteGerado(code);
      try {
        await navigator.clipboard.writeText(code);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 4000);
      } catch {
        // O código está na tela; copiar era conveniência.
      }
    } catch {
      setConviteGerado('');
      setErroDoConvite('Não foi possível gerar o convite.');
    }
  };

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;
    // O horário era montado como `01:14:${segundos}` — a hora presa à posição
    // falsa do filme, e os segundos vindos do relógio. Agora quem carimba é o
    // servidor, e a fala guarda o ponto do filme em que foi dita.
    if (dizAlgo(inputValue, minhaPosicao)) setInputValue('');
  };



  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSendMessage();
  };

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--film)', minHeight: '100dvh', display: 'flex', overflowX: 'hidden' }}>
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
              style={{ position: 'relative', width: '100%', maxWidth: '1200px', aspectRatio: '16/9', backgroundColor: 'var(--void)', border: '1px solid var(--gold)', boxShadow: '0 0 100px rgba(0,0,0,1)', zIndex: 1, overflow: 'hidden' }}
            >
              <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
                <Image src={emProjecao?.background_url || emProjecao?.poster_url || "/images/hero-backdrop.png"} alt="" fill sizes="100vw" style={{ objectFit: 'cover', filter: 'grayscale(100%) contrast(125%)', opacity: 0.6 }} />
              </div>
              
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 10, background: 'linear-gradient(to bottom, rgba(4,4,2,0.9), rgba(0,0,0,0))', opacity: 0, transition: 'opacity 0.3s' }} className="group-hover/player:opacity-100">
                <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: 'var(--gold)', letterSpacing: '0.2em', marginBottom: '8px' }}>[ SINAL DE VÍDEO ATIVO ]</div>
                  <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', color: 'var(--film)', margin: 0 }}>{emProjecao ? `${emProjecao.title} — Projeção Integrada` : 'Nenhuma projeção em curso'}</h3>
                </motion.div>
                <motion.button 
                  onClick={() => setIsTrailerOpen(false)} 
                  whileHover={{ scale: 1.1, backgroundColor: 'rgba(191,143,60,0.1)', borderColor: 'var(--gold)', color: 'var(--gold)' }} whileTap={{ scale: 0.9 }}
                  style={{ background: 'rgba(0,0,0,0)', border: '1px solid var(--m3)', padding: '12px', color: 'var(--m3)', cursor: 'pointer', transition: 'all 0.3s' }}
                >
                  <X style={{ width: 20, height: 20 }} />
                </motion.button>
              </div>

              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '32px', zIndex: 10, background: 'linear-gradient(to top, rgba(4,4,2,0.95), rgba(0,0,0,0))', opacity: 0, transition: 'opacity 0.3s', display: 'flex', flexDirection: 'column', gap: '24px' }} className="group-hover/player:opacity-100">
                <div style={{ width: '100%', height: '2px', backgroundColor: 'rgba(86,84,80,0.3)', position: 'relative', cursor: 'pointer' }} className="group/timeline">
                  <motion.div variants={{ rest: { height: 2, filter: 'brightness(1)' }, hover: { height: 4, filter: 'brightness(1.5)' } }} initial="rest" whileHover="hover" style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: 0, height: '2px', backgroundColor: 'var(--gold)', width: `${Math.round(fracao * 100)}%`, boxShadow: '0 0 10px rgba(191,143,60,0.5)' }} />
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <motion.button whileHover={{ color: 'var(--film)', scale: 1.1 }} whileTap={{ scale: 0.9 }} style={{ background: 'rgba(0,0,0,0)', border: 'none', color: 'var(--m2)', cursor: 'pointer' }}><SkipBack style={{ width: 20, height: 20 }} fill="currentColor" /></motion.button>
                      <motion.button whileHover={{ color: 'var(--gold)', scale: 1.1 }} whileTap={{ scale: 0.9 }} style={{ background: 'rgba(0,0,0,0)', border: 'none', color: 'var(--film)', cursor: 'pointer' }}><Pause style={{ width: 32, height: 32 }} fill="currentColor" /></motion.button>
                      <motion.button whileHover={{ color: 'var(--film)', scale: 1.1 }} whileTap={{ scale: 0.9 }} style={{ background: 'rgba(0,0,0,0)', border: 'none', color: 'var(--m2)', cursor: 'pointer' }}><SkipForward style={{ width: 20, height: 20 }} fill="currentColor" /></motion.button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', borderLeft: '1px solid rgba(86,84,80,0.3)', paddingLeft: '32px' }}>
                      <Volume2 style={{ width: 16, height: 16, color: 'var(--m2)' }} />
                      <div style={{ width: '96px', height: '1px', backgroundColor: 'rgba(86,84,80,0.3)', position: 'relative' }}><div style={{ width: '66%', height: '100%', backgroundColor: 'var(--film)', boxShadow: '0 0 5px rgba(237,232,220,0.5)' }} /></div>
                    </div>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: 'var(--m3)', letterSpacing: '0.1em', marginLeft: '16px' }}>{timecode(minhaPosicao)} / {timecode(duracao)}</span>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <motion.button whileHover={{ color: 'var(--film)' }} style={{ background: 'rgba(0,0,0,0)', border: 'none', color: 'var(--m2)', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}><Settings2 style={{ width: 16, height: 16 }} /> [ AUDIO ]</motion.button>
                    <motion.button whileHover={{ color: 'var(--film)' }} style={{ background: 'rgba(0,0,0,0)', border: 'none', color: 'var(--m2)', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}><Subtitles style={{ width: 16, height: 16 }} /> [ LEG ]</motion.button>
                    <div style={{ height: '16px', width: '1px', backgroundColor: 'rgba(86,84,80,0.3)' }} />
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: 'var(--gold)', letterSpacing: '0.15em', border: '1px solid var(--gold)', padding: '4px 8px', backgroundColor: 'rgba(191,143,60,0.1)' }}>4K HDR</span>
                    <motion.button whileHover={{ color: 'var(--film)', scale: 1.1 }} whileTap={{ scale: 0.9 }} style={{ background: 'rgba(0,0,0,0)', border: 'none', color: 'var(--m2)', cursor: 'pointer', marginLeft: '8px' }}><Maximize style={{ width: 20, height: 20 }} /></motion.button>
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
              style={{ position: 'relative', width: '100%', maxWidth: '600px', backgroundColor: 'var(--void)', border: '1px solid var(--gold)', padding: '48px', boxShadow: '0 0 80px rgba(0,0,0,0.8)', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '32px' }}
            >
              <button onClick={() => setIsScheduleOpen(false)} style={{ position: 'absolute', top: 24, right: 24, background: 'rgba(0,0,0,0)', border: 'none', color: 'var(--m3)', cursor: 'pointer', padding: '8px', transition: 'color 0.3s' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--film)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--m3)'}>
                <X style={{ width: 20, height: 20 }} />
              </button>

              <div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: 'var(--gold)', letterSpacing: '0.2em', marginBottom: '8px' }}>[ PROTOCOLO DE TRANSMISSÃO ]</div>
                <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '3rem', color: 'var(--film)', margin: 0 }}>Agendar Projeção</h2>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                <div>
                  <label style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: 'var(--m2)', letterSpacing: '0.2em', display: 'block', marginBottom: '12px' }}>TÍTULO DA SESSÃO</label>
                  <input type="text" placeholder="EX: ANÁLISE DE KUBRICK" value={novoTitulo} onChange={(e) => setNovoTitulo(e.target.value)} style={{ width: '100%', background: 'rgba(237,232,220,0.02)', border: 'none', borderBottom: '1px solid var(--m3)', padding: '16px', color: 'var(--film)', fontFamily: "'DM Mono', monospace", fontSize: '12px', letterSpacing: '0.1em', outline: 'none', transition: 'border-color 0.3s' }} onFocus={e => e.currentTarget.style.borderColor = 'var(--gold)'} onBlur={e => e.currentTarget.style.borderColor = 'var(--m3)'} />
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                  <div>
                    <label style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: 'var(--m2)', letterSpacing: '0.2em', display: 'block', marginBottom: '12px' }}>DATA TEMPORAL</label>
                    <input type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)} style={{ width: '100%', background: 'rgba(237,232,220,0.02)', border: 'none', borderBottom: '1px solid var(--m3)', padding: '16px', color: 'var(--m2)', fontFamily: "'DM Mono', monospace", fontSize: '12px', outline: 'none', colorScheme: 'dark' }} />
                  </div>
                  <div>
                    <label style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: 'var(--m2)', letterSpacing: '0.2em', display: 'block', marginBottom: '12px' }}>HORÁRIO DE INÍCIO</label>
                    <input type="time" value={novaHora} onChange={(e) => setNovaHora(e.target.value)} style={{ width: '100%', background: 'rgba(237,232,220,0.02)', border: 'none', borderBottom: '1px solid var(--m3)', padding: '16px', color: 'var(--m2)', fontFamily: "'DM Mono', monospace", fontSize: '12px', outline: 'none', colorScheme: 'dark' }} />
                  </div>
                </div>

                <div>
                  <label style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: 'var(--m2)', letterSpacing: '0.2em', display: 'block', marginBottom: '12px' }}>CÓDIGO DA OBRA</label>
                  {/* Este botão não abria nada: era um retângulo tracejado com
                      um ícone de lupa. A busca agora é no acervo de verdade. */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(237,232,220,0.02)', borderBottom: '1px solid var(--m3)', padding: '12px 16px' }}>
                    <Search style={{ width: 14, height: 14, color: 'var(--m3)' }} />
                    <input
                      type="text" value={buscaDeFilme} onChange={(e) => setBuscaDeFilme(e.target.value)}
                      placeholder="BUSCAR NO ACERVO..."
                      style={{ flex: 1, background: 'rgba(0,0,0,0)', border: 'none', color: 'var(--film)', fontFamily: "'DM Mono', monospace", fontSize: '11px', letterSpacing: '0.1em', outline: 'none' }}
                    />
                  </div>

                  {escolhidos.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
                      {escolhidos.map((f) => (
                        <button key={f.id} onClick={() => setEscolhidos((a) => a.filter((x) => x.id !== f.id))}
                          style={{ background: 'rgba(191,143,60,0.12)', border: '1px solid rgba(191,143,60,0.4)', color: 'var(--gold)', padding: '6px 10px', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.1em', cursor: 'pointer' }}>
                          {f.title} ✕
                        </button>
                      ))}
                    </div>
                  )}

                  {buscaDeFilme.length >= 3 && (
                    <div style={{ maxHeight: 180, overflowY: 'auto', marginTop: 12, border: '1px solid rgba(86,84,80,0.3)' }}>
                      {(resultadosDaBusca?.results ?? []).slice(0, 12).map((m) => (
                        <button
                          key={m.id}
                          onClick={() => {
                            // Não deixa repetir: o mesmo filme duas vezes na
                            // fila seria gravado duas vezes na sessão.
                            setEscolhidos((a) => a.some((x) => x.id === m.id)
                              ? a : [...a, { id: m.id as string, title: m.title }]);
                            setBuscaDeFilme('');
                          }}
                          style={{ display: 'block', width: '100%', textAlign: 'left', background: 'rgba(0,0,0,0)', border: 'none', borderBottom: '1px solid rgba(86,84,80,0.2)', color: 'var(--m2)', padding: '10px 14px', fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.08em', cursor: 'pointer' }}
                        >
                          {m.title} <span style={{ color: 'var(--m3)' }}>{m.year ?? ''}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {erroDoForm && (
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: 'var(--terra)', letterSpacing: '0.15em', marginTop: 16 }}>
                  {erroDoForm.toUpperCase()}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginTop: '16px' }}>
                <motion.button onClick={() => setIsScheduleOpen(false)} whileHover={{ backgroundColor: 'rgba(237,232,220,0.05)' }} whileTap={{ scale: 0.95 }} style={{ background: 'rgba(0,0,0,0)', border: '1px solid rgba(86,84,80,0.5)', color: 'var(--film)', padding: '16px 24px', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', cursor: 'pointer' }}>[ CANCELAR ]</motion.button>
                <motion.button onClick={handleCriarSessao} disabled={criarSessao.isPending} whileHover={{ backgroundColor: 'rgba(0,0,0,0)', color: 'var(--gold)' }} whileTap={{ scale: 0.95 }} style={{ background: 'var(--gold)', border: '1px solid var(--gold)', color: 'var(--void)', padding: '16px 32px', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', fontWeight: 'bold', cursor: criarSessao.isPending ? 'wait' : 'pointer' }}>{criarSessao.isPending ? '[ AGENDANDO... ]' : '[ CONFIRMAR AGENDAMENTO ]'}</motion.button>
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
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: 'var(--gold)', letterSpacing: '0.2em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <motion.div animate={{ opacity: [1, 0.2, 1] }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }} style={{ width: 6, height: 6, backgroundColor: 'var(--gold)', borderRadius: '50%' }} />
                [ REDE DE CURADORIA CONECTADA ]
              </div>
              <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(3rem, 5vw, 5rem)', fontWeight: 400, color: 'var(--film)', margin: 0, lineHeight: 1, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '24px' }}>
                <TerminalSquare style={{ width: 48, height: 48, color: 'var(--m3)' }} /> Sessão em Conjunto
              </h1>
            </div>

            <div style={{ display: 'flex', gap: '16px' }}>
              <motion.button 
                onClick={() => setIsScheduleOpen(true)}
                whileHover={{ backgroundColor: 'var(--gold)', color: 'var(--void)' }} whileTap={{ scale: 0.98 }}
                style={{ background: 'rgba(0,0,0,0)', border: '1px solid var(--gold)', color: 'var(--gold)', padding: '16px 24px', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.3s' }}
              >
                <CalendarPlus style={{ width: 14, height: 14 }} /> [ AGENDAR SESSÃO ]
              </motion.button>
              
              <motion.button 
                onClick={handleCopyLink}
                whileHover={{ backgroundColor: linkCopied ? 'var(--m2)' : 'var(--film)', color: 'var(--void)', borderColor: linkCopied ? 'var(--m2)' : 'var(--film)' }} whileTap={{ scale: 0.98 }}
                style={{ background: linkCopied ? 'var(--m2)' : 'rgba(0,0,0,0)', border: `1px solid ${linkCopied ? 'var(--m2)' : 'var(--m3)'}`, color: linkCopied ? 'var(--void)' : 'var(--film)', padding: '16px 24px', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.3s' }}
              >
                <LinkIcon style={{ width: 14, height: 14 }} /> {linkCopied ? '[ Código Copiado ]' : criarConvite.isPending ? '[ Gerando... ]' : '[ Gerar Convite ]'}
              </motion.button>
            </div>

            {(conviteGerado || erroDoConvite) && (
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(86,84,80,0.3)' }}>
                {conviteGerado ? (
                  <>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', color: 'var(--m3)', letterSpacing: '0.2em', marginBottom: 10 }}>
                      CÓDIGO DO CONVITE — VÁLIDO POR 48 HORAS
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      {/* Selecionável: se a cópia automática falhar, ainda dá
                          para marcar com o mouse e copiar à mão. */}
                      <code style={{ userSelect: 'all', background: 'rgba(191,143,60,0.1)', border: '1px solid rgba(191,143,60,0.35)', padding: '10px 14px', fontFamily: "'DM Mono', monospace", fontSize: '12px', color: 'var(--gold)', letterSpacing: '0.1em' }}>
                        {conviteGerado}
                      </code>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', color: 'var(--m3)', letterSpacing: '0.15em' }}>
                        QUEM RECEBER COLA ISTO EM SESSÕES
                      </span>
                    </div>
                  </>
                ) : (
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: 'var(--terra)', letterSpacing: '0.15em' }}>
                    {erroDoConvite.toUpperCase()}
                  </div>
                )}
              </div>
            )}
          </motion.div>

          {/* GRID PRINCIPAL */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 450px', gap: '64px', alignItems: 'start' }}>
            
            {/* ── PAINEL ESQUERDO: CONTROLE DE PROJEÇÃO ── */}
            <motion.div variants={staggerContainer} initial="hidden" animate="visible" style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
              
              <motion.div variants={fadeUpItem} style={{ border: '1px solid rgba(191,143,60,0.3)', backgroundColor: 'var(--void)', padding: '48px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: '50%', width: '600px', height: '600px', backgroundColor: 'rgba(191,143,60,0.03)', borderRadius: '50%', filter: 'blur(100px)', pointerEvents: 'none', transform: 'translate(-50%, -50%)' }} />
                
                <div style={{ display: 'flex', gap: '48px' }}>
                  <div style={{ width: '240px', flexShrink: 0 }}>
                    <div style={{ position: 'relative', aspectRatio: '2/3', backgroundColor: 'var(--bg)', border: '1px solid rgba(86,84,80,0.3)', padding: '4px', overflow: 'hidden', boxShadow: '0 0 40px rgba(0,0,0,0.8)' }} className="group">
                      <Image src={emProjecao?.poster_url || "/images/poster-1.png"} alt="" fill sizes="200px" style={{ objectFit: 'cover', filter: 'grayscale(100%) contrast(125%)' }} />
                    </div>
                  </div>
                  
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingTop: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontFamily: "'DM Mono', monospace", fontSize: '9px', color: 'var(--gold)', letterSpacing: '0.2em', marginBottom: '24px', backgroundColor: 'rgba(191,143,60,0.05)', border: '1px solid rgba(191,143,60,0.2)', padding: '8px 16px', width: 'fit-content' }}>
                      <motion.div animate={{ opacity: [1, 0.2, 1] }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }} style={{ width: 6, height: 6, backgroundColor: 'var(--gold)', borderRadius: '50%' }} />
                      SINAL DE TRANSMISSÃO ATIVO
                    </div>
                    
                    <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '5rem', color: 'var(--film)', margin: '0 0 8px 0', lineHeight: 1 }}>{emProjecao?.title ?? '—'}</h2>
                    <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'var(--m2)', letterSpacing: '0.1em', margin: '0 0 48px 0', textTransform: 'uppercase' }}>{emProjecao ? `${emProjecao.year ?? ''} • ${emProjecao.director ?? ''}`.trim() : ''}</p>
                    
                    {/* TIMELINE DE PRECISÃO */}
                    <div style={{ marginTop: 'auto' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'var(--m2)', letterSpacing: '0.1em', marginBottom: '16px' }}>
                        <span style={{ color: 'var(--film)' }}>{timecode(minhaPosicao)}</span>
                        <span>{timecode(duracao)}</span>
                      </div>
                      <div style={{ width: '100%', height: '2px', backgroundColor: 'rgba(86,84,80,0.3)', position: 'relative', cursor: 'crosshair' }} className="group/progress">
                        <motion.div style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: 0, height: '100%', backgroundColor: 'var(--gold)', width: `${Math.round(fracao * 100)}%`, boxShadow: '0 0 10px rgba(191,143,60,0.5)', transition: 'height 0.2s' }} className="group-hover/progress:h-1" />
                        
                        <div style={{ position: 'absolute', top: '-4px', bottom: '-4px', left: '51%', width: '2px', backgroundColor: 'var(--m3)' }} title="Ana C." />
                        <div style={{ position: 'absolute', top: '-4px', bottom: '-4px', left: '53%', width: '2px', backgroundColor: 'var(--m2)' }} title="Carlos M." />
                      </div>
                    </div>

                    {/* Botões de Ação */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '48px' }}>
                      <motion.button 
                        onClick={() => setIsTrailerOpen(true)}
                        whileHover={{ scale: 1.05, backgroundColor: 'var(--gold)', color: 'var(--void)' }} whileTap={{ scale: 0.95 }}
                        style={{ width: '64px', height: '64px', backgroundColor: 'rgba(0,0,0,0)', border: '1px solid var(--gold)', color: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.3s' }}
                      >
                        <Play style={{ width: 24, height: 24, marginLeft: '4px' }} fill="currentColor" />
                      </motion.button>
                      <motion.button 
                        whileHover={{ backgroundColor: 'var(--film)', color: 'var(--void)' }} whileTap={{ scale: 0.98 }}
                        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0)', border: '1px solid var(--m3)', color: 'var(--film)', padding: '0 24px', height: '64px', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', cursor: 'pointer', transition: 'all 0.3s' }}
                      >
                        <LinkIcon style={{ width: 14, height: 14 }} /> [ FORÇAR SINCRONIA MESTRE ]
                      </motion.button>
                      <motion.button 
                        onClick={() => router.push('/settings')}
                        whileHover={{ borderColor: 'var(--film)', color: 'var(--film)', scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        style={{ width: '64px', height: '64px', backgroundColor: 'rgba(0,0,0,0)', border: '1px solid var(--m3)', color: 'var(--m2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.3s' }}
                      >
                        <Settings2 style={{ width: 18, height: 18 }} />
                      </motion.button>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Status Rede */}
              <motion.div variants={fadeUpItem} style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(86,84,80,0.3)', borderBottom: '1px solid rgba(86,84,80,0.3)', padding: '24px 0', fontFamily: "'DM Mono', monospace", fontSize: '9px', color: 'var(--m3)', letterSpacing: '0.15em' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Activity style={{ width: 12, height: 12 }} /> LARGURA DE BANDA: 85 MBPS</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 style={{ width: 12, height: 12 }} /> LATÊNCIA MÉDIA: 12MS</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Share2 style={{ width: 12, height: 12 }} /> PEERS CONECTADOS: 03</span>
              </motion.div>

            </motion.div>

            {/* ── PAINEL DIREITO: REGISTRO DE COMUNICAÇÃO ── */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4, duration: 0.8, ease: FINE_ART_EASE }} style={{ border: '1px solid rgba(86,84,80,0.3)', backgroundColor: 'var(--void)', display: 'flex', flexDirection: 'column', height: '800px' }}>
              
              {/* Cabeçalho: Operadores */}
              <div style={{ padding: '24px', borderBottom: '1px solid rgba(86,84,80,0.3)', backgroundColor: 'var(--bg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                  <Users style={{ width: 16, height: 16, color: 'var(--gold)' }} />
                  <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.8rem', color: 'var(--film)', margin: 0 }}>Cinéfilos Conectados</h3>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {users.map((user) => (
                    <motion.div whileHover={{ x: 4, backgroundColor: 'rgba(237,232,220,0.05)' }} key={user.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px', border: '1px solid rgba(86,84,80,0.2)', backgroundColor: 'rgba(237,232,220,0.02)', cursor: 'crosshair', transition: 'all 0.2s' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ position: 'relative', width: '32px', height: '32px', filter: 'grayscale(100%)', border: '1px solid rgba(86,84,80,0.5)', overflow: 'hidden' }}>
                          <Image src={user.avatar} alt="" fill sizes="48px" style={{ objectFit: 'cover' }} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: 'var(--film)', letterSpacing: '0.15em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {user.name} 
                            {user.host && <span style={{ color: 'var(--gold)', border: '1px solid var(--gold)', padding: '2px 4px', fontSize: '7px' }}>ADMIN</span>}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', color: user.status === 'SYNCED' ? 'var(--m3)' : 'var(--gold)', letterSpacing: '0.1em' }}>{user.pos}</span>
                        <motion.div animate={{ opacity: user.status === 'SYNCED' ? 1 : [1, 0.2, 1] }} transition={{ repeat: Infinity, duration: 1 }} style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: user.status === 'SYNCED' ? 'var(--m2)' : 'var(--gold)' }} />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Corpo: Transcrição */}
              <div style={{ flex: 1, padding: '32px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ textAlign: 'center', fontFamily: "'DM Mono', monospace", fontSize: '8px', color: 'var(--m3)', letterSpacing: '0.2em', borderBottom: '1px dashed rgba(86,84,80,0.3)', paddingBottom: '16px', marginBottom: '8px' }}>
                  {/* Era "[20:00:00] SYSTEM: INÍCIO DA TRANSMISSÃO SIMULTÂNEA",
                      com horário fixo, aparecendo mesmo sem sessão nenhuma. A
                      abertura de verdade é o instante em que a sessão começou. */}
                  {sessao?.scheduled_date
                    ? `[${new Date(sessao.scheduled_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}] SESSÃO ABERTA`
                    : '[ AGUARDANDO SESSÃO ]'}
                </div>
                
                <AnimatePresence initial={false}>
                  {falas.map((msg) => (
                    <motion.div 
                      key={msg.id} layout initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.3 }}
                      style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', fontFamily: "'DM Mono', monospace", letterSpacing: '0.1em' }}>
                        {/* O horário era `01:14:${segundos}` — hora presa à posição
                            falsa do filme. Agora é o ponto do filme em que a fala
                            aconteceu, que é o que dá sentido ao comentário. */}
                        <span style={{ fontSize: '9px', color: 'var(--m3)' }}>[{timecode(msg.playback_position_seconds)}]</span>
                        <span style={{ fontSize: '10px', color: msg.is_self ? 'var(--gold)' : 'var(--m2)', fontWeight: 'bold' }}>{msg.author}</span>
                      </div>
                      
                      {msg.poll ? (
                        <div style={{ paddingLeft: '62px', border: '1px solid rgba(191,143,60,0.25)', padding: '20px 24px', marginLeft: '62px', background: 'rgba(191,143,60,0.04)' }}>
                          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.4rem', color: 'var(--film)', margin: '0 0 18px 0' }}>
                            {msg.poll.question}
                          </p>
                          {msg.poll.options.map((opt) => {
                            // Percentual do total, não da maior: uma barra
                            // relativa à líder faria 1 voto contra 1 parecer
                            // 100% contra 100%.
                            const total = msg.poll!.total_votes;
                            const pct = total > 0 ? Math.round((opt.votes / total) * 100) : 0;
                            const meu = msg.poll!.my_vote === opt.id;
                            return (
                              <button
                                key={opt.id}
                                onClick={() => vota(msg.poll!.id, opt.id)}
                                style={{ display: 'block', width: '100%', textAlign: 'left', position: 'relative', background: 'rgba(0,0,0,0)', border: `1px solid ${meu ? 'rgba(191,143,60,0.6)' : 'rgba(86,84,80,0.4)'}`, padding: '10px 14px', marginBottom: 8, cursor: 'pointer', overflow: 'hidden' }}
                              >
                                <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: 'rgba(191,143,60,0.14)', transition: 'width 0.5s ease' }} />
                                <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.1em', color: meu ? 'var(--gold)' : 'var(--m2)' }}>
                                  <span>{meu ? '▸ ' : ''}{opt.label}</span>
                                  <span>{opt.votes} · {pct}%</span>
                                </div>
                              </button>
                            );
                          })}
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', color: 'var(--m3)', letterSpacing: '0.15em', marginTop: 10 }}>
                            {msg.poll.total_votes === 0 ? 'AINDA SEM VOTOS'
                              : `${msg.poll.total_votes} VOTO${msg.poll.total_votes > 1 ? 'S' : ''}`}
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.6rem', color: msg.is_self ? 'var(--gold)' : 'var(--film)', fontStyle: 'italic', paddingLeft: '62px' }}>
                          "{msg.text}"
                        </div>
                      )}

                    </motion.div>
                  ))}
                </AnimatePresence>
                <div ref={chatEndRef} />
              </div>

              {/* Rodapé: Input & Criação de Enquete */}
              <div style={{ borderTop: '1px solid rgba(86,84,80,0.3)', backgroundColor: 'var(--bg)', padding: '24px' }}>
                
                {isCreatingPoll ? (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: 'var(--gold)', letterSpacing: '0.2em' }}>[ NOVA ENQUETE ]</div>
                    {[
                      { v: pollQ, set: setPollQ, ph: 'PERGUNTA' },
                      { v: pollOpt1, set: setPollOpt1, ph: 'ALTERNATIVA 1' },
                      { v: pollOpt2, set: setPollOpt2, ph: 'ALTERNATIVA 2' },
                    ].map((campo) => (
                      <input
                        key={campo.ph} type="text" value={campo.v}
                        onChange={(e) => campo.set(e.target.value)}
                        placeholder={campo.ph}
                        style={{ background: 'rgba(237,232,220,0.02)', border: 'none', borderBottom: '1px solid var(--m3)', padding: '10px 8px', color: 'var(--film)', fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.12em', outline: 'none' }}
                      />
                    ))}
                    <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                      <button onClick={handleSendPoll}
                        style={{ background: 'rgba(0,0,0,0)', border: '1px solid rgba(191,143,60,0.5)', color: 'var(--gold)', padding: '8px 16px', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', cursor: 'pointer' }}>
                        [ PUBLICAR ]
                      </button>
                      <button onClick={() => setIsCreatingPoll(false)}
                        style={{ background: 'rgba(0,0,0,0)', border: '1px solid rgba(86,84,80,0.5)', color: 'var(--m2)', padding: '8px 16px', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', cursor: 'pointer' }}>
                        [ CANCELAR ]
                      </button>
                    </div>
                  </motion.div>
                ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', borderBottom: '1px solid rgba(191,143,60,0.5)', paddingBottom: '8px' }} className="group">
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '12px', color: 'var(--gold)', fontWeight: 'bold' }}>&gt;</span>
                  <input
                    type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleKeyDown}
                    placeholder={estadoDoCanal === 'aberto' ? 'REGISTRAR OBSERVAÇÃO...' : 'CANAL FORA DO AR...'}
                    disabled={estadoDoCanal !== 'aberto'}
                    style={{ flex: 1, background: 'rgba(0,0,0,0)', border: 'none', color: 'var(--film)', fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.15em', outline: 'none' }}
                  />
                  <motion.button
                    whileHover={{ color: 'var(--film)' }} whileTap={{ scale: 0.95 }} onClick={handleSendMessage}
                    style={{ background: 'rgba(0,0,0,0)', border: 'none', color: inputValue.trim() && estadoDoCanal === 'aberto' ? 'var(--gold)' : 'var(--m3)', cursor: inputValue.trim() ? 'pointer' : 'default', transition: 'color 0.3s', fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.1em' }}
                  >
                    [ ENVIAR ]
                  </motion.button>
                </div>

                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
                  {!isCreatingPoll && (
                    <button onClick={() => setIsCreatingPoll(true)} disabled={estadoDoCanal !== 'aberto'}
                      style={{ background: 'rgba(0,0,0,0)', border: 'none', color: 'var(--m3)', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.1em', cursor: estadoDoCanal === 'aberto' ? 'pointer' : 'default', padding: 0, marginRight: 20 }}>
                      [ + ENQUETE ]
                    </button>
                  )}
                  {/* O estado do canal fica à vista: sem isso, uma queda de
                      conexão pareceria uma sala silenciosa. */}
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', color: estadoDoCanal === 'aberto' ? 'var(--gold)' : 'var(--m3)', letterSpacing: '0.1em' }}>
                    {estadoDoCanal === 'aberto' ? '[ CANAL ABERTO ]'
                      : estadoDoCanal === 'conectando' ? '[ CONECTANDO... ]' : '[ RECONECTANDO... ]'}
                  </span>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', color: 'var(--m3)', letterSpacing: '0.1em' }}>[ ENTER ] PARA CONFIRMAR</span>
                </div>
              </div>

            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}