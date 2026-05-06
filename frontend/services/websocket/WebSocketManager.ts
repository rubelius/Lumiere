// src/services/websocket/WebSocketManager.ts

import { useAuthStore } from '@/features/auth/store/authStore';

interface ManagerOptions {
  path: string; // Ex: '/ws/sessions/123/'
  onMessage: (event: MessageEvent) => void;
  onOpen?: () => void;
  onClose?: () => void;
}

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isIntentionallyClosed = false;
  
  private path: string;
  private onMessage: (event: MessageEvent) => void;
  private onOpen?: () => void;
  private onClose?: () => void;

  constructor(options: ManagerOptions) {
    this.path = options.path;
    this.onMessage = options.onMessage;
    this.onOpen = options.onOpen;
    this.onClose = options.onClose;
  }

  connect() {
    this.isIntentionallyClosed = false;
    this.createConnection();
  }

  disconnect() {
    this.isIntentionallyClosed = true;
    this.clearReconnectTimer();
    if (this.ws) {
      this.ws.close(1000, 'Client disconnected');
      this.ws = null;
    }
  }

  send(data: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private createConnection() {
    // Puxa o token de forma silenciosa e reativa
    const token = useAuthStore.getState().accessToken;
    if (!token) {
      console.warn('[WS] Sem token JWT — ignorando conexão.');
      return;
    }

    const host = process.env.NEXT_PUBLIC_WS_HOST ?? 'localhost:8000';
    const protocol = process.env.NODE_ENV === 'production' ? 'wss' : 'ws';
    // É exatamente assim que configuramos o backend para receber o token!
    const url = `${protocol}://${host}${this.path}?token=${token}`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.onOpen?.();
    };

    this.ws.onmessage = this.onMessage;

    this.ws.onclose = (event) => {
      this.onClose?.();
      // Se não fomos nós que fechamos, ele tenta reconectar sozinho
      if (!this.isIntentionallyClosed && event.code !== 1000) {
        this.scheduleReconnect();
      }
    };
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WS] Máximo de tentativas de reconexão atingido.');
      return;
    }

    // Tenta reconectar em 1s, depois 2s, 4s, 8s... até no máximo 30s
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30_000);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.createConnection();
    }, delay);
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}