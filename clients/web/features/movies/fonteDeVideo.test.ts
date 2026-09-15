import { describe, expect, it } from 'vitest';

import type { FaixaDeAudio } from './fonteDeVideo';

import {
  avisoDoTorrent,  CONVERSAO,
  DIRETO,
  FORA_DA_JANELA,
  duracaoDoFilme,
  ehConvertida,
  pontoDeRetomada,
  rotuloDaCopia,
  rotuloDaFonte,
  temOQueTocar,
  tempoDaCue,
  urlDoVideo,
  ehComentario,
  faixaPadrao,
  faixasDe,
  janelaCarregada,
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

describe('o aviso sobre o download do torrent', () => {
  const estado = (campos = {}) => ({
    pares: 12, velocidade: 2 * 1024 * 1024,
    cache: { pausado_por_cota: false }, ...campos,
  });

  it('cala quando o download está saudável', () => {
    expect(avisoDoTorrent(estado())).toBe('');
  });

  /**
   * O backlog dizia isso com todas as letras: "o torrent não tem semeadores"
   * precisa chegar à tela como frase, não como vídeo travado.
   */
  it('diz quando não há semeador nenhum', () => {
    const aviso = avisoDoTorrent(estado({ pares: 0 }));
    expect(aviso).toContain('NENHUM SEMEADOR');
    expect(aviso).toContain('REAL-DEBRID');
  });

  /**
   * Medido: 1 par a 2,4 KB/s deixou um pedido de 64 KB estourar 120 segundos
   * sem entregar nada. Com 2 pares, o mesmo pedido voltou em 0,04s.
   */
  it('avisa quando a velocidade não sustenta a reprodução', () => {
    const aviso = avisoDoTorrent(estado({ pares: 1, velocidade: 2400 }));
    expect(aviso).toContain('POUCOS SEMEADORES');
    expect(aviso).toContain('1 PAR');
    expect(aviso).toContain('2 KB/S');
  });

  it('o cache cheio é outra notícia, e aponta a saída', () => {
    const aviso = avisoDoTorrent(estado({ cache: { pausado_por_cota: true } }));
    expect(aviso).toContain('CACHE ENCHEU');
    expect(aviso).toContain('COTA');
    expect(aviso).not.toContain('SEMEADOR');
  });

  it('sem semeador ganha do cache cheio', () => {
    // Sem par nenhum, aumentar a cota não resolve nada.
    const aviso = avisoDoTorrent(estado({ pares: 0, cache: { pausado_por_cota: true } }));
    expect(aviso).toContain('NENHUM SEMEADOR');
  });

  it('sem resposta do servidor, não inventa notícia', () => {
    expect(avisoDoTorrent(undefined)).toBe('');
  });
});

// ── a tela não afirma o que não é verdade ────────────────────────────────
// MEDIDO: com Pulp Fiction TOCANDO do torrent — readyState 4, duração de 2h34
// lida do próprio arquivo — a tela escrevia por cima "Sem fonte disponível.
// Nenhuma cópia em Real-Debrid, Jellyfin ou Plex". A frase estava certa sobre
// o Real-Debrid e errada sobre o filme, porque `fonte` responde "o que o
// resolvedor achou" e estava sendo usada para responder "há o que tocar".

describe('temOQueTocar', () => {
  it('um torrent no ar é fonte, mesmo sem o resolvedor achar nada', () => {
    expect(temOQueTocar(null, 'a'.repeat(40))).toBe(true);
    expect(temOQueTocar(undefined, 'b'.repeat(40))).toBe(true);
  });

  it('sem torrent, vale o que o resolvedor achou', () => {
    expect(temOQueTocar({ stream_url: '/x' } as never, null)).toBe(true);
    expect(temOQueTocar(null, null)).toBe(false);
    expect(temOQueTocar(null, '')).toBe(false);
  });
});

describe('rotuloDaFonte com torrent', () => {
  it('diz TORRENT DIRETO em vez de deixar o selo vazio', () => {
    expect(rotuloDaFonte(null, null, 'c'.repeat(40))).toBe('TORRENT DIRETO');
  });

  it('o torrent manda mesmo quando o resolvedor achou outra coisa', () => {
    // O <video> está puxando do torrent; anunciar a cópia do Real-Debrid seria
    // nomear uma origem que não está sendo usada.
    const doRd = { label: 'DIRECT PLAY', precisa_converter: 'nada' } as never;
    expect(rotuloDaFonte(doRd, null, 'd'.repeat(40))).toBe('TORRENT DIRETO');
  });

  it('sem torrent, nada muda', () => {
    const doRd = { label: 'DIRECT PLAY', precisa_converter: 'nada' } as never;
    expect(rotuloDaFonte(doRd, null, null)).toBe('DIRECT PLAY');
    expect(rotuloDaFonte(null, null, null)).toBeUndefined();
  });
});

// ── fonte de biblioteca local, que não tem release ───────────────────────
// Jellyfin e Plex resolvem para um arquivo do servidor de casa, sem
// `TorrentRelease` por trás. Agora que essas fontes podem pedir conversão
// (um DTS da biblioteca tocava mudo sob "JELLYFIN DIRECT"), a URL precisa
// funcionar sem o parâmetro `release`.

describe('conversão de uma fonte sem release', () => {
  // A fonte completa, e não um pedaço com `as never`: o contrato é o mesmo do
  // Real-Debrid, com `release_id` nulo — e é justamente isso que o teste
  // precisa provar que a URL aguenta.
  const doJellyfin = {
    source: 'jellyfin',
    stream_url: 'http://casa:8096/Items/abc/stream',
    label: 'JELLYFIN — ÁUDIO CONVERTIDO',
    container: 'mkv',
    quality: '',
    release_id: null,
    rotulo_da_copia: 'MKV',
    precisa_converter: 'audio',
    duracao_segundos: 9270,
    faixas_de_audio: [],
  } as NonNullable<Parameters<typeof urlDoVideo>[0]>;

  it('vai para o conversor, e não para a URL crua', () => {
    const url = urlDoVideo(doJellyfin, 'filme-1');
    expect(url).toContain('/api/stream/filme-1');
    expect(url).not.toContain('casa:8096');
  });

  it('não inventa um release que não existe', () => {
    expect(urlDoVideo(doJellyfin, 'filme-1')).not.toContain('release=');
  });

  it('o ponto de partida e a faixa continuam chegando', () => {
    const url = urlDoVideo(doJellyfin, 'filme-1', 600, null, 2);
    expect(url).toContain('inicio=600.000');
    expect(url).toContain('faixa=2');
  });

  it('sem conversão, toca direto do servidor de casa', () => {
    const direto = { ...doJellyfin, precisa_converter: 'nada' as const, label: 'JELLYFIN' };
    expect(urlDoVideo(direto, 'filme-1')).toBe('http://casa:8096/Items/abc/stream');
  });
});

// ── o selo descreve a cópia QUE ESTÁ TOCANDO ─────────────────────────────
// O defeito: o player mostrava `movie.best_quality_available`, o rótulo da
// melhor cópia DO ACERVO. A escolha da fonte é deliberadamente a que o
// navegador aceita, e não a de maior nota — então o selo dizia
// "REMUX 2160p DV ATMOS" ao lado da resolução medida no elemento, 1920×1080,
// do WEB-DL que estava de fato no ar.

describe('rotuloDaCopia', () => {
  const remuxDoAcervo = 'REMUX 2160p DV ATMOS';
  const noAr = {
    source: 'realdebrid', stream_url: 'https://rd/f.mkv', label: 'DIRECT PLAY',
    container: 'mkv', quality: 'Filme.1080p.WEB-DL.AAC', release_id: 'r1',
    rotulo_da_copia: '1080p', precisa_converter: 'nada',
    duracao_segundos: null, faixas_de_audio: [],
  } as NonNullable<Parameters<typeof rotuloDaCopia>[0]>;

  it('usa o rótulo da fonte resolvida, não o do acervo', () => {
    expect(rotuloDaCopia(noAr, null, remuxDoAcervo)).toBe('1080p');
  });

  it('tocando do torrent não descreve a cópia do resolvedor', () => {
    // O resolvedor não foi quem escolheu; mostrar o rótulo dele seria
    // descrever outra cópia de novo.
    expect(rotuloDaCopia(noAr, 'a'.repeat(40), remuxDoAcervo)).toBe('');
  });

  it('sem fonte, nada — e nunca o rótulo do acervo', () => {
    expect(rotuloDaCopia(null, null, remuxDoAcervo)).toBe('');
    expect(rotuloDaCopia(undefined, null, remuxDoAcervo)).toBe('');
  });

  it('fonte sem rótulo não vira o do acervo', () => {
    const semRotulo = { ...noAr, rotulo_da_copia: '' };
    expect(rotuloDaCopia(semRotulo, null, remuxDoAcervo)).toBe('');
  });
});

// ── rota caída não é enxame vazio ────────────────────────────────────────
// `pares === 0` responde "quantos pares estão conectados agora" e estava
// respondendo "esta cópia tem quem a compartilhe". Com o túnel caído as
// conexões morrem e o número vai a zero para QUALQUER torrent — a frase manda
// trocar de cópia, e nenhuma outra vai funcionar.

describe('avisoDoTorrent com a rota caída', () => {
  it('acusa a rota, e não o enxame', () => {
    const aviso = avisoDoTorrent({ pares: 0, velocidade: 0, sem_rota: true });
    expect(aviso).toContain('SEM ROTA');
    expect(aviso).not.toContain('NENHUM SEMEADOR');
  });

  it('diz explicitamente que trocar de cópia não resolve', () => {
    // Sem esta frase a pessoa faz exatamente a coisa que não adianta.
    expect(avisoDoTorrent({ pares: 0, velocidade: 0, sem_rota: true }))
      .toMatch(/TROCAR NÃO ADIANTA/);
  });

  it('com rota, zero pares continua sendo culpa do enxame', () => {
    const aviso = avisoDoTorrent({ pares: 0, velocidade: 0, sem_rota: false });
    expect(aviso).toContain('NENHUM SEMEADOR');
    expect(aviso).not.toContain('SEM ROTA');
  });

  it('a rota vence a lentidão: com o túnel caído, "poucos semeadores" é ruído', () => {
    const aviso = avisoDoTorrent({ pares: 0, velocidade: 100, sem_rota: true });
    expect(aviso).toContain('SEM ROTA');
  });

  it('motor antigo, sem o campo, se comporta como antes', () => {
    // O campo é novo; um motor que não foi reiniciado não o manda.
    expect(avisoDoTorrent({ pares: 0, velocidade: 0 })).toContain('NENHUM SEMEADOR');
  });
});

// ── a barra de carregado não pode inventar o que não chegou ──────────────
// `video.buffered` é uma LISTA DE ILHAS, não um intervalo. A barra usava o fim
// da última ilha e pintava um bloco contínuo desde o início: quem assistiu
// cinco minutos e saltou para 1h30 via a barra cobrir tudo até 1h31.

describe('janelaCarregada', () => {
  // O cenário exato: cinco minutos vistos, salto para 1h30.
  const depoisDoSalto = [{ inicio: 0, fim: 300 }, { inicio: 5400, fim: 5460 }];

  it('devolve a ilha onde a pessoa está, não a última', () => {
    expect(janelaCarregada(depoisDoSalto, 5410)).toEqual({ inicio: 5400, fim: 5460 });
  });

  it('parado no começo, devolve a ilha do começo', () => {
    expect(janelaCarregada(depoisDoSalto, 120)).toEqual({ inicio: 0, fim: 300 });
  });

  it('no VÃO entre as ilhas não há nada carregado', () => {
    // O defeito inteiro morava aqui: 1h (3600s) era pintado como pronto.
    expect(janelaCarregada(depoisDoSalto, 3600)).toBeNull();
  });

  it('estar exatamente no fim de uma ilha ainda é estar nela', () => {
    // É onde a reprodução para para esperar; dizer "nada carregado" ali
    // apagaria a barra justamente quando ela informa alguma coisa.
    expect(janelaCarregada(depoisDoSalto, 300)).toEqual({ inicio: 0, fim: 300 });
  });

  it('sem nada carregado, nada', () => {
    expect(janelaCarregada([], 0)).toBeNull();
    expect(janelaCarregada(undefined, 0)).toBeNull();
    expect(janelaCarregada(null, 10)).toBeNull();
  });

  it('uma ilha só se comporta como antes', () => {
    expect(janelaCarregada([{ inicio: 0, fim: 900 }], 60))
      .toEqual({ inicio: 0, fim: 900 });
  });
});

describe('faixasDe', () => {
  // O TimeRanges do DOM, que não dá para construir num teste de nó.
  const comoODom = (pares: number[][]): TimeRanges => ({
    length: pares.length,
    start: (i: number) => pares[i][0],
    end: (i: number) => pares[i][1],
  } as TimeRanges);

  it('lê todas as ilhas, e não só a última', () => {
    expect(faixasDe(comoODom([[0, 300], [5400, 5460]]))).toEqual([
      { inicio: 0, fim: 300 }, { inicio: 5400, fim: 5460 },
    ]);
  });

  it('aguenta o elemento sem buffer nenhum', () => {
    expect(faixasDe(comoODom([]))).toEqual([]);
    expect(faixasDe(undefined)).toEqual([]);
  });
});

// ── tocando do torrent, nada é convertido ────────────────────────────────
// O <video> puxa do motor de torrent, mas `ehConvertida` respondia sobre a
// cópia que o resolvedor achou no Real-Debrid. Dois defeitos medidos saíram
// daí: o relógio marcando 31:40 com o primeiro fotograma na tela, e saltar
// para 1:20:00 levar o marcador para lá e o vídeo para o começo.

describe('ehConvertida com o torrent no ar', () => {
  const precisaConverter = {
    precisa_converter: 'audio', stream_url: 'https://rd/x.mkv',
  } as never;

  it('o torrent tem precedência sobre o que o resolvedor achou', () => {
    expect(ehConvertida(precisaConverter, null, 'a'.repeat(40))).toBe(false);
  });

  it('e vence até um modo imposto pela URL', () => {
    // `?modo=conversao` fala da cópia do Real-Debrid, que não está tocando.
    expect(ehConvertida(precisaConverter, CONVERSAO, 'b'.repeat(40))).toBe(false);
  });

  it('sem torrent, nada muda', () => {
    expect(ehConvertida(precisaConverter, null, null)).toBe(true);
    expect(ehConvertida(precisaConverter, null, '')).toBe(true);
  });
});

describe('pontoDeRetomada com o torrent no ar', () => {
  const precisaConverter = { precisa_converter: 'audio' } as never;

  it('não desloca o relógio: o fluxo do torrent começa no byte zero', () => {
    // Era isto que punha 31:40 no relógio sobre o primeiro fotograma.
    expect(pontoDeRetomada(precisaConverter, 1900, false, 9000, null, 'c'.repeat(40)))
      .toBe(0);
  });

  it('sem torrent, a retomada do fluxo convertido continua valendo', () => {
    expect(pontoDeRetomada(precisaConverter, 1900, false, 9000, null, null))
      .toBe(1900);
  });
});
