import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

import { APIError, normalizaErro } from '@/services/http/errors';
import { http } from '@/services/http/client';
import { useCanalDaSessao } from './useCanalDaSessao';

class WebSocketFalso {
  static instancias: WebSocketFalso[] = [];
  static OPEN = 1;
  readyState = 0;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  constructor(public url: string) {
    WebSocketFalso.instancias.push(this);
  }
  addEventListener() {}
  send() {}
  close() {}
}

function erroDeApi(status: number) {
  return new APIError(normalizaErro({ detail: 'nope' }, status), status);
}

beforeEach(() => {
  WebSocketFalso.instancias = [];
  vi.stubGlobal('WebSocket', WebSocketFalso);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('useCanalDaSessao e as falhas que reconectar não resolve', () => {
  // Uma aba esquecida aberta acumulou 91 chamadas ao ws-ticket, todas 401,
  // enquanto a tela dizia "RECONECTANDO..." para um canal que nunca abriria.
  it('para de tentar quando o servidor diz que não há acesso', async () => {
    const post = vi.spyOn(http, 'post').mockRejectedValue(erroDeApi(401));

    const { result } = renderHook(() => useCanalDaSessao('sessao-1'));

    await waitFor(() => expect(result.current.estado).toBe('sem-acesso'));
    expect(post).toHaveBeenCalledTimes(1);
    expect(WebSocketFalso.instancias).toHaveLength(0);

    // O recuo continuaria disparando por horas; nada mais pode chegar.
    await new Promise((r) => setTimeout(r, 1400));
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('trata 403 igual: não é o tipo de falha que passa sozinha', async () => {
    vi.spyOn(http, 'post').mockRejectedValue(erroDeApi(403));

    const { result } = renderHook(() => useCanalDaSessao('sessao-1'));

    await waitFor(() => expect(result.current.estado).toBe('sem-acesso'));
  });

  it('ainda reconecta quando a falha é passageira', async () => {
    const post = vi.spyOn(http, 'post').mockRejectedValue(erroDeApi(503));

    const { result } = renderHook(() => useCanalDaSessao('sessao-1'));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(result.current.estado).not.toBe('sem-acesso');
    await waitFor(() => expect(post.mock.calls.length).toBeGreaterThan(1), { timeout: 3000 });
  });

  it('não chama nada sem sessão', async () => {
    const post = vi.spyOn(http, 'post').mockResolvedValue({ ticket: 't' });

    renderHook(() => useCanalDaSessao(undefined));

    await new Promise((r) => setTimeout(r, 300));
    expect(post).not.toHaveBeenCalled();
  });

  it('abre o socket com o ticket quando o servidor deixa', async () => {
    vi.spyOn(http, 'post').mockResolvedValue({ ticket: 'TICKET123' });

    const { result } = renderHook(() => useCanalDaSessao('sessao-1'));

    await waitFor(() => expect(WebSocketFalso.instancias).toHaveLength(1));
    expect(WebSocketFalso.instancias[0].url).toContain('/ws/sessions/sessao-1/');
    expect(WebSocketFalso.instancias[0].url).toContain('ticket=TICKET123');

    WebSocketFalso.instancias[0].onopen?.();
    await waitFor(() => expect(result.current.estado).toBe('aberto'));
  });

  it('não deixa timer de reconexão para trás ao desmontar', async () => {
    const post = vi.spyOn(http, 'post').mockRejectedValue(erroDeApi(503));

    const { unmount } = renderHook(() => useCanalDaSessao('sessao-1'));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    unmount();

    const depoisDoDesmonte = post.mock.calls.length;
    await new Promise((r) => setTimeout(r, 1500));
    expect(post.mock.calls.length).toBe(depoisDoDesmonte);
  });
});
