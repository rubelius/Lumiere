import { describe, expect, it } from 'vitest';

import {
  FORA_DA_JANELA,
  duracaoDoFilme,
  ehConvertida,
  pontoDeRetomada,
  tempoDaCue,
  urlDoVideo,
} from './fonteDeVideo';

/** Uma fonte mínima, com só o que estas contas leem. */
const fonte = (campos: Record<string, unknown> = {}) =>
  ({
    source: 'realdebrid',
    stream_url: 'https://cdn.example/filme.mkv',
    label: 'DIRECT PLAY',
    container: 'mkv',
    quality: '',
    release_id: 'rel-1',
    precisa_converter: 'nada',
    duracao_segundos: null,
    ...campos,
  }) as never;

describe('para onde o <video> aponta', () => {
  it('vai direto à CDN quando o navegador dá conta da cópia', () => {
    expect(urlDoVideo(fonte(), 'filme-1', 0)).toBe('https://cdn.example/filme.mkv');
  });

  it('passa pelo conversor quando o áudio não toca', () => {
    expect(urlDoVideo(fonte({ precisa_converter: 'audio' }), 'filme-1', 0))
      .toBe('/api/stream/filme-1?release=rel-1');
  });

  it('leva o segundo de partida na URL', () => {
    expect(urlDoVideo(fonte({ precisa_converter: 'audio' }), 'filme-1', 3618.573))
      .toBe('/api/stream/filme-1?release=rel-1&inicio=3618.573');
  });

  /**
   * Sem a cópia na URL, o backend escolhe de novo — e pode escolher outra,
   * já que a resolução não é determinística entre chamadas.
   */
  it('não deixa o conversor reescolher a cópia', () => {
    expect(urlDoVideo(fonte({ precisa_converter: 'audio', release_id: null }), 'filme-1', 0))
      .toBe('/api/stream/filme-1?');
  });
});

describe('quanto tempo o filme tem', () => {
  it('no caminho direto, quem responde é o próprio elemento', () => {
    expect(duracaoDoFilme(fonte(), 9078.7, 151)).toBe(9078.7);
  });

  /**
   * O MP4 fragmentado declara a duração do que JÁ CHEGOU: medido, 3,545s nos
   * primeiros 6 MB. Aceitar esse número deixaria a barra sem escala e marcaria
   * como assistido um filme de duas horas aos três segundos.
   */
  it('no convertido, ignora o elemento e usa a medida do ffprobe', () => {
    expect(duracaoDoFilme(
      fonte({ precisa_converter: 'audio', duracao_segundos: 9078.741 }), 3.545, 151,
    )).toBe(9078.741);
  });

  it('cai no catálogo quando o ffprobe não soube responder', () => {
    expect(duracaoDoFilme(
      fonte({ precisa_converter: 'audio', duracao_segundos: null }), 3.545, 151,
    )).toBe(9060);
  });

  it('devolve zero quando ninguém sabe, em vez de inventar', () => {
    expect(duracaoDoFilme(
      fonte({ precisa_converter: 'audio', duracao_segundos: null }), 3.545, null,
    )).toBe(0);
    expect(duracaoDoFilme(fonte(), Infinity, null)).toBe(0);
    expect(duracaoDoFilme(fonte(), NaN, null)).toBe(0);
  });
});

describe('o tempo das legendas', () => {
  it('sem deslocamento, o tempo do arquivo é o tempo do elemento', () => {
    expect(tempoDaCue({ inicio: 61, fim: 64 }, 0, 0)).toEqual({ inicio: 61, fim: 64 });
  });

  /**
   * O defeito que isto existe para impedir: retomando em 1h, o elemento marca
   * currentTime 0 e as falas do primeiro minuto apareciam sobre a cena de 1h.
   */
  it('desconta o ponto em que o fluxo abriu', () => {
    expect(tempoDaCue({ inicio: 3700, fim: 3704 }, 0, 3667))
      .toEqual({ inicio: 33, fim: 37 });
  });

  it('soma o atraso escolhido pelo usuário', () => {
    expect(tempoDaCue({ inicio: 3700, fim: 3704 }, 2.5, 3667))
      .toEqual({ inicio: 35.5, fim: 39.5 });
  });

  /**
   * Clampar em zero empilharia TODAS as falas anteriores no primeiro instante
   * do fluxo — a tela despejaria meia hora de diálogo de uma vez.
   */
  it('manda para longe a fala que ficou antes do ponto de abertura', () => {
    expect(tempoDaCue({ inicio: 10, fim: 13 }, 0, 3667))
      .toEqual({ inicio: FORA_DA_JANELA, fim: FORA_DA_JANELA });
  });

  it('mantém a fala que começou antes mas ainda está no ar', () => {
    const { inicio, fim } = tempoDaCue({ inicio: 3665, fim: 3670 }, 0, 3667);
    expect(inicio).toBe(0);
    expect(fim).toBe(3);
  });
});

describe('onde o fluxo abre', () => {
  const convertida = fonte({ precisa_converter: 'audio', duracao_segundos: 9078.741 });

  it('retoma de onde a pessoa parou', () => {
    expect(pontoDeRetomada(convertida, 3667, false, 9078.741)).toBe(3667);
  });

  it('ignora os primeiros segundos, que não vale a pena retomar', () => {
    expect(pontoDeRetomada(convertida, 12, false, 9078.741)).toBe(0);
  });

  it('não joga o usuário nos créditos', () => {
    expect(pontoDeRetomada(convertida, 9050, false, 9078.741)).toBe(0);
  });

  it('recomeça o filme que já foi assistido até o fim', () => {
    expect(pontoDeRetomada(convertida, 3667, true, 9078.741)).toBe(0);
  });

  /**
   * No caminho direto quem retoma é o próprio elemento, por `currentTime`.
   * Devolver o ponto aqui faria a URL da CDN ganhar um `inicio` que ela não
   * entende, e o filme abriria do zero de qualquer jeito.
   */
  it('não interfere no caminho direto', () => {
    expect(pontoDeRetomada(fonte(), 3667, false, 9078.741)).toBe(0);
  });

  it('sem duração conhecida, começa do início', () => {
    expect(pontoDeRetomada(convertida, 3667, false, 0)).toBe(0);
  });
});

describe('a pergunta que decide o caminho', () => {
  it.each([
    ['nada', false],
    ['audio', true],
    ['tudo', true],
  ])('precisa_converter=%s → converte? %s', (valor, esperado) => {
    expect(ehConvertida(fonte({ precisa_converter: valor }))).toBe(esperado);
  });

  it('fonte ausente não converte nada', () => {
    expect(ehConvertida(null)).toBe(false);
    expect(ehConvertida(undefined)).toBe(false);
  });
});
