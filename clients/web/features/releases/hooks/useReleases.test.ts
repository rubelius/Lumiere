import { describe, expect, it } from 'vitest';
import { APIError, normalizaErro } from '@/services/http/errors';
import { CORES_DA_COPIA, especificacaoDaCopia, motivoDaFalha, rotuloDaCopia, tamanhoLegivel } from './useReleases';

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
  it('não promete reprodução para o que ainda não foi importado', () => {
    const r = rotuloDaCopia({ disponibilidade: 'instantanea' });
    expect(r.texto).toBe('IMPORTA NA HORA');
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

  it('oferece importar o que ninguém pediu ainda', () => {
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
    const r = rotuloDaCopia({ disponibilidade: 'instantanea', pode_importar: false });
    expect(r.podeImportar).toBe(false);
    // O estado continua sendo anunciado: o que muda é só a oferta do botão.
    expect(r.texto).toBe('IMPORTA NA HORA');
  });

  it('respeita o backend também no estado ausente', () => {
    expect(rotuloDaCopia({ disponibilidade: 'ausente', pode_importar: false }).podeImportar).toBe(false);
  });

  it('sem o campo, decide pelo estado — resposta antiga não esconde o botão', () => {
    expect(rotuloDaCopia({ disponibilidade: 'ausente' }).podeImportar).toBe(true);
  });
});
