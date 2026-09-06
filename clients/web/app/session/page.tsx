'use client';

import { AnimatePresence, motion } from "framer-motion";
import { FINE_ART_EASE } from '@/lib/motion';
import { MotionImage } from '@/components/system/MotionImage';
import { Play, Cast, SlidersHorizontal, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useProximasSessoes, useSessao } from "@/features/sessions/hooks/useSessoes";
import { useEntrarComCodigo } from "@/features/sessions/hooks/useSessaoMutations";
import type { CinemaSession, SessionMovie } from "@/features/sessions/hooks/useSessoes";
import { useRouter } from "next/navigation";


function TelemetryStep({ step, index }: any) {
  const isActive = step.status === 'active';
  const isDone = step.status === 'done';
  const [telemetry, setTelemetry] = useState("0x000000");

  // Motor de Telemetria: Gera códigos seriais muito rápido para o passo ativo
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      setTelemetry("0x" + Math.floor(Math.random()*16777215).toString(16).toUpperCase().padStart(6, '0'));
    }, 80); 
    return () => clearInterval(interval);
  }, [isActive]);

  return (
    <motion.div 
      variants={{
        hidden: { opacity: 0, y: 15 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: FINE_ART_EASE } }
      }}
      style={{ position: 'relative' }}
    >
      {/* 1. EIXO ESTRUTURAL (Nó + Linha) */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        {/* Nó Conector (LED Quadrado) */}
        <motion.div
          animate={
            isActive ? { backgroundColor: ['var(--gold)', 'rgba(191,143,60,0.2)', 'var(--gold)'], scale: [1, 1.2, 1] } :
            isDone ? { backgroundColor: 'rgba(191,143,60,0.5)' } :
            { backgroundColor: 'rgba(237,232,220,0.1)' }
          }
          transition={isActive ? { repeat: Infinity, duration: 1.5, ease: "easeInOut" } : {}}
          style={{ width: 4, height: 4, marginRight: 8, flexShrink: 0 }}
        />
        
        {/* Linha com Tráfego Ótico */}
        <div style={{ position: 'relative', height: 1, flex: 1, backgroundColor: 'rgba(237,232,220,0.05)', overflow: 'hidden' }}>
          {/* Base fixa dourada para os concluídos */}
          {isDone && (
            <div style={{ width: '100%', height: '100%', backgroundColor: 'var(--gold)', opacity: 0.3 }} />
          )}
          
          {/* O Feixe de luz forte do ativo */}
          {isActive && (
            <motion.div
              animate={{ x: ['-100%', '200%'] }}
              transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
              style={{ position: 'absolute', top: 0, left: 0, width: '40%', height: '100%', background: 'linear-gradient(90deg, transparent, var(--gold), transparent)', boxShadow: '0 0 8px rgba(191,143,60,0.8)' }}
            />
          )}
          
          {/* Ghost Pings: Validação de integridade nos passos concluídos */}
          {isDone && (
            <motion.div
              animate={{ x: ['-100%', '500%'] }}
              transition={{ repeat: Infinity, duration: 4, ease: 'linear', delay: index * 0.7 }}
              style={{ position: 'absolute', top: 0, left: 0, width: '20%', height: '100%', background: 'linear-gradient(90deg, transparent, rgba(237,232,220,0.8), transparent)' }}
            />
          )}
        </div>
      </div>

      {/* 2. CABEÇALHO DO PASSO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        <motion.div
           animate={isActive ? { textShadow: ['0 0 0px var(--gold)', '0 0 8px rgba(191,143,60,0.5)', '0 0 0px var(--gold)'] } : {}}
           transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
           style={{ color: isActive ? 'var(--gold)' : isDone ? 'var(--film)' : 'var(--m3)' }}
        >
          <span style={{ opacity: 0.5, marginRight: 8 }}>0{index + 1}</span>
          {step.label}
        </motion.div>
        
        {/* Relógio pulsante se ativo */}
        <motion.div
           animate={isActive ? { opacity: [0.4, 1, 0.4] } : {}}
           transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
           style={{ color: isActive ? 'var(--gold)' : 'var(--m3)' }}
        >
           {step.time || '\u00a0'}
        </motion.div>
      </div>

      {/* 3. STATUS E TELEMETRIA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontFamily: "'DM Mono', monospace", fontSize: '8px', letterSpacing: '0.2em' }}>
        <div style={{ color: isActive ? 'var(--gold)' : 'var(--m3)', display: 'flex', alignItems: 'center', height: 10 }}>
          {isDone ? 'CONCLUÍDO' : isActive ? (
            <>
              EM ANDAMENTO
              {/* O Cursor de Terminal piscando */}
              <motion.span
                animate={{ opacity: [1, 1, 0, 0, 1] }}
                transition={{ repeat: Infinity, duration: 0.8, ease: "linear", times: [0, 0.49, 0.5, 0.99, 1] }}
                style={{ display: 'inline-block', width: 4, height: 9, backgroundColor: 'var(--gold)', marginLeft: 6 }}
              />
            </>
          ) : 'AGUARDANDO'}
        </div>
        
        {/* A Mágica: Hex Code mudando insanamente rápido */}
        {isActive && (
          <div style={{ color: 'var(--m2)', opacity: 0.7 }}>
            {telemetry}
          </div>
        )}
      </div>
    </motion.div>
  )
}

