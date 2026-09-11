import { act, renderHook } from '@testing-library/react';
import type { EstadoDoMotor } from './useReleases';
import { describe, expect, it, vi } from 'vitest';
import { APIError, normalizaErro } from '@/services/http/errors';
import { CORES_DA_COPIA, especificacaoDaCopia, explicaOScore, mensagemDaBusca, motivoDaFalha, rotuloDaCopia, tamanhoLegivel, useRelogio, avisoDoMotor } from './useReleases';
import type { EstadoDaBusca } from './useReleases';

function erroDaApi(corpo: unknown, status: number) {
  return new APIError(normalizaErro(corpo, status), status);
}

describe('motivoDaFalha', () => {
  // Este é o caminho que a tela percorre de verdade: a view responde
  // `{'error': 'texto'}` e o motivo tem que chegar inteiro até o usuário.
  it('repete o motivo que o servidor deu', () => {
    expect(motivoDaFalha(erroDaApi({ error: 'O Prowlarr não está configurado. Ajuste em Configurações.' }, 400)))
      .toBe('O PROWLARR NÃO ESTÁ CONFIGURADO. AJUSTE EM CONFIGURAÇÕES.');
  });

  it('repete também a falha de integração do 502', () => {
    expect(motivoDaFalha(erroDaApi({ error: 'O Prowlarr devolveu algo que não é JSON.' }, 502)))
      .toContain('NÃO É JSON');
  });

  it('cai num texto próprio quando o erro não veio da API', () => {
    for (const erro of [new TypeError('Failed to fetch'), undefined, null]) {
      expect(motivoDaFalha(erro)).toBe('NÃO FOI POSSÍVEL PROCURAR CÓPIAS AGORA.');
    }
  });
});

describe('especificacaoDaCopia', () => {
  it('monta o rótulo a partir dos campos que a API realmente devolve', () => {
    expect(
      especificacaoDaCopia({
        is_remux: true, resolution: '2160p', has_hdr: true,
        video_codec: 'HEVC', has_atmos: true, audio_codec: 'DTS',
      } as never),
    ).toEqual(['REMUX', '2160p', 'HDR', 'HEVC', 'ATMOS']);
  });

  it('prefere Dolby Vision a HDR e Atmos ao codec cru', () => {
    const specs = especificacaoDaCopia({
      resolution: '1080p', has_hdr: true, has_dolby_vision: true,
      audio_codec: 'AC3', has_dtsx: true,
    } as never);
    expect(specs).toContain('DV');
    expect(specs).not.toContain('HDR');
    expect(specs).toContain('DTS-X');
    expect(specs).not.toContain('AC3');
  });

  it('não inventa nada quando a cópia não tem metadados', () => {
    expect(especificacaoDaCopia({} as never)).toEqual([]);
  });
});

describe('tamanhoLegivel', () => {
  it('usa o size_gb do serializer', () => {
    expect(tamanhoLegivel({ size_gb: 13.24 } as never)).toBe('13.2 GB');
  });

  it('cai para os bytes quando o serializer não mandou o gb', () => {
    expect(tamanhoLegivel({ size_bytes: 2 * 1024 ** 3 } as never)).toBe('2.0 GB');
  });

  it('mostra MB abaixo de um giga em vez de "0.0 GB"', () => {
    expect(tamanhoLegivel({ size_gb: 0.35 } as never)).toBe('358 MB');
  });

  it('admite não saber o tamanho', () => {
    expect(tamanhoLegivel({} as never)).toBe('—');
  });
});

describe('rotuloDaCopia', () => {
  // O defeito de origem: `instantly_available` virava "TOCA AGORA", mas essa
  // flag só diz que o Real-Debrid tem o arquivo. Sem importar, não há link.
  it('não promete reprodução para o que não está na conta', () => {
    const r = rotuloDaCopia({ disponibilidade: 'ausente' });
    expect(r.texto).not.toContain('TOCA');
    expect(r.podeImportar).toBe(true);
  });

  it('só diz "toca agora" para o que está na conta e completo', () => {
    const r = rotuloDaCopia({ disponibilidade: 'pronta' });
    expect(r.texto).toBe('TOCA AGORA');
    expect(r.podeImportar).toBe(false);
  });

  it('não oferece importar de novo o que já está vindo', () => {
    expect(rotuloDaCopia({ disponibilidade: 'baixando' }).podeImportar).toBe(false);
  });

  it('oferece importar o que não está na conta', () => {
    const r = rotuloDaCopia({ disponibilidade: 'ausente' });
    expect(r.podeImportar).toBe(true);
    expect(r.texto).toBe('PRECISA BAIXAR');
  });

  // O tipo gerado diz que `disponibilidade` sempre vem, mas uma resposta
  // guardada em cache de antes deste campo existir chega sem ele.
  it('trata a cópia sem estado como a menos otimista', () => {
    for (const d of [undefined, 'coisa-nova']) {
      expect(rotuloDaCopia({ disponibilidade: d as never }).texto).toBe('PRECISA BAIXAR');
    }
  });

  it('dá uma cor a cada leitura', () => {
    for (const d of ['pronta', 'instantanea', 'baixando', 'ausente'] as const) {
      expect(CORES_DA_COPIA[rotuloDaCopia({ disponibilidade: d }).cor]).toBeDefined();
    }
  });
});

