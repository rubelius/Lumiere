import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { http } from '@/services/http/client';

import { useProgressoDeExibicao } from './useProgressoDeExibicao';

function envolve({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

// Sem sentinela, `monta(undefined)` cairia no valor padrão do parâmetro — em
// JavaScript o default vale justamente para `undefined` —, e o teste do "sem
// filme" acabaria exercitando o caminho com filme.
const SEM_FILME = Symbol('sem filme');

function monta(id: string | typeof SEM_FILME = 'filme-1') {
  const movieId = id === SEM_FILME ? undefined : id;
  return renderHook(() => useProgressoDeExibicao(movieId), { wrapper: envolve });
}

describe('progresso de exibição', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(http, 'post').mockResolvedValue({
      completed: false,
      progress_seconds: 0,
      times_watched: 0,
      fraction: 0,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('não manda uma requisição por evento do vídeo', () => {
    // `timeupdate` dispara cerca de quatro vezes por segundo. Sem
    // estrangulamento seriam milhares de requisições por filme, para gravar um
    // número que muda um segundo de cada vez.
    const { result } = monta();

    act(() => {
      for (let s = 1; s <= 40; s++) result.current.reporta(s, 9720);
    });

    expect(http.post).toHaveBeenCalledTimes(1);
  });

  it('volta a mandar depois do intervalo', () => {
    const { result } = monta();

    act(() => result.current.reporta(10, 9720));
    expect(http.post).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(15_001);
      result.current.reporta(30, 9720);
    });
    expect(http.post).toHaveBeenCalledTimes(2);
  });

  it('reportaAgora ignora o intervalo', () => {
    // Pausa e fim do filme não podem esperar a próxima janela: é justamente
    // aí que a posição precisa estar guardada.
    const { result } = monta();

    act(() => result.current.reporta(10, 9720));
    act(() => result.current.reportaAgora());

    expect(http.post).toHaveBeenCalledTimes(2);
  });

  it('manda a última posição conhecida ao desmontar', () => {
    // Fechar a aba no meio do filme descartaria até quinze segundos — e, perto
    // do fim, a conclusão inteira.
    const { result, unmount } = monta();

    act(() => result.current.reporta(10, 9720));
    act(() => result.current.reporta(120, 9720));  // estrangulada
    vi.mocked(http.post).mockClear();

    unmount();

    expect(http.post).toHaveBeenCalledTimes(1);
    expect(vi.mocked(http.post).mock.calls[0][1]).toMatchObject({ position: 120 });
  });

  it('não reporta posição zero', () => {
    // A linha nasce no primeiro ping; gravar o segundo zero criaria histórico
    // para todo filme que alguém apenas abriu.
    const { result } = monta();
    act(() => result.current.reporta(0, 9720));
    expect(http.post).not.toHaveBeenCalled();
  });

  it('não reporta sem filme', () => {
    const { result } = monta(SEM_FILME);
    act(() => result.current.reporta(500, 9720));
    expect(http.post).not.toHaveBeenCalled();
  });

  it('arredonda para baixo: o servidor guarda segundos inteiros', () => {
    const { result } = monta();
    act(() => result.current.reporta(123.87, 9720.44));
    expect(vi.mocked(http.post).mock.calls[0][1]).toEqual({ position: 123, duration: 9720 });
  });

  it('falha de rede não deixa rejeição solta nem trava os envios seguintes', async () => {
    // Progresso é conveniência: perder um envio custa alguns segundos de
    // posição; deixar a exceção subir custaria o filme. Afirmar só que a
    // chamada aconteceu não testaria nada — ela acontece com ou sem o catch.
    // O que distingue é a rejeição não escapar e o hook seguir funcionando.
    // A rejeição escapa para o Node, não para o `window` do jsdom: os dois
    // não são o mesmo canal, e escutar no lugar errado dá um teste que passa
    // com o catch removido.
    const soltas: unknown[] = [];
    const capta = (motivo: unknown) => soltas.push(motivo);
    process.on('unhandledRejection', capta);

    vi.mocked(http.post).mockRejectedValueOnce(new Error('sem rede'));
    const { result } = monta();

    await act(async () => {
      result.current.reporta(300, 9720);
      await vi.runAllTimersAsync();
    });

    // Depois da falha, um envio novo ainda passa: o hook não ficou travado.
    vi.mocked(http.post).mockResolvedValue({
      completed: false, progress_seconds: 600, times_watched: 0, fraction: 0.06,
    });
    await act(async () => {
      vi.advanceTimersByTime(15_001);
      result.current.reporta(600, 9720);
      await vi.runAllTimersAsync();
    });

    // O relógio falso também intercepta setImmediate, então a drenagem
    // precisa do relógio real — sob o falso, esta espera nunca resolveria.
    vi.useRealTimers();
    await new Promise((r) => setTimeout(r, 0));
    process.off('unhandledRejection', capta);
    expect(soltas).toEqual([]);
    expect(http.post).toHaveBeenCalledTimes(2);
  });
});
