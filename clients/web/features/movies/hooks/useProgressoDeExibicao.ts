'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { http } from '@/services/http/client';

import { movieKeys } from './useMovies';

/**
 * Intervalo mínimo entre dois envios de progresso.
 *
 * O evento `timeupdate` do <video> dispara cerca de quatro vezes por segundo:
 * enviar a cada disparo seriam milhares de requisições por filme, para gravar
 * um número que muda um segundo de cada vez. Quinze segundos é o bastante para
 * retomar de onde parou sem que ninguém perceba a diferença.
 */
const INTERVALO_MS = 15_000;

interface Estado {
  completed: boolean;
  progress_seconds: number;
  times_watched: number;
  fraction: number;
}

/**
 * Reporta ao servidor onde o usuário está no filme.
 *
 * Devolve `reporta`, para chamar à vontade no `timeupdate`, e `reportaAgora`,
 * para os momentos em que perder o progresso seria sentido: pausa, saída da
 * página, fim do filme.
 */
export function useProgressoDeExibicao(movieId: string | undefined) {
  const queryClient = useQueryClient();
  const ultimoEnvio = useRef(0);
  const ultimaPosicao = useRef({ position: 0, duration: 0 });
  const jaConcluiu = useRef(false);

  const envia = useCallback(
    async (position: number, duration: number) => {
      if (!movieId || position <= 0) return;

      ultimoEnvio.current = Date.now();
      try {
        const estado = await http.post<Estado>(`/api/movies/${movieId}/progress/`, {
          position: Math.floor(position),
          duration: Math.floor(duration) || 0,
        });

        // Ao concluir, as listagens passam a mostrar o filme como assistido e
        // as sugestões o empurram para trás. Sem invalidar, a marca só
        // apareceria no próximo carregamento completo da página.
        if (estado?.completed && !jaConcluiu.current) {
          jaConcluiu.current = true;
          queryClient.invalidateQueries({ queryKey: movieKeys.all });
        }
      } catch {
        // Progresso é conveniência: perder um envio custa alguns segundos de
        // posição. Interromper a reprodução por causa disso custaria o filme.
      }
    },
    [movieId, queryClient],
  );

  const reporta = useCallback(
    (position: number, duration: number) => {
      ultimaPosicao.current = { position, duration };
      if (Date.now() - ultimoEnvio.current < INTERVALO_MS) return;
      void envia(position, duration);
    },
    [envia],
  );

  const reportaAgora = useCallback(() => {
    const { position, duration } = ultimaPosicao.current;
    if (position > 0) void envia(position, duration);
  }, [envia]);

  // Sair da página é o momento em que a posição mais importa e o mais fácil
  // de perder: sem isto, fechar a aba no meio do filme descartaria até quinze
  // segundos — e, no fim do filme, a conclusão inteira.
  useEffect(() => {
    return () => {
      const { position, duration } = ultimaPosicao.current;
      if (position > 0) void envia(position, duration);
    };
  }, [envia]);

  return { reporta, reportaAgora };
}
