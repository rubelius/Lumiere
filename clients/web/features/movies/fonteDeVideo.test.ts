import { describe, expect, it } from 'vitest';

import type { FaixaDeAudio } from './fonteDeVideo';

import {
  CONVERSAO,
  DIRETO,
  FORA_DA_JANELA,
  duracaoDoFilme,
  ehConvertida,
  pontoDeRetomada,
  rotuloDaFonte,
  tempoDaCue,
  urlDoVideo,
  ehComentario,
  faixaPadrao,
  nomeDaFaixa,
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

describe('o modo imposto pela tela', () => {
  const comDts = fonte({ precisa_converter: 'audio', label: 'ÁUDIO CONVERTIDO' });
  const simples = fonte({ precisa_converter: 'nada', label: 'DIRECT PLAY' });

  it('sem modo, vale a recomendação do backend', () => {
    expect(ehConvertida(comDts)).toBe(true);
    expect(ehConvertida(simples)).toBe(false);
  });

  it('"direto" recusa a conversão que o backend recomendaria', () => {
    expect(ehConvertida(comDts, DIRETO)).toBe(false);
    expect(urlDoVideo(comDts, 'filme-1', 0, DIRETO)).toBe('https://cdn.example/filme.mkv');
  });

  it('"conversao" converte o que passaria direto', () => {
    expect(ehConvertida(simples, CONVERSAO)).toBe(true);
    expect(urlDoVideo(simples, 'filme-1', 0, CONVERSAO)).toBe('/api/stream/filme-1?release=rel-1');
  });

  /**
   * O rótulo do backend descreve o que ELE faria. Sob um modo imposto ele
   * passa a descrever algo que não está acontecendo — e "ÁUDIO CONVERTIDO"
   * sobre uma reprodução crua manda a pessoa procurar defeito no volume.
   */
  it('avisa que reproduzir direto uma cópia com DTS não terá som', () => {
    expect(rotuloDaFonte(comDts, DIRETO)).toBe('DIRETO — SEM ÁUDIO');
  });

  it('avisa quando nem o vídeo deve abrir', () => {
    expect(rotuloDaFonte(fonte({ precisa_converter: 'tudo' }), DIRETO))
      .toBe('DIRETO — PODE NÃO ABRIR');
  });

  it('diz que a conversão foi pedida, e não necessária', () => {
    expect(rotuloDaFonte(simples, CONVERSAO)).toBe('CONVERSÃO A PEDIDO');
  });

  it('sem modo imposto, repete o rótulo do backend', () => {
    expect(rotuloDaFonte(comDts)).toBe('ÁUDIO CONVERTIDO');
    expect(rotuloDaFonte(simples)).toBe('DIRECT PLAY');
    expect(rotuloDaFonte(null)).toBeUndefined();
  });

  /**
   * No modo direto o arquivo é o da CDN, que aceita requisição por faixa: o
   * elemento sabe a duração e salta sozinho. Devolver um ponto de partida aqui
   * poria um `inicio` numa URL que não o entende.
   */
  it('reproduzir direto devolve o salto ao elemento', () => {
    expect(pontoDeRetomada(comDts, 3667, false, 9078.741)).toBe(3667);
    expect(pontoDeRetomada(comDts, 3667, false, 9078.741, DIRETO)).toBe(0);
  });

  it('a duração no modo direto vem do elemento, não do ffprobe', () => {
    const medida = fonte({ precisa_converter: 'audio', duracao_segundos: 9078.741 });
    expect(duracaoDoFilme(medida, 3.545, 151)).toBe(9078.741);
    expect(duracaoDoFilme(medida, 9080.2, 151, DIRETO)).toBe(9080.2);
  });
});

describe('as faixas de áudio', () => {
  const faixa = (campos: Partial<FaixaDeAudio> = {}): FaixaDeAudio => ({
    posicao: 0, index: 1, codec: 'dts', canais: 6, layout: '5.1(side)',
    idioma: 'fre', titulo: '5.1 Surround Mix', ...campos,
  });

  it('nomeia pelo idioma e pelo arranjo', () => {
    expect(nomeDaFaixa(faixa())).toBe('FRANCÊS · 5.1');
    expect(nomeDaFaixa(faixa({ idioma: 'eng', canais: 2 }))).toBe('INGLÊS · ESTÉREO');
  });

  it('sem idioma etiquetado, o codec ao menos distingue uma da outra', () => {
    expect(nomeDaFaixa(faixa({ idioma: '', codec: 'ac3', canais: 1 }))).toBe('AC3 · MONO');
  });

  /**
   * Em "Mártires", duas das quatro faixas são comentários de especialistas.
   * Cair numa delas troca o filme por uma aula sobre o filme.
   */
  it('marca a faixa de comentário', () => {
    const c = faixa({ idioma: 'eng', canais: 1, titulo: 'Commentary by Nia Edwards-Behi' });
    expect(ehComentario(c)).toBe(true);
    expect(nomeDaFaixa(c)).toContain('COMENTÁRIO');
  });

  it('não confunde o filme com um comentário', () => {
    expect(ehComentario(faixa({ titulo: 'English Dub / 5.1 Surround Mix' }))).toBe(false);
  });

  it('a faixa padrão pula os comentários', () => {
    expect(faixaPadrao([
      faixa({ posicao: 0, titulo: 'Commentary by film historian' }),
      faixa({ posicao: 1, titulo: '5.1 Surround Mix' }),
    ])).toBe(1);
  });

  it('só de comentários, escolhe a primeira em vez de nada', () => {
    expect(faixaPadrao([faixa({ titulo: 'Commentary A' })])).toBe(0);
  });

  it('a faixa escolhida vai na URL do conversor', () => {
    const f = fonte({ precisa_converter: 'audio' });
    expect(urlDoVideo(f, 'filme-1', 0, null, 2)).toBe('/api/stream/filme-1?release=rel-1&faixa=2');
    // A zero é a padrão do ffmpeg: mandá-la só polui a URL.
    expect(urlDoVideo(f, 'filme-1', 0, null, 0)).toBe('/api/stream/filme-1?release=rel-1');
  });
});