describe('motivoDaFalha com texto próprio', () => {
  it('usa o padrão que o chamador passou', () => {
    expect(motivoDaFalha(new TypeError('x'), 'Não foi possível enviar ao Real-Debrid.'))
      .toBe('NÃO FOI POSSÍVEL ENVIAR AO REAL-DEBRID.');
  });

  it('ainda prefere o motivo do servidor ao padrão do chamador', () => {
    expect(motivoDaFalha(erroDaApi({ error: 'Esta cópia não tem magnet link para enviar.' }, 400), 'Genérico'))
      .toContain('MAGNET LINK');
  });
});

describe('rotuloDaCopia e o que dá para importar', () => {
  it('não oferece importar a cópia que o backend disse não ter como', () => {
    const r = rotuloDaCopia({ disponibilidade: 'ausente', pode_importar: false });
    expect(r.podeImportar).toBe(false);
    // O estado continua sendo anunciado: o que muda é só a oferta do botão.
    expect(r.texto).toBe('PRECISA BAIXAR');
  });

  it('respeita o backend também no estado ausente', () => {
    expect(rotuloDaCopia({ disponibilidade: 'ausente', pode_importar: false }).podeImportar).toBe(false);
  });

  it('não oferece importar o que já está na conta', () => {
    expect(rotuloDaCopia({ disponibilidade: 'pronta' }).podeImportar).toBe(false);
    expect(rotuloDaCopia({ disponibilidade: 'baixando' }).podeImportar).toBe(false);
  });

  it('sem o campo, decide pelo estado — resposta antiga não esconde o botão', () => {
    expect(rotuloDaCopia({ disponibilidade: 'ausente' }).podeImportar).toBe(true);
  });
});

describe('mensagemDaBusca', () => {
  const AGORA = new Date('2026-01-01T12:00:00Z');

  function doc(campos: Partial<EstadoDaBusca>): EstadoDaBusca {
    return {
      movie_id: 'm1', estado: 'ociosa', iniciada_em: null, concluida_em: null,
      erro: null, new_releases_found: null, total_releases: null,
      cache_check_failed: null, consultas_falhas: [], ...campos,
    };
  }

  function hÁ(segundos: number) {
    return new Date(AGORA.getTime() - segundos * 1000).toISOString();
  }

  it('sem busca nenhuma, o botão está pronto', () => {
    const p = mensagemDaBusca(undefined, AGORA);
    expect(p.rotuloDoBotao).toBe('[ ATUALIZAR CÓPIAS ]');
    expect(p.ocupado).toBe(false);
  });

  // A distinção que o 200-contra-502 carregava e não pode se perder.
  it('não achar nada não é falha, e a frase diz por quê', () => {
    const p = mensagemDaBusca(doc({ estado: 'concluida', new_releases_found: 0 }), AGORA);
    expect(p.erro).toBe('');
    expect(p.aviso).toContain('OS INDEXADORES RESPONDERAM');
  });

  it('achar cópias diz quantas', () => {
    expect(mensagemDaBusca(doc({ estado: 'concluida', new_releases_found: 3 }), AGORA).aviso)
      .toBe('3 CÓPIAS NOVAS.');
    expect(mensagemDaBusca(doc({ estado: 'concluida', new_releases_found: 1 }), AGORA).aviso)
      .toBe('1 CÓPIA NOVA.');
  });

  it('o erro do servidor chega inteiro', () => {
    const p = mensagemDaBusca(doc({ estado: 'erro', erro: 'O Prowlarr devolveu algo que não é JSON.' }), AGORA);
    expect(p.erro).toContain('NÃO É JSON');
    expect(p.ocupado).toBe(false);
  });

  // `enfileirada` e `buscando` existem separados justamente para isto.
  it('na fila há muito tempo acusa o worker; há pouco, não', () => {
    expect(mensagemDaBusca(doc({ estado: 'enfileirada', iniciada_em: hÁ(20) }), AGORA).aviso)
      .toContain('NINGUÉM A PEGOU');
    expect(mensagemDaBusca(doc({ estado: 'enfileirada', iniciada_em: hÁ(5) }), AGORA).aviso)
      .toBe('');
  });

  it('vasculhando mostra o contador andando', () => {
    expect(mensagemDaBusca(doc({ estado: 'buscando', iniciada_em: hÁ(42) }), AGORA).rotuloDoBotao)
      .toBe('[ VASCULHANDO... 42s ]');
  });

  it('passado o tempo do indexador lento, explica a espera', () => {
    expect(mensagemDaBusca(doc({ estado: 'buscando', iniciada_em: hÁ(60) }), AGORA).aviso)
      .toContain('ATÉ 100s');
  });

  it('o botão fica travado enquanto há busca em voo', () => {
    for (const estado of ['enfileirada', 'buscando'] as const) {
      expect(mensagemDaBusca(doc({ estado, iniciada_em: hÁ(1) }), AGORA).ocupado).toBe(true);
    }
    for (const estado of ['ociosa', 'concluida', 'erro'] as const) {
      expect(mensagemDaBusca(doc({ estado }), AGORA).ocupado).toBe(false);
    }
  });

  it('a falha parcial do Prowlarr aparece mesmo com a busca concluída', () => {
    const p = mensagemDaBusca(doc({
      estado: 'concluida', new_releases_found: 5,
      consultas_falhas: ['Os Infiltrados 2006: caiu'],
    }), AGORA);
    expect(p.aviso).toContain('PODE NÃO SER TUDO');
  });

  it('data de início inválida não derruba o contador', () => {
    const p = mensagemDaBusca(doc({ estado: 'buscando', iniciada_em: 'lixo' }), AGORA);
    expect(p.rotuloDoBotao).toBe('[ VASCULHANDO... 0s ]');
  });
});

