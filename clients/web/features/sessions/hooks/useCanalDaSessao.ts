'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { http } from '@/services/http/client';

import type { CinemaSession } from './useSessoes';

/**
 * Canal ao vivo de uma sessão: presença, chat e posição de cada espectador.
 *
 * A conexão é autenticada por ticket de uso único, não pelo JWT: um token na
 * query string acaba em log de servidor e em histórico de navegador, e vale
 * por toda a sua vida útil. O ticket vale trinta segundos e some no primeiro
 * uso, então vazá-lo não serve de nada.
 */

const INTERVALO_DE_PING_MS = 25_000;
const ESPERA_MINIMA_MS = 1_000;
const ESPERA_MAXIMA_MS = 30_000;

export interface Participante {
  id: string;
  username: string;
  display_name: string;
  role: 'host' | 'guest';
  present: boolean;
  playback_position_seconds: number;
  playback_state: 'playing' | 'paused' | 'buffering';
}

export interface AlternativaDaEnquete {
  id: string;
  label: string;
  votes: number;
}

export interface Enquete {
  id: string;
  question: string;
  options: AlternativaDaEnquete[];
  total_votes: number;
  /** Em que este usuário votou, ou null. Vem do servidor: guardar o voto só
   *  no navegador foi como a versão de mentira funcionava, e recarregar a
   *  página apagava o voto. */
  my_vote: string | null;
  closed: boolean;
}

export interface Fala {
  id: string;
  text: string;
  author: string;
  is_self: boolean;
  poll: Enquete | null;
  playback_position_seconds: number;
  created_at: string;
}

type Estado = 'conectando' | 'aberto' | 'fechado';

export function useCanalDaSessao(sessionId: string | undefined) {
  const [estado, setEstado] = useState<Estado>('fechado');
  const [sessao, setSessao] = useState<CinemaSession | null>(null);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [falas, setFalas] = useState<Fala[]>([]);

  const socket = useRef<WebSocket | null>(null);
  const tentativas = useRef(0);
  const desmontado = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const limpaTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const conecta = useCallback(async () => {
    if (!sessionId || desmontado.current) return;

    setEstado('conectando');
    let ticket: string;
    try {
      ({ ticket } = await http.post<{ ticket: string }>('/api/auth/ws-ticket/', {}));
    } catch {
      return agendaNovaTentativa();
    }

    const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000')
      .replace(/^http/, 'ws');
    const ws = new WebSocket(`${base}/ws/sessions/${sessionId}/?ticket=${ticket}`);
    socket.current = ws;

    ws.onopen = () => {
      tentativas.current = 0;
      setEstado('aberto');
    };

    ws.onmessage = (evento) => {
      let msg: { type: string; payload: unknown };
      try {
        msg = JSON.parse(evento.data);
      } catch {
        return;
      }

      if (msg.type === 'session_state') {
        setSessao(msg.payload as CinemaSession);
      } else if (msg.type === 'participants') {
        setParticipantes((msg.payload as { participants: Participante[] }).participants);
      } else if (msg.type === 'chat') {
        // Concatena em vez de substituir: o servidor manda uma fala por vez.
        setFalas((anteriores) => [...anteriores, msg.payload as Fala]);
      } else if (msg.type === 'poll') {
        // O servidor manda a enquete INTEIRA a cada voto: o placar depende de
        // todos os votos, e recontá-lo a partir de eventos soltos daria
        // números diferentes para quem entrou depois.
        const enquete = msg.payload as Enquete;
        setFalas((anteriores) =>
          anteriores.map((f) =>
            f.poll && f.poll.id === enquete.id ? { ...f, poll: enquete } : f,
          ),
        );
      } else if (msg.type === 'sync') {
        const { participant_id, position, state } = msg.payload as {
          participant_id: string; position: number; state: Participante['playback_state'];
        };
        setParticipantes((anteriores) =>
          anteriores.map((p) =>
            p.id === participant_id
              ? { ...p, playback_position_seconds: position, playback_state: state }
              : p,
          ),
        );
      }
    };

    ws.onclose = () => {
      setEstado('fechado');
      agendaNovaTentativa();
    };

    // Mantém a conexão viva através de proxies que derrubam ocioso.
    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
    }, INTERVALO_DE_PING_MS);
    ws.addEventListener('close', () => clearInterval(ping));
  }, [sessionId]);

  /**
   * Reconecta com espera crescente.
   *
   * Sem o recuo, uma queda do servidor viraria uma tempestade de conexões
   * vindas de todos os espectadores ao mesmo tempo, justamente quando ele
   * está com dificuldade.
   */
  const agendaNovaTentativa = useCallback(() => {
    if (desmontado.current) return;
    const espera = Math.min(ESPERA_MINIMA_MS * 2 ** tentativas.current, ESPERA_MAXIMA_MS);
    tentativas.current += 1;
    timers.current.push(setTimeout(() => void conecta(), espera));
  }, [conecta]);

  useEffect(() => {
    desmontado.current = false;
    void conecta();
    return () => {
      desmontado.current = true;
      limpaTimers();
      socket.current?.close();
    };
  }, [conecta]);

  const envia = useCallback((mensagem: Record<string, unknown>) => {
    if (socket.current?.readyState === WebSocket.OPEN) {
      socket.current.send(JSON.stringify(mensagem));
      return true;
    }
    return false;
  }, []);

  const dizAlgo = useCallback(
    (texto: string, posicao: number) =>
      envia({ type: 'chat', text: texto, position: Math.floor(posicao) }),
    [envia],
  );

  const criaEnquete = useCallback(
    (pergunta: string, alternativas: string[], posicao: number) =>
      envia({ type: 'poll', question: pergunta, options: alternativas,
              position: Math.floor(posicao) }),
    [envia],
  );

  const vota = useCallback(
    (pollId: string, optionId: string) =>
      envia({ type: 'vote', poll_id: pollId, option_id: optionId }),
    [envia],
  );

  const reportaPosicao = useCallback(
    (posicao: number, estadoDoVideo: Participante['playback_state']) =>
      envia({ type: 'sync', position: Math.floor(posicao), state: estadoDoVideo }),
    [envia],
  );

  return { estado, sessao, participantes, falas, setFalas, dizAlgo,
           criaEnquete, vota, reportaPosicao };
}
