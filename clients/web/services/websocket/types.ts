// src/services/websocket/types.ts

// Aqui definimos exatamente o que esperamos que o Django nos envie.
// Isso vai fazer o autocomplete do seu editor brilhar depois!

export type SessionMessage =
  | { type: 'session_state'; payload: { session: any } } // Depois tipamos o 'any' com o modelo exato da Sessão
  | { type: 'session_updated'; payload: { status: string, download_progress: number, preparation_progress: number } }
  | { type: 'download_progress'; payload: { movie_id: string, progress: number } };

export type NotificationMessage =
  | { type: 'unread_count'; payload: { count: number } }
  | { type: 'notification_new'; payload: any };