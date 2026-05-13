// src/services/websocket/WebSocketManager.ts

import { http } from '@/services/http/client';

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
  private isConnecting = false; // Trava para evitar conexões duplicadas
  
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

  private async createConnection() {
    // Evita tentar conectar se já estiver no processo
    if (this.isConnecting) return;
    this.isConnecting = true;

    try {
      // 1. Busca o ticket de uso único da nossa API protegida
      const response = await http.post<{ ticket: string }>('/api/auth/ws-ticket/');
      const ticket = response.ticket;

      // Se o componente desmontou ou o usuário deslogou enquanto esperávamos a API:
      if (this.isIntentionallyClosed) {
        this.isConnecting = false;
        return;
      }

      // 2. Monta a URL usando o TICKET, e não o JWT
      const host = process.env.NEXT_PUBLIC_WS_HOST ?? 'localhost:8000';
      const protocol = process.env.NODE_ENV === 'production' ? 'wss' : 'ws';
      const url = `${protocol}://${host}${this.path}?ticket=${ticket}`;

      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.onOpen?.();
      };

      this.ws.onmessage = this.onMessage;

      this.ws.onclose = (event) => {
        this.isConnecting = false;
        this.onClose?.();
        
        // Se não fomos nós que fechamos (ex: queda de rede), tenta reconectar
        if (!this.isIntentionallyClosed && event.code !== 1000) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = () => {
        // O `onclose` também será chamado pelo navegador, então apenas liberamos a trava
        this.isConnecting = false;
      };

    } catch (error) {
      console.error('[WS] Erro ao obter ticket de conexão:', error);
      this.isConnecting = false;
      
      // Se a API falhar, tratamos como uma queda de conexão normal e tentamos de novo
      if (!this.isIntentionallyClosed) {
        this.scheduleReconnect();
      }
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WS] Máximo de tentativas de reconexão atingido.');
      return;
    }

    // CÁLCULO COM JITTER: Evita o "Thundering Herd" (Ataque DDoS não intencional)
    const baseDelay = Math.min(1000 * 2 ** this.reconnectAttempts, 30_000);
    const jitter = Math.random() * 1000; // Desvio aleatório de 0 a 1 segundo
    const finalDelay = baseDelay + jitter;
    
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.createConnection();
    }, finalDelay);
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}