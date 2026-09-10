'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

import { http } from '@/services/http/client';
import { APIError } from '@/services/http/errors';

/**
 * O canal por onde o Lumière avisa que alguma coisa ficou pronta.
 *
 * O backend já tinha tudo isto escrito e desligado: o consumer em
 * `ws/notifications/`, o grupo por usuário, o modelo, o serviço. Faltava
 * alguém do lado de cá ouvindo — e é por isso que "baixar e me avisar" não
 * podia ser oferecido.
 *
 * O grupo é `notifications_{user.id}`, montado pelo próprio consumer a partir
 * do usuário autenticado do ticket: não há como entrar no canal de outra
 * pessoa pedindo.
 */

export interface Aviso {
  id: string;
  type: string;
  title: string;
  message: string;
  action_url?: string | null;
  action_text?: string | null;
  read?: boolean;
  created_at?: string;
}

type Estado = 'conectando' | 'aberto' | 'fechado' | 'sem-acesso';

/**
 * Falhas que reconectar não resolve — mesma regra do canal da sessão.
 *
 * O recuo exponencial trata toda falha como passageira. Para uma credencial
 * expirada isso vira uma fila de centenas de requisições numa aba esquecida
 * aberta, e nenhuma delas vai abrir o canal.
 */
const SEM_VOLTA = new Set([401, 403]);

const TETO_DA_ESPERA_MS = 30_000;

/** Quantos avisos manter na tela. Não é caixa de entrada, é um lembrete. */
const QUANTOS_GUARDAR = 8;

export function useAvisos() {
  const [estado, setEstado] = useState<Estado>('fechado');
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [naoLidos, setNaoLidos] = useState(0);

  const socket = useRef<WebSocket | null>(null);
  const tentativas = useRef(0);
  const desmontado = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const limpaTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const conecta = useCallback(async () => {
    if (desmontado.current) return;

    const agendaNovaTentativa = () => {
      if (desmontado.current) return;
      tentativas.current += 1;
      const espera = Math.min(1000 * 2 ** tentativas.current, TETO_DA_ESPERA_MS);
      timers.current.push(setTimeout(() => { void conecta(); }, espera));
    };

    setEstado('conectando');
    let ticket: string;
    try {
      ({ ticket } = await http.post<{ ticket: string }>('/api/auth/ws-ticket/', {}));
    } catch (erro) {
      if (erro instanceof APIError && SEM_VOLTA.has(erro.status)) {
        desmontado.current = true;
        limpaTimers();
        return setEstado('sem-acesso');
      }
      return agendaNovaTentativa();
    }

    const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000')
      .replace(/^http/, 'ws');
    const ws = new WebSocket(`${base}/ws/notifications/?ticket=${ticket}`);
    socket.current = ws;

    ws.onopen = () => {
      tentativas.current = 0;
      setEstado('aberto');
    };

    ws.onmessage = (evento) => {
      let msg: { type: string; payload?: Aviso; count?: number };
      try {
        msg = JSON.parse(evento.data);
      } catch {
        return;
      }

      if (msg.type === 'unread_count') {
        setNaoLidos(msg.count ?? 0);
        return;
      }

      if (msg.type === 'notification_new' && msg.payload) {
        const novo = msg.payload;
        // Por id, e não por posição: o consumer pode reenviar o mesmo aviso
        // numa reconexão, e dois cartões idênticos leem como dois downloads.
        setAvisos((antes) =>
          [novo, ...antes.filter((a) => a.id !== novo.id)].slice(0, QUANTOS_GUARDAR));
        setNaoLidos((n) => n + 1);
      }
    };

    ws.onclose = () => {
      if (desmontado.current) return;
      setEstado('fechado');
      agendaNovaTentativa();
    };
  }, []);

  useEffect(() => {
    desmontado.current = false;
    void conecta();
    return () => {
      desmontado.current = true;
      limpaTimers();
      socket.current?.close();
    };
  }, [conecta]);

  /** Tira o aviso da tela e conta ao servidor que foi visto. */
  const dispensa = useCallback((id: string) => {
    setAvisos((antes) => antes.filter((a) => a.id !== id));
    setNaoLidos((n) => Math.max(0, n - 1));
    // Pelo próprio socket: o consumer já entende 'mark_read' e responde com a
    // contagem nova, então não há endpoint a chamar nem cache a invalidar.
    socket.current?.send(JSON.stringify({ type: 'mark_read', notification_id: id }));
  }, []);

  return { estado, avisos, naoLidos, dispensa };
}
