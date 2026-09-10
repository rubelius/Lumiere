'use client';
import { useState, useEffect, useRef, Suspense } from "react";
import { FINE_ART_EASE } from '@/lib/motion';
import Image from 'next/image';
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { Tv, MonitorPlay } from "lucide-react";

import { PlayerTopBar, PlayerBottomControls, PlayerDiagnosticPanel } from "@/components/player/PlayerUI";
import { useMovie, usePlayback, useSubtitles } from "@/features/movies/hooks/useMovies";
import { PLAYERS, urlDaLegenda } from "@/features/movies/playerExterno";
import { RESTO_MINIMO_S, RETOMADA_MINIMA_S, duracaoDoFilme, ehConvertida,
         pontoDeRetomada, tempoDaCue, urlDoVideo } from "@/features/movies/fonteDeVideo";
import { useProgressoDeExibicao } from '@/features/movies/hooks/useProgressoDeExibicao';


function PlayerExperience() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const movieId = searchParams.get('id') || '';
  // Qual cópia tocar. Sem isto, apontar uma cópia específica na lista levava
  // ao player e tocava outra — ou nenhuma.
  const releaseId = searchParams.get('release') || undefined;
  const { data: movie, isLoading: carregandoFilme } = useMovie(movieId);
  const { reporta: reportaProgresso, reportaAgora } = useProgressoDeExibicao(movieId);
  const jaRetomou = useRef(false);
  // Real-Debrid > Jellyfin > Plex, resolvido no backend.
  const { data: fonte, isLoading: resolvendoFonte } = usePlayback(movieId, releaseId);
  const { data: legendas } = useSubtitles(movieId);
  // Índice da faixa ativa; null = desligada. O acervo é de cinema estrangeiro,
  // então a primeira (pt-BR, por causa da ordem pedida na busca) entra ligada.
  const [legendaAtiva, setLegendaAtiva] = useState<number | null>(0);
  // Deslocamento em segundos. Positivo atrasa a legenda, negativo adianta.
  const [atrasoLegenda, setAtrasoLegenda] = useState(0);
  // Tempos originais indexados pela PRÓPRIA cue, não pela posição na lista:
  // o navegador reordena as cues por tempo de início quando um deles muda, e
  // um índice posicional passaria a apontar para a cue errada — o que
  // embaralhava as legendas ao voltar de um deslocamento grande.
  // Sem guardar os originais, além disso, cada ajuste partiria do tempo já
  // deslocado e o erro se acumularia a cada clique.
  const temposOriginais = useRef(new WeakMap<TextTrackCue, { inicio: number; fim: number }>());
  // Contador para reexecutar o efeito quando um arquivo de legenda termina de
  // carregar. Reatribuir o mesmo atraso não serviria: o React compara com
  // Object.is e não re-renderiza.
  const [cuesCarregadas, setCuesCarregadas] = useState(0);
  
  const [mounted, setMounted] = useState(false);
  const [isExiting, setIsExiting] = useState(false); 
  
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isWaiting, setIsWaiting] = useState(true);
  const [progress, setProgress] = useState(0);
  const [bufferedPercent, setBufferedPercent] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [activeMenu, setActiveMenu] = useState<"settings" | "subs" | "cast" | null>(null);
  const [playerExternoAberto, setPlayerExternoAberto] = useState(false);
  // A <track> do player usa caminho relativo porque é servida pela mesma
  // origem; um aplicativo de fora precisa do endereço completo.
  const legendaExterna = legendas?.[0]?.file_id
    ? urlDaLegenda(legendas[0].file_id)
    : undefined;
  const [activeTab, setActiveTab] = useState<"video" | "audio" | "sub">("video"); 
  const [playbackMode, setPlaybackMode] = useState<"local" | "jellyfin" | "direct">("local");
  // Resolução medida no próprio elemento, em vez do "145 MBPS" que era fixo.
  const [resolution, setResolution] = useState<string | null>(null);

  // Em que segundo do FILME começa o fluxo que está no ar.
  //
  // Zero no caminho direto, e sempre: ali o arquivo inteiro está disponível e
  // o elemento anda pelo arquivo. No convertido o ffmpeg é ligado a partir de
  // um ponto, então o `currentTime` do elemento conta a partir DALI — sem
  // somar este deslocamento, saltar para 1h faria o relógio voltar a zero.
  // O deslocamento tem duas origens: o ponto onde a pessoa parou (derivado, e
  // conhecido antes de pedir qualquer byte) e os saltos dela (estado). Manter
  // o derivado FORA do estado é o que faz a primeira requisição já sair no
  // segundo certo — antes, a tela pedia o filme do começo e trocava logo
  // depois, deixando um ffmpeg inteiro nascer e morrer a cada abertura.
  const [saltouPara, setSaltouPara] = useState<number | null>(null);

  // Congelado na primeira vez que dá para responder, e nunca mais.
  //
  // Recalculando, o ponto de partida seguia o `watch_state` — que o próprio
  // player atualiza a cada trinta segundos. Cada gravação de progresso mudava
  // o `src` e religava o ffmpeg no ponto novo: o filme reiniciava sozinho, em
  // laço, meio minuto após o outro. Verificado no log do servidor, dois fluxos
  // por reprodução, o segundo exatamente 30s adiante do primeiro.
  const partidaCongelada = useRef<number | null>(null);
  if (partidaCongelada.current === null && !carregandoFilme && fonte) {
    partidaCongelada.current = pontoDeRetomada(
      fonte,
      movie?.watch_state?.progress_seconds,
      movie?.watch_state?.completed,
      duracaoDoFilme(fonte, NaN, movie?.length_minutes),
    );
  }
  const partida = partidaCongelada.current ?? 0;
  const deslocamento = saltouPara ?? partida;
  const setDeslocamento = setSaltouPara;
  const convertida = ehConvertida(fonte);

  // O `src` só sai quando o ponto de partida está decidido.
  //
  // `movie` traz o watch_state e costuma chegar depois de `fonte`. Deixando o
  // elemento pedir antes, a primeira requisição saía do segundo zero e era
  // trocada meio segundo depois — um ffmpeg inteiro nascendo, puxando do
  // Real-Debrid e morrendo, a cada abertura do player.
  const src = carregandoFilme ? undefined : urlDoVideo(fonte, movieId, deslocamento);

  // O relógio começa onde o filme começa. Sem isto a tela mostra 00:00 até o
  // primeiro `timeupdate` — e num filme retomado aos 32 minutos, pausado, ela
  // mostraria 00:00 indefinidamente.
  useEffect(() => {
    setCurrentTime(deslocamento + (videoRef.current?.currentTime ?? 0));
  }, [deslocamento]);

  // E a duração também não precisa esperar o elemento carregar: no caminho
  // convertido ela veio do ffprobe junto com a fonte. Esperar o `metadata`
  // deixava "00:00" no lugar do total — e, pior, `totalTime` em 0 é o valor
  // que desliga a barra e o salto.
  useEffect(() => {
    const derivada = duracaoDoFilme(fonte, NaN, movie?.length_minutes);
    if (derivada > 0) setTotalTime(derivada);
  }, [fonte, movie]);
  // O fluxo caiu. Estado próprio porque o <video> não conta a ninguém.
  const [falhouOFluxo, setFalhouOFluxo] = useState(false);
  // Religar o fluxo recarrega o elemento, e ele volta pausado. Sem lembrar o
  // que estava acontecendo, todo salto exigiria apertar play de novo.
  const tocavaAoSaltar = useRef(false);
  const deslocamentoNoAr = useRef(0);

  // 1. 👇 CICLO DE VIDA BLINDADO
  useEffect(() => {
    setMounted(true);
    // Trava o scroll e garante que o body não tenha margens estranhas
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';

    return () => {
      // Limpeza absoluta ao desmontar
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, []);

  // 2. 👇 NAVEGAÇÃO DE RETORNO SEM TRAVAMENTO
  const handleBack = () => {
    // Para o som imediatamente
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = ""; // Libera o buffer de rede
      videoRef.current.load();
    }

    // Inicia o fade-out da UI
    setIsExiting(true);

    // Limpa os estilos do body ANTES de navegar para a Home não herdar o bloqueio
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';

    // Pequeno delay para o React processar a destruição do Portal
    setTimeout(() => {
      setMounted(false);
      router.push('/'); // Usar push('/') as vezes é mais seguro que back() em Portals
    }, 300);
  };

  // Auto-hide controls
  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      if (isPlaying) {
        controlsTimeoutRef.current = setTimeout(() => {
          if (!activeMenu) setShowControls(false);
        }, 3000);
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => { window.removeEventListener("mousemove", handleMouseMove); };
  }, [isPlaying, activeMenu]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume / 100;
      videoRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  // Religar o fluxo convertido noutro ponto.
  //
  // Trocar o `src` já manda o navegador recarregar, mas ele volta pausado —
  // e um salto que pausa o filme se lê como travamento. O `load()` explícito
  // está aqui porque o navegador pode reaproveitar o fluxo anterior quando só
  // a query muda, e aí o vídeo continuaria do ponto velho.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !convertida) return;
    // Na primeira montagem não há salto nenhum a refazer: recarregar aqui
    // abortaria o fluxo que acabou de começar a chegar.
    if (deslocamentoNoAr.current === deslocamento) return;
    deslocamentoNoAr.current = deslocamento;

    video.load();
    if (tocavaAoSaltar.current) {
      video.play().catch(() => {
        // O navegador recusa play() sem gesto do usuário em algumas
        // situações. O salto continua válido; só não retoma sozinho.
      });
    }
  }, [deslocamento, convertida]);

  // O <track> nasce com mode 'disabled'; quem manda de fato é a TextTrack API.
  // Fazer isso aqui (e não pelo atributo `default`) mantém uma única fonte de
  // verdade para qual legenda está ligada.
  useEffect(() => {
    const faixas = videoRef.current?.textTracks;
    if (!faixas) return;

    const aplicar = () => {
      for (let i = 0; i < faixas.length; i++) {
        const desejado = i === legendaAtiva ? 'showing' : 'disabled';
        // Só escreve quando difere: atribuir dispara 'change' e entraria em laço.
        if (faixas[i].mode !== desejado) faixas[i].mode = desejado;
      }
      aplicarAtraso();
    };

    const aplicarAtraso = () => {
      for (let i = 0; i < faixas.length; i++) {
        const cues = faixas[i].cues;
        if (!cues || cues.length === 0) continue;

        // Snapshot antes de mexer: alterar um tempo reordena a lista viva, e
        // iterar sobre ela pularia ou repetiria cues.
        for (const cue of Array.from(cues)) {
          let original = temposOriginais.current.get(cue);
          if (!original) {
            // Primeira vez que vemos esta cue: os tempos aqui são os do
            // arquivo, ainda sem deslocamento.
            original = { inicio: cue.startTime, fim: cue.endTime };
            temposOriginais.current.set(cue, original);
          }
          const { inicio, fim } = tempoDaCue(original, atrasoLegenda, deslocamento);
          cue.startTime = inicio;
          cue.endTime = fim;
        }
      }
    };

    aplicar();
    // O navegador liga uma faixa por conta própria quando as cues terminam de
    // carregar, o que sobrepunha duas legendas na tela. Reaplicar nesses
    // eventos garante uma única ativa.
    faixas.addEventListener('addtrack', aplicar);
    faixas.addEventListener('change', aplicar);
    return () => {
      faixas.removeEventListener('addtrack', aplicar);
      faixas.removeEventListener('change', aplicar);
    };
  }, [legendaAtiva, legendas, atrasoLegenda, cuesCarregadas, deslocamento]);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const togglePlay = async () => {
    if (!videoRef.current) return;
    try {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        await videoRef.current.play();
      }
    } catch (error) {
      console.error("Playback error:", error);
    }
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) await containerRef.current.requestFullscreen();
      else await document.exitFullscreen();
    } catch (err) {
      console.error("Fullscreen error:", err);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const curr = deslocamento + videoRef.current.currentTime;
      setCurrentTime(curr);
      if (totalTime > 0) setProgress((curr / totalTime) * 100);

      // O hook decide quando de fato envia: `timeupdate` dispara umas quatro
      // vezes por segundo. A duração vem do arquivo, não do metadado do
      // acervo — num REMUX os dois divergem em minutos.
      // Só reporta contra uma duração que signifique alguma coisa.
      //
      // No fluxo convertido a duração do elemento é o tamanho do buffer, e
      // usá-la marcaria como assistido um filme de duas horas aos três
      // segundos. Quando `totalTime` é 0 — ffprobe falhou E o catálogo não
      // sabe a duração — não há a que comparar, e reportar nada é melhor que
      // reportar contra o buffer.
      const escala = convertida ? totalTime : (totalTime || videoRef.current.duration);
      if (escala > 0) reportaProgresso(curr, escala);
    }
  };

  const handleProgress = () => {
    if (videoRef.current && videoRef.current.buffered.length > 0 && totalTime > 0) {
      const fim = deslocamento
        + videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
      setBufferedPercent((fim / totalTime) * 100);
    }
  };

  /** Até que segundo do filme o buffer atual alcança. */
  const bufferAte = () => {
    const v = videoRef.current;
    if (!v || v.buffered.length === 0) return deslocamento;
    return deslocamento + v.buffered.end(v.buffered.length - 1);
  };

  /**
   * Levar a reprodução ao segundo `alvo` do FILME.
   *
   * Caminho único de propósito: a barra e os botões de ±10s mandavam cada um
   * do seu jeito, e o dos botões escrevia `currentTime` cru. No fluxo
   * convertido isso não é impreciso, é inerte — `seekable` vem vazio e a
   * atribuição não faz nada, sem erro nenhum.
   */
  const vaiPara = (alvo: number) => {
    const video = videoRef.current;
    // Sem escala não há para onde ir: `totalTime` é 0 enquanto a duração não
    // se sabe, e seguir daqui mandaria o filme para o segundo zero a cada
    // clique.
    if (!video || !(totalTime > 0)) return;

    const destino = Math.min(Math.max(alvo, 0), totalTime);
    setProgress((destino / totalTime) * 100);

    if (!convertida) {
      // Arquivo pronto na CDN: o elemento salta sozinho, por range request.
      video.currentTime = destino;
      setCurrentTime(destino);
      return;
    }

    // Fluxo sendo convertido agora, e aqui saltar tem dois preços.
    //
    // Dentro do que já chegou o elemento anda sozinho e é instantâneo. Fora
    // disso é preciso religar o ffmpeg noutro ponto: ~5 segundos até o
    // primeiro quadro, medidos, e o buffer inteiro vai fora. Então o barato
    // é tentado primeiro, e o caro só quando não há alternativa.
    const local = destino - deslocamento;
    if (destino >= deslocamento
        && destino <= bufferAte() - MARGEM_DO_BUFFER_S
        && aceitaSalto(video, local)) {
      video.currentTime = local;
      setCurrentTime(destino);
      return;
    }

    // Fora do buffer: o fluxo é reaberto a partir daqui. O relógio é
    // adiantado na hora em vez de esperar o primeiro quadro — a alternativa
    // é a barra voltar ao ponto antigo por cinco segundos e depois pular,
    // que se lê como travamento.
    tocavaAoSaltar.current = isPlaying;
    setDeslocamento(destino);
    setCurrentTime(destino);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    vaiPara(((e.clientX - rect.left) / rect.width) * totalTime);
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "00:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const playerContent = (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: isExiting ? 0 : 1 }}
      transition={{ duration: 0.3, ease: FINE_ART_EASE }}
      ref={containerRef} 
      className={`fixed inset-0 bg-[var(--void)] text-[var(--film)] overflow-hidden ${!showControls && isPlaying ? 'cursor-none' : ''}`} 
      style={{ fontFamily: "'DM Mono', monospace", zIndex: 9999999, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
    >
      
      {playbackMode === "local" ? (
        <div className="absolute inset-0">
          <video 
            ref={videoRef}
            src={src}
            playsInline
            className="w-full h-full object-cover"
            style={{
              transform: isPlaying ? 'scale(1.02)' : 'scale(1)',
              transition: 'transform 30s ease-linear',
              filter: 'grayscale(30%) contrast(1.1) brightness(0.6)'
            }}
            onError={() => {
              // Sem isto a tela gira "AQUISIÇÃO DE STREAM" para sempre: o
              // <video> falha em silêncio, e o único sinal é o filme que
              // nunca começa.
              setIsWaiting(false);
              setFalhouOFluxo(true);
            }}
            onPlay={() => { setIsPlaying(true); setFalhouOFluxo(false); }}
            onPause={() => { setIsPlaying(false); reportaAgora(); }}
            onEnded={() => {
              reportaAgora();
              // Um fluxo convertido que morre no meio NÃO gera evento `error`.
              // Verificado matando o ffmpeg com o filme rodando: o navegador
              // registra só `suspend`, fica com `networkState: IDLE` e dispara
              // `ended` ao esgotar o buffer — ou seja, a interrupção chega
              // disfarçada de fim de filme.
              //
              // A diferença entre as duas está no relógio: um filme que
              // termina termina perto do fim.
              const onde = deslocamento + (videoRef.current?.currentTime ?? 0);
              if (totalTime > 0 && onde < totalTime - FIM_ACEITAVEL_S) {
                setFalhouOFluxo(true);
              }
            }}
            onTimeUpdate={handleTimeUpdate}
            onProgress={handleProgress}
            onLoadedMetadata={() => {
              if (videoRef.current) {
                const duracao = duracaoDoFilme(
                  fonte, videoRef.current.duration, movie?.length_minutes);
                setTotalTime(duracao);
                const { videoWidth: w, videoHeight: h } = videoRef.current;
                if (w && h) setResolution(`${w}×${h}`);

                // Retoma de onde parou. Uma vez só por carga: `loadedmetadata`
                // dispara de novo a cada troca de fonte, e reposicionar depois
                // que o usuário já buscou outro ponto arrancaria o filme de
                // onde ele acabou de escolher ficar.
                const parou = movie?.watch_state?.progress_seconds ?? 0;
                const terminou = movie?.watch_state?.completed;
                // Só o caminho direto retoma aqui. No convertido o ponto de
                // partida já entrou na URL do primeiro pedido — `pontoDeRetomada`
                // decide com a duração que veio do ffprobe, sem precisar que o
                // elemento carregue nada.
                if (!convertida && !jaRetomou.current
                    && parou > RETOMADA_MINIMA_S && !terminou
                    && duracao > 0 && parou < duracao - RESTO_MINIMO_S) {
                  jaRetomou.current = true;
                  videoRef.current.currentTime = parou;
                  setCurrentTime(parou);
                }
              }
              setIsWaiting(false);
            }}
            onWaiting={() => setIsWaiting(true)}
            onCanPlay={() => setIsWaiting(false)}
            onClick={togglePlay}
          >
            {/* Servidas pela mesma origem (rota do Next): uma <track> de outra
                origem exigiria crossOrigin no <video>, e isso quebraria o
                stream do Real-Debrid, cuja CDN não devolve cabeçalhos CORS. */}
            {(legendas || []).map((leg) => (
              <track
                key={leg.file_id}
                kind="subtitles"
                src={`/api/subtitles/${leg.file_id}/vtt`}
                srcLang={leg.idioma}
                label={`${leg.idioma}${leg.hearing_impaired ? ' (SDH)' : ''}`}
                // As cues só existem depois que o arquivo carrega; sem isto o
                // deslocamento não pegaria na primeira exibição.
                onLoad={() => setCuesCarregadas((n) => n + 1)}
              />
            ))}
          </video>
          <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at center, transparent 30%, rgba(4,4,2,0.8) 100%)', pointerEvents: 'none' }} />
          <div className="absolute inset-0 bg-noise opacity-[0.04] mix-blend-overlay pointer-events-none" />
        </div>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
           <Image src="/images/backgrounds/chefao.jpg" alt="Poster" fill sizes="100vw" className="object-cover blur-md" style={{ filter: 'grayscale(30%) contrast(1.1) brightness(0.4)' }} />
           <motion.div animate={{ scale: [1, 1.05, 1], opacity: [0.8, 1, 0.8] }} transition={{ repeat: Infinity, duration: 4 }} className="z-10 flex flex-col items-center gap-8">
             {playbackMode === "jellyfin" ? <Tv style={{ width: 64, height: 64, color: 'var(--gold)' }} /> : <MonitorPlay style={{ width: 64, height: 64, color: 'var(--gold)' }} />}
             <div style={{ textAlign: 'center' }}>
               <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '3rem', margin: 0 }}>Projetando em Tela Externa</h2>
               <p style={{ fontSize: '10px', letterSpacing: '0.2em', color: 'var(--m2)', marginTop: 8 }}>{playbackMode === "jellyfin" ? "JELLYFIN NATIVE CLIENT" : "DIRECT PLAY PASSTHROUGH"}</p>
             </div>
           </motion.div>
        </div>
      )}

      {!resolvendoFonte && !fonte && playbackMode === "local" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 z-40" style={{ backgroundColor: 'var(--void)' }}>
          <div style={{ width: 48, height: 48, border: '1px solid rgba(86,84,80,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MonitorPlay style={{ width: 20, height: 20, color: 'var(--m3)' }} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', color: 'var(--film)' }}>Sem fonte disponível.</div>
            <p style={{ fontSize: '10px', letterSpacing: '0.2em', color: 'var(--m3)', textTransform: 'uppercase', marginTop: 12, lineHeight: 2 }}>
              Nenhuma cópia em Real-Debrid, Jellyfin ou Plex
            </p>
          </div>
        </div>
      )}

      {/* Abrir fora do navegador.
          O <video> não decodifica DTS, TrueHD nem Dolby Digital — medido com
          canPlayType — e são justamente as faixas das cópias de maior nota.
          Um REMUX 2160p toca no VLC e cala aqui. O link cru fica ao lado
          porque nenhum esquema de player confirma nada de volta: o navegador
          dispara e não fica sabendo se algum aplicativo atendeu. */}
      {fonte?.stream_url && (
        <div className="absolute z-50" style={{ top: 24, right: 24 }}>
          <button
            onClick={() => setPlayerExternoAberto((v) => !v)}
            title="Abrir num player externo"
            style={{ background: 'rgba(4,4,2,0.75)', border: '1px solid rgba(86,84,80,0.5)', color: 'var(--m2)', padding: '8px 12px', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', cursor: 'pointer', backdropFilter: 'blur(8px)' }}
          >
            [ ABRIR FORA ]
          </button>

          {playerExternoAberto && (
            <div style={{ marginTop: 8, minWidth: 260, background: 'var(--void)', border: '1px solid rgba(86,84,80,0.5)', padding: 14 }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', color: 'var(--m3)', letterSpacing: '0.15em', lineHeight: 1.9, marginBottom: 12 }}>
                O NAVEGADOR NÃO DECODIFICA DTS, TRUEHD NEM DOLBY DIGITAL. UM PLAYER EXTERNO TOCA.
              </div>

              {PLAYERS.map((p) => (
                <a
                  key={p.nome}
                  href={p.endereco(fonte.stream_url, legendaExterna)}
                  style={{ display: 'block', color: 'var(--gold)', border: '1px solid rgba(191,143,60,0.4)', padding: '9px 12px', marginBottom: 8, fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', textDecoration: 'none' }}
                >
                  [ {p.nome.toUpperCase()} ]
                  <span style={{ color: 'var(--m3)', fontSize: '7px', marginLeft: 8 }}>
                    {p.levaLegenda && legendaExterna ? 'COM LEGENDA' : 'SÓ O VÍDEO'}
                  </span>
                </a>
              ))}

              <button
                onClick={() => navigator.clipboard?.writeText(fonte.stream_url)}
                style={{ width: '100%', textAlign: 'left', background: 'transparent', border: '1px solid rgba(86,84,80,0.4)', color: 'var(--m2)', padding: '9px 12px', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', cursor: 'pointer' }}
              >
                [ COPIAR O LINK ]
              </button>

              {legendaExterna && (
                <a
                  href={legendaExterna}
                  download
                  style={{ display: 'block', marginTop: 8, color: 'var(--m2)', border: '1px solid rgba(86,84,80,0.4)', padding: '9px 12px', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', textDecoration: 'none' }}
                >
                  [ BAIXAR A LEGENDA ]
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {isWaiting && !falhouOFluxo && fonte && playbackMode === "local" && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-6 z-40">
          <motion.div 
            animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
            style={{ width: 40, height: 40, border: '1px solid rgba(237,232,220,0.1)', borderTop: '1px solid var(--gold)', borderRadius: '50%' }} 
          />
          <div style={{ fontSize: '9px', letterSpacing: '0.2em', color: 'var(--gold)', textTransform: 'uppercase' }}>
            {convertida ? 'CONVERTENDO O ÁUDIO...' : 'AQUISIÇÃO DE STREAM...'}
          </div>
        </div>
      )}

      {falhouOFluxo && playbackMode === "local" && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-4 z-40 text-center px-8">
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.75rem', color: 'var(--film)' }}>
            A projeção foi interrompida.
          </div>
          <div style={{ fontSize: '9px', letterSpacing: '0.2em', color: 'var(--m2)', textTransform: 'uppercase', maxWidth: 420, lineHeight: 1.8 }}>
            {convertida
              ? 'A conversão parou de responder. Tentar de novo religa o fluxo.'
              : 'A fonte parou de responder.'}
          </div>
          <button
            onClick={() => { setFalhouOFluxo(false); setIsWaiting(true); videoRef.current?.load(); }}
            style={{ marginTop: 8, background: 'transparent', border: '1px solid var(--gold)', color: 'var(--gold)',
                     padding: '10px 24px', fontSize: '9px', letterSpacing: '0.2em', cursor: 'pointer',
                     fontFamily: "'DM Mono', monospace" }}
          >
            TENTAR DE NOVO
          </button>
        </div>
      )}

      <AnimatePresence>
        {showControls && (
          <PlayerTopBar
            onBack={handleBack}
            title={movie?.title || 'Carregando…'}
            year={movie?.year}
            quality={movie?.best_quality_available || undefined}
            resolution={resolution}
            sourceLabel={fonte?.label}
            playbackMode={playbackMode}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showControls && (
          <PlayerBottomControls 
            currentTimeStr={formatTime(currentTime)}
            totalTimeStr={formatTime(totalTime)}
            progressPercent={progress}
            bufferedPercent={bufferedPercent}
            bufferedStartPercent={totalTime > 0 ? (deslocamento / totalTime) * 100 : 0}
            onSeek={handleSeek}
            isPlaying={isPlaying}
            onTogglePlay={togglePlay}
            onSkip={(amt: number) => vaiPara(currentTime + amt)}
            volume={volume}
            isMuted={isMuted}
            onVolumeChange={(e: any) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setVolume(((e.clientX - rect.left) / rect.width) * 100);
            }}
            onToggleMute={() => setIsMuted(!isMuted)}
            activeMenu={activeMenu}
            onToggleMenu={(m: any) => setActiveMenu(activeMenu === m ? null : m)}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeMenu && (
          <PlayerDiagnosticPanel 
            activeMenu={activeMenu} activeTab={activeTab} setActiveTab={setActiveTab} 
            playbackMode={playbackMode} setPlaybackMode={setPlaybackMode} onClose={() => setActiveMenu(null)}
            legendas={legendas || []}
            legendaAtiva={legendaAtiva}
            onSelecionarLegenda={setLegendaAtiva}
            atrasoLegenda={atrasoLegenda}
            onAjustarAtraso={(delta: number) =>
              setAtrasoLegenda((v) => Math.round((v + delta) * 10) / 10)}
            onZerarAtraso={() => setAtrasoLegenda(0)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );

  if (!mounted) return null;
  return createPortal(playerContent, document.body);
}

// Distância mínima da borda do buffer para um salto valer a pena.
//
// Cair a meio segundo do fim do que chegou é cair num ponto que existe e
// acaba na frente do dedo: o filme roda um instante e trava esperando rede.
// Cinco segundos de pista deixam o buffer voltar a crescer antes de ser
// alcançado.
const MARGEM_DO_BUFFER_S = 5;

// A que distância do fim um `ended` ainda conta como fim de filme. A duração
// vem do ffprobe sobre o mesmo arquivo que está tocando, então a folga não
// precisa ser grande — é só para o último fragmento não virar falso alarme.
const FIM_ACEITAVEL_S = 15;


/**
 * Se o elemento aceita ir a este segundo por conta própria.
 *
 * Um fluxo servido com `Accept-Ranges: none` pode chegar ao navegador como se
 * fosse transmissão ao vivo, e aí `seekable` vem vazio: atribuir `currentTime`
 * não faz nada — sem erro, sem evento, o filme simplesmente continua de onde
 * estava. Perguntar antes é o que distingue "não precisa religar o ffmpeg" de
 * "o clique não fez nada".
 */
function aceitaSalto(video: HTMLVideoElement, segundo: number): boolean {
  const faixas = video.seekable;
  for (let i = 0; i < faixas.length; i++) {
    if (segundo >= faixas.start(i) && segundo <= faixas.end(i)) return true;
  }
  return false;
}

export default function Player() {
  return (
    <Suspense fallback={null}>
      <PlayerExperience />
    </Suspense>
  );
}
