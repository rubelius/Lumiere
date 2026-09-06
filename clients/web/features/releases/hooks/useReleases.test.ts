import { describe, expect, it } from 'vitest';
import { APIError, normalizaErro } from '@/services/http/errors';
import { especificacaoDaCopia, motivoDaFalha, tamanhoLegivel } from './useReleases';

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