/**
 * As quatro etapas da preparação, lidas do estado real da sessão.
 *
 * Eram fixas, com horários inventados: "Planejamento 19:00", "Busca de Mídia
 * 19:02", "Download Agora", "Sessão Pronta ~19:45". Os mesmos quatro horários
 * em qualquer visita, para qualquer conta, sem sessão nenhuma existir.
 *
 * O servidor guarda cada etapa como uma flag, e é delas que o painel sai. Uma
 * etapa fica 'active' quando a anterior terminou e ela não: é onde a
 * preparação está parada agora.
 */
function etapasDaPreparacao(sessao?: CinemaSession) {
  const marcos = [
    { label: 'Planejamento', pronto: Boolean(sessao?.all_movies_selected) },
    { label: 'Busca de Mídia', pronto: Boolean(sessao?.all_torrents_found) },
    { label: 'Download', pronto: Boolean(sessao?.all_downloads_ready) },
    { label: 'Sessão Pronta', pronto: Boolean(sessao?.playlist_created) },
  ];

  const primeiraPendente = marcos.findIndex((m) => !m.pronto);
  return marcos.map((m, i) => ({
    label: m.label,
    status: m.pronto ? 'done' : i === primeiraPendente ? 'active' : 'pending',
    // O componente já desenha o rótulo do status logo abaixo; este campo era
    // o horário da etapa ("19:00", "~19:45"), inventado. O servidor não
    // guarda horário por etapa, então só o que existe aparece: a
    // porcentagem do download, quando é essa a etapa em curso.
    time: m.label === 'Download' && sessao && !m.pronto
      ? `${sessao.download_progress ?? 0}%`
      : '',
  }));
}

/** Especificação técnica da cópia escolhida, do release e não de um literal. */
function especificacao(release: SessionMovie['selected_release']): string {
  if (!release) return 'CÓPIA AINDA NÃO ESCOLHIDA';
  const video = [release.resolution, release.is_remux ? 'REMUX' : null,
                 release.video_codec, release.has_dolby_vision ? 'DV' : release.has_hdr ? 'HDR' : null]
    .filter(Boolean).join(' ');
  const audio = [release.audio_codec, release.has_atmos ? 'ATMOS' : null]
    .filter(Boolean).join(' ');
  return [video && `VIDEO: ${video}`, audio && `AUDIO: ${audio}`].filter(Boolean).join(' // ')
    || 'ESPECIFICAÇÃO INDISPONÍVEL';
}