describe('useRelogio', () => {
  // O contador travou em "VASCULHANDO... 2s" na verificação ao vivo: o React
  // Query não re-renderiza quando o documento volta estruturalmente igual, e
  // durante `buscando` ele volta igual toda vez.
  it('anda enquanto a busca está em voo', async () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useRelogio(true));
      const inicio = result.current.getTime();

      await act(async () => { vi.advanceTimersByTime(3000); });

      expect(result.current.getTime()).toBeGreaterThan(inicio);
    } finally {
      vi.useRealTimers();
    }
  });

  it('não anda quando não há busca — nada de setInterval à toa', async () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useRelogio(false));
      const inicio = result.current.getTime();

      await act(async () => { vi.advanceTimersByTime(5000); });

      expect(result.current.getTime()).toBe(inicio);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('explicaOScore', () => {
  // "Por que 57 e não 90?" era impossível de responder olhando a tela: o
  // número aparecia sozinho, sem dizer sequer que era uma nota.
  it('mostra a conta parcela a parcela', () => {
    const texto = explicaOScore({
      quality_score: 76,
      motivos_do_score: [
        { rotulo: 'Vídeo', pontos: 30, teto: 30, motivo: 'remux, sem recompressão' },
        { rotulo: 'Semeadores', pontos: 0, teto: 5, motivo: 'ninguém semeando' },
      ],
    } as never);

    expect(texto).toContain('Nota 76 de 100');
    expect(texto).toContain('Vídeo: 30/30 — remux, sem recompressão');
    expect(texto).toContain('Semeadores: 0/5 — ninguém semeando');
  });

  it('sem os motivos, ainda diz que o número é uma nota', () => {
    expect(explicaOScore({ quality_score: 42 } as never)).toBe('Nota 42 de 100.');
  });

  it('nota ausente não vira "undefined" na tela', () => {
    expect(explicaOScore({} as never)).toBe('Nota 0 de 100.');
  });
});

describe('o aviso do motor', () => {
  const motor = (campos: Partial<EstadoDoMotor> = {}): EstadoDoMotor => ({
    workers: 1, beat: true, ultimo_pulso: '2026-09-11T23:09:00Z',
    busca_funciona: true, rastreio_funciona: true, ...campos,
  });

  it('cala quando está tudo de pé', () => {
    expect(avisoDoMotor(motor())).toBe('');
  });

  /**
   * O defeito que isto existe para impedir: uma busca ficou dez minutos "na
   * fila" sem worker para pegá-la, e o único lugar onde isso aparecia era o
   * log do servidor.
   */
  it('diz que buscar não vai adiantar quando não há worker', () => {
    const aviso = avisoDoMotor(motor({ workers: 0, busca_funciona: false, rastreio_funciona: false }));
    expect(aviso).toContain('FORA DO AR');
    expect(aviso).toContain('NÃO VAI ADIANTAR');
  });

  /**
   * Sem beat a busca por clique continua funcionando — só a pré-carga
   * automática para. Dizer "fora do ar" aqui seria alarme falso.
   */
  it('separa o agendador do worker', () => {
    const aviso = avisoDoMotor(motor({ beat: false, rastreio_funciona: false }));
    expect(aviso).toContain('AGENDADOR');
    expect(aviso).toContain('AINDA FUNCIONA');
    expect(aviso).not.toContain('NÃO VAI ADIANTAR');
  });

  it('o worker fora ganha do agendador fora', () => {
    const aviso = avisoDoMotor(motor({
      workers: 0, beat: false, busca_funciona: false, rastreio_funciona: false }));
    expect(aviso).toContain('NENHUM WORKER');
  });

  it('sem resposta do servidor, não inventa notícia', () => {
    expect(avisoDoMotor(undefined)).toBe('');
  });
});