/** "SÁB, 20:00" a partir da data agendada. */
function formataAgendamento(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const dia = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').toUpperCase();
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${dia}, ${hora}`;
}


/** Um item de `session_movies` na forma que a linha da fila desenha. */
function paraLinhaDaFila(sm: SessionMovie) {
  const release = sm.selected_release;
  return {
    id: sm.id,
    movieId: sm.movie?.id,
    title: sm.movie?.title ?? 'Sem título',
    poster: sm.movie?.poster_url || '/images/poster-1.png',
    status: sm.download_status ?? 'pending',
    progress: sm.download_progress ?? 0,
    size: release?.size_gb ? `${release.size_gb.toFixed(1)} GB` : '—',
    specs: especificacao(release),
  };
}

function SessionMovieRow({ movie, index, router }: any) {
  const [isHovered, setIsHovered] = useState(false);

  // Aqui havia um "Motor de Vida" que sorteava a velocidade do download a
  // cada 1,2 s com Math.random(), pelo comentário original, "para parecer
  // real". Não havia download: os três filmes da fila eram literais no
  // código. A velocidade instantânea não tem campo no servidor, então some —
  // o progresso, que existe, é o que a barra mostra.

  return (
    <motion.div 
      layout
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      initial={{ opacity: 0, x: -20 }} 
      animate={{ opacity: 1, x: 0 }} 
      transition={{ delay: 0.5 + (index * 0.1), duration: 0.8, ease: FINE_ART_EASE }}
      style={{ 
        display: 'grid', 
        gridTemplateColumns: '40px 90px 1fr 240px', // LARGURAS AUMENTADAS (Evita os cortes)
        gap: 40, alignItems: 'center', 
        padding: '32px 24px', // PADDING INSERIDO (O conteúdo agora respira)
        borderBottom: '1px solid rgba(237,232,220,0.05)',
        backgroundColor: isHovered ? 'rgba(237,232,220,0.02)' : movie.status === 'downloading' ? 'rgba(237,232,220,0.01)' : 'transparent',
        borderRadius: 16, marginLeft: -24, marginRight: -24 // Truque ótico para o hover não espremer o grid original
      }}
    >
      {/* 1. Número */}
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'var(--m3)' }}>
        {String(index + 1).padStart(3, '0')}
      </div>
      
      {/* 2. Pôster Geométrico */}
      <motion.div 
        animate={{ scale: isHovered ? 1.05 : 1 }} transition={{ duration: 0.6, ease: FINE_ART_EASE }}
        style={{ aspectRatio: '2/3', overflow: 'hidden', backgroundColor: 'var(--void)', border: '1px solid rgba(237,232,220,0.05)' }}
      >
        <MotionImage
          src={movie.poster} alt={movie.title}
          width={400} height={600}
          animate={{ filter: isHovered ? 'grayscale(0%) contrast(1.1)' : movie.status === 'pending' ? 'grayscale(100%) opacity(0.3)' : 'grayscale(30%) contrast(1)' }}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </motion.div>
      
      {/* 3. Título, Progressão e Expansão Técnica */}
      <div style={{ display: 'flex', flexDirection: 'column', paddingRight: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
          <motion.h3 
            animate={{ color: isHovered ? '#FFFFFF' : movie.status === 'pending' ? 'var(--m3)' : 'var(--film)', x: isHovered ? 4 : 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', margin: 0, lineHeight: 1 }}
          >
            {movie.title}
          </motion.h3>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: 'var(--m3)', letterSpacing: '0.15em' }}>
            {movie.size}
          </span>
        </div>
        
        {/* Progress Bar Shimmer */}
        <div style={{ width: '100%', height: 1, backgroundColor: 'rgba(237,232,220,0.1)', position: 'relative', overflow: 'hidden' }}>
          <motion.div 
            initial={{ width: 0 }} animate={{ width: `${movie.progress}%` }} transition={{ duration: 1.5, ease: FINE_ART_EASE }}
            style={{ 
              position: 'absolute', top: 0, left: 0, height: 1, 
              backgroundColor: movie.status === 'ready' ? 'var(--film)' : 'var(--gold)',
              boxShadow: movie.status === 'downloading' ? '0 0 10px rgba(191,143,60,0.5)' : 'none'
            }} 
          />
          {movie.status === 'downloading' && (
            <motion.div 
              animate={{ x: ['-100%', '300%'] }} transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
              style={{ position: 'absolute', top: 0, left: 0, width: '30%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent)' }}
            />
          )}
        </div>

        {/* Expansão do Console de Metadados */}
        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.6, ease: FINE_ART_EASE }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ 
                marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(191,143,60,0.2)',
                display: 'flex', flexDirection: 'column', gap: 8,
                fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em'
              }}>
                <span style={{ color: 'var(--m2)' }}>[STREAM_DATA] {movie.specs}</span>
                <span style={{ color: 'var(--gold)' }}>[DIRETÓRIO] //SRV/MEDIA/CINEMA/{movie.title.replace(/\s/g, '_').toUpperCase()}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 4. Status e Botão PRONTO */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
        <motion.span 
          animate={movie.status === 'downloading' ? { opacity: [1, 0.5, 1] } : { opacity: 1 }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.1em', color: movie.status === 'ready' ? 'var(--film)' : movie.status === 'downloading' ? 'var(--gold)' : 'var(--m3)', textTransform: 'uppercase', textAlign: 'right' }}
        >
          {movie.status === 'ready' ? 'INTEGRIDADE VERIFICADA' : movie.status === 'downloading' ? `AQUISIÇÃO... ${movie.progress}%` : 'AGUARDANDO'}
        </motion.span>
        
        {/* Aqui ficava a velocidade em MB/S, sorteada no cliente a cada
            1,2 s "para parecer real", conforme o comentário original. O
            servidor não informa velocidade instantânea e não há o que pôr no
            lugar: o rótulo ao lado já diz a porcentagem, e repeti-la aqui só
            duplicava o mesmo número. */}

        {movie.status === 'ready' && (
          <motion.button 
            onClick={() => router.push(`/player?id=${movie.id}`)}
            whileHover={{ backgroundColor: 'var(--film)', color: 'var(--bg)', scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            style={{ 
              background: 'transparent', border: '1px solid rgba(237,232,220,0.2)', color: 'var(--film)', 
              padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
              fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em',
            }}
          >
            <Play style={{ width: 10, height: 10 }} /> PRONTO
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

export default function Session() {

  const router = useRouter();

  const { data: sessoes, isLoading: carregandoLista } = useProximasSessoes();
  // A lista não traz a fila de filmes; o detalhe traz.
  const { data: sessao, isLoading: carregandoDetalhe } = useSessao(sessoes?.[0]?.id);
  const isLoading = carregandoLista || carregandoDetalhe;

  const [codigo, setCodigo] = useState('');
  const [erroDoConvite, setErroDoConvite] = useState('');
  const entrarNaSessao = useEntrarComCodigo();

  const entrar = async () => {
    if (!codigo.trim()) return;
    setErroDoConvite('');
    try {
      await entrarNaSessao.mutateAsync(codigo);
      setCodigo('');
    } catch {
      // A mesma mensagem para código inexistente, expirado e revogado — o
      // servidor já não distingue os três de propósito, e distinguir aqui
      // desfaria isso.
      setErroDoConvite('CONVITE INVÁLIDO OU EXPIRADO.');
    }
  };

  const steps = etapasDaPreparacao(sessao);
  const movies = (sessao?.session_movies ?? []).map(paraLinhaDaFila);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', color: 'var(--film)', paddingBottom: 120 }}>
      {/* Ruído Cinematográfico */}
      <div className="fixed inset-0 bg-noise opacity-[0.03] mix-blend-overlay pointer-events-none z-50" />
      
      {/* Note que a <Sidebar /> foi removida para evitar duplicação com o layout.tsx, como fizemos na Library */}

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '120px 72px 0' }}>
        
        {/* ── CABEÇALHO DA SESSÃO (Manifesto) ── */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, ease: FINE_ART_EASE }}
          style={{ display: 'flex', flexDirection: 'column', marginBottom: 80 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid rgba(237,232,220,0.05)', paddingBottom: 32 }}>
            <div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: 'var(--gold)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 16 }}>
                [ MANIFESTO DA SESSÃO ]
              </div>
              <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(4rem, 6vw, 5.5rem)', fontWeight: 400, margin: 0, lineHeight: 1, letterSpacing: '-0.02em' }}>
                {sessao ? `${sessao.emoji ?? ''} ${sessao.name}`.trim() : 'Sem sessão agendada.'}
              </h1>
            </div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: 'var(--m3)', letterSpacing: '0.15em', textTransform: 'uppercase', textAlign: 'right' }}>
              {/* Era "HOJE, 19:45", literal, mesmo sem sessão nenhuma. */}
              <div>PROJEÇÃO AGENDADA</div>
              <div style={{ color: 'var(--film)', marginTop: 4 }}>
                {sessao?.scheduled_date ? formataAgendamento(sessao.scheduled_date) : '—'}
              </div>
            </div>
          </div>
          
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.8rem', color: 'var(--m2)', fontStyle: 'italic', margin: '32px 0 0 0', maxWidth: 800 }}>
            {sessao?.description || 'Sem descrição.'}
          </p>
        </motion.div>

        {/* ── TIMELINE (Telemetria do Sistema) ── */}
        <motion.div 
          initial="hidden" 
          animate="visible"
          variants={{
            visible: { transition: { staggerChildren: 0.2 } }
          }}
          style={{ marginBottom: 100 }}
        >
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: 'var(--m3)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 24 }}>
            [ PROGRESSO DA ORQUESTRAÇÃO ]
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
            {steps.map((step, i) => (
              <TelemetryStep key={i} step={step} index={i} />
            ))}
          </div>
        </motion.div>

        {/* ── FILA DE MÍDIA (O Rolo de Filme) ── */}
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4, duration: 1, ease: FINE_ART_EASE }}
          style={{ marginBottom: 80 }}
        >
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: 'var(--m3)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 24, borderBottom: '1px solid rgba(237,232,220,0.05)', paddingBottom: 16 }}>
            [ FILA DE EXIBIÇÃO ]
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
            {isLoading && (
              <div style={{ padding: '48px 0', fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'var(--m3)', letterSpacing: '0.2em' }}>
                CONSULTANDO AGENDA...
              </div>
            )}

            {!isLoading && !sessao && (
              // Antes esta fila mostrava três filmes escritos no código, com
              // barra de download animada. Sem sessão agendada, o honesto é
              // dizer que não há — e apontar o caminho.
              <div style={{ padding: '56px 0', borderTop: '1px solid rgba(237,232,220,0.05)' }}>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', color: 'var(--m2)', marginBottom: 12 }}>
                  Nenhuma projeção agendada.
                </div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'var(--m3)', letterSpacing: '0.15em', lineHeight: 1.8 }}>
                  UMA SESSÃO REÚNE FILMES DO ACERVO NUMA NOITE, BUSCA AS CÓPIAS E<br />
                  DEIXA TUDO PRONTO ANTES DA HORA MARCADA.
                </div>
                <div style={{ display: 'flex', gap: 32, marginTop: 28, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <Link href="/party" style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'var(--gold)', letterSpacing: '0.2em', textDecoration: 'none', borderBottom: '1px solid rgba(191,143,60,0.4)', paddingBottom: 4 }}>
                    [ AGENDAR UMA SESSÃO ]
                  </Link>
                  <Link href="/library" style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'var(--m3)', letterSpacing: '0.2em', textDecoration: 'none', borderBottom: '1px solid rgba(86,84,80,0.4)', paddingBottom: 4 }}>
                    [ PERCORRER O ACERVO ]
                  </Link>
                </div>

                {/* Quem recebe um convite tem o código, não o endereço da
                    sessão — o id é resolvido no servidor a partir dele. Sem
                    este campo o convite não tinha onde ser usado, e a
                    funcionalidade só existia por API. */}
                <div style={{ marginTop: 56, paddingTop: 32, borderTop: '1px solid rgba(237,232,220,0.05)' }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: 'var(--m3)', letterSpacing: '0.2em', marginBottom: 16 }}>
                    RECEBEU UM CONVITE?
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, maxWidth: 460 }}>
                    <input
                      type="text" value={codigo} onChange={(e) => { setCodigo(e.target.value); setErroDoConvite(''); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') entrar(); }}
                      placeholder="COLE O CÓDIGO AQUI"
                      style={{ flex: 1, background: 'rgba(237,232,220,0.02)', border: 'none', borderBottom: '1px solid var(--m3)', padding: '12px 8px', color: 'var(--film)', fontFamily: "'DM Mono', monospace", fontSize: '11px', letterSpacing: '0.12em', outline: 'none' }}
                    />
                    <button onClick={entrar} disabled={entrarNaSessao.isPending}
                      style={{ background: 'rgba(0,0,0,0)', border: '1px solid rgba(191,143,60,0.5)', color: 'var(--gold)', padding: '12px 20px', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', cursor: entrarNaSessao.isPending ? 'wait' : 'pointer' }}>
                      {entrarNaSessao.isPending ? '[ ENTRANDO... ]' : '[ ENTRAR ]'}
                    </button>
                  </div>
                  {erroDoConvite && (
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: 'var(--terra)', letterSpacing: '0.15em', marginTop: 14 }}>
                      {erroDoConvite}
                    </div>
                  )}
                </div>
              </div>
            )}

            {!isLoading && sessao && movies.length === 0 && (
              <div style={{ padding: '48px 0', fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'var(--m3)', letterSpacing: '0.2em' }}>
                SESSÃO SEM FILMES SELECIONADOS.
              </div>
            )}

            {movies.map((movie, i) => (
              <SessionMovieRow 
                key={movie.id} 
                movie={movie} 
                index={i} 
                router={router} 
              />
            ))}
          </div>
          </div>
        </motion.div>

        {/* ── BARRA DE COMANDO PRINCIPAL (Action Bar Animada) ── */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8, duration: 1, ease: FINE_ART_EASE }}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(237,232,220,0.05)', paddingTop: 40 }}
        >
          {/* Botão Primário (Agora funciona e tem gravidade) */}
          <motion.button 
            onClick={() => router.push('/player')}
            whileHover={{ scale: 1.02, backgroundColor: '#d4a34b' }}
            whileTap={{ scale: 0.98 }}
            style={{ 
              backgroundColor: 'var(--gold)', color: 'var(--bg)', border: 'none', padding: '16px 32px', cursor: 'pointer',
              fontFamily: "'DM Mono', monospace", fontSize: '11px', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase',
              display: 'flex', alignItems: 'center', gap: 12
            }}
          >
            [ INICIAR PROJEÇÃO ] 
            <motion.div animate={{ x: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}>
              <ArrowRight style={{ width: 14, height: 14 }} />
            </motion.div>
          </motion.button>

          {/* Configurações de Sistema (Com hover sutil de escala e cor) */}
          <div style={{ display: 'flex', gap: 32 }}>
            <motion.button 
              whileHover={{ color: 'var(--film)', y: -2 }}
              whileTap={{ scale: 0.95 }}
              style={{ 
                background: 'transparent', border: 'none', color: 'var(--m3)', cursor: 'pointer',
                fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase',
                display: 'flex', alignItems: 'center', gap: 8
              }}
            >
              <Cast style={{ width: 12, height: 12 }} /> CAST DE TELA
            </motion.button>
            <motion.button 
              whileHover={{ color: 'var(--film)', y: -2 }}
              whileTap={{ scale: 0.95 }}
              style={{ 
                background: 'transparent', border: 'none', color: 'var(--m3)', cursor: 'pointer',
                fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase',
                display: 'flex', alignItems: 'center', gap: 8
              }}
            >
              <SlidersHorizontal style={{ width: 12, height: 12 }} /> AUTO-QUALITY
            </motion.button>
            <motion.button 
              whileHover={{ color: 'var(--film)', y: -2 }}
              whileTap={{ scale: 0.95 }}
              style={{ 
                background: 'transparent', border: 'none', color: 'var(--m3)', cursor: 'pointer',
                fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase'
              }}
            >
              [ SYNC PLEX ]
            </motion.button>
          </div>
        </motion.div>

      </main>
    </div>
  );
}