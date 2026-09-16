import type { components } from '@/types/api-generated';

type Fonte = components['schemas']['PlaybackSource'];

/**
 * De onde o `<video>` puxa os bytes, e sob que regras.
 *
 * Há dois caminhos, e eles se comportam de formas diferentes o bastante para
 * que a tela precise saber em qual está:
 *
 *   DIRETO      — a URL do Real-Debrid. Arquivo pronto, aceita requisição por
 *                 faixa, o navegador sabe a duração e salta para onde quiser.
 *
 *   CONVERTIDO  — o áudio sendo transcodificado agora, porque o navegador não
 *                 decodifica DTS, TrueHD nem Dolby Digital. Sai como MP4
 *                 fragmentado: chega em ordem, não aceita faixa, e declara
 *                 como duração apenas o que já chegou. Saltar é recomeçar o
 *                 fluxo de outro ponto.
 */

/** Modos que a tela pode impor, contra o que o backend recomendaria. */
export const DIRETO = 'direto';
export const CONVERSAO = 'conversao';

/**
 * Se o fluxo vai passar pelo conversor.
 *
 * `modo` existe porque a recomendação do backend é uma recomendação, não uma
 * sentença: quem está assistindo pode preferir tocar a cópia crua — para levá-la
 * a um player externo, ou porque só quer ver a imagem — e pode preferir
 * converter uma cópia que provavelmente tocaria sozinha. Sem esse escape, a
 * única fuga da conversão era sair do navegador.
 */
export function ehConvertida(
  fonte?: Fonte | null,
  modo?: string | null,
  torrentHash?: string | null,
): boolean {
  // TOCANDO DO TORRENT NADA É CONVERTIDO, e esta linha conserta dois defeitos
  // medidos, os dois causados por esta função responder sobre a cópia do
  // Real-Debrid enquanto o <video> puxava do motor de torrent:
  //
  //  - o relógio marcava 31:40 com o PRIMEIRO fotograma na tela, porque
  //    `pontoDeRetomada` só devolve o ponto salvo quando há conversão, e o
  //    fluxo do torrent começa no byte zero de qualquer jeito;
  //  - saltar na barra para 1:20:00 levava o marcador para lá e o vídeo para o
  //    começo, porque o ramo do fluxo convertido religa o `src` com outro
  //    `inicio` — e a URL do torrent não tem `inicio`: o mesmo recurso reabre
  //    do zero.
  //
  // O motor de torrent serve o arquivo inteiro com `Range`. Isso É o caminho
  // direto, e o `src` já dava precedência ao torrent — faltava contar para
  // quem decide o resto.
  if (torrentHash) return false;

  if (!fonte) return false;
  if (modo === DIRETO) return false;
  if (modo === CONVERSAO) return true;
  return fonte.precisa_converter !== 'nada';
}

/**
 * O `src` do vídeo, começando em `inicio` segundos.
 *
 * Passa pela própria origem em vez de apontar para o Django: assim o cookie de
 * sessão acompanha o pedido sem exigir `crossOrigin` no elemento — atributo
 * que quebraria a reprodução das fontes diretas, porque a CDN do Real-Debrid
 * não devolve cabeçalho CORS nenhum.
 */
export function urlDoVideo(
  fonte: Fonte | undefined | null,
  movieId: string,
  inicio = 0,
  modo?: string | null,
  faixa = 0,
): string | undefined {
  if (!fonte) return undefined;
  if (!ehConvertida(fonte, modo)) return fonte.stream_url;

  const params = new URLSearchParams();
  // A cópia que o backend REALMENTE resolveu, e não a que a URL pediu: quando
  // a página não indica nenhuma, quem escolhe é o resolvedor, e pedir a
  // conversão sem dizer qual faria a escolha de novo — podendo cair em outra.
  if (fonte.release_id) params.set('release', fonte.release_id);
  if (inicio > 0) params.set('inicio', inicio.toFixed(3));
  // A faixa vai na URL porque trocar de idioma é RELIGAR o ffmpeg com outro
  // `-map`: o navegador recebe uma faixa só, já misturada, e não tem como
  // trocar por conta própria.
  if (faixa > 0) params.set('faixa', String(faixa));
  return `/api/stream/${movieId}?${params}`;
}

/**
 * Quanto tempo o filme tem, em segundos, ou 0 enquanto não se sabe.
 *
 * No caminho direto quem responde é o próprio elemento. No convertido ele
 * responde errado — `duration` num MP4 fragmentado é o tamanho do buffer, e
 * cresce enquanto o filme roda —, então vale a medida que o backend tirou do
 * arquivo com ffprobe.
 *
 * O `length_minutes` do catálogo fica como último recurso, e é mesmo o último:
 * para The Departed ele diz 151 min contra 9078,7s medidos, quase vinte
 * segundos de diferença. Serve para a barra ter escala, não para acertar o
 * ponto de um salto.
 */
export function duracaoDoFilme(
  fonte: Fonte | undefined | null,
  duracaoDoElemento: number,
  minutosDoCatalogo?: number | null,
  modo?: string | null,
  torrentHash?: string | null,
): number {
  // Esta era a ÚNICA função do módulo que ficou sem saber do torrent quando
  // `ehConvertida` aprendeu — e a falta aparecia na barra: a duração vinha do
  // `duracao_segundos` que o ffprobe mediu na cópia DO REAL-DEBRID, outro
  // arquivo, possivelmente outro corte, enquanto no ar estava o do torrent. A
  // barra inteira era escalada por um número de outro filme.
  //
  // O motor de torrent serve arquivo completo com Range, então o navegador lê
  // a duração certa sozinho.
  if (ehConvertida(fonte, modo, torrentHash)) {
    if (fonte?.duracao_segundos) return fonte.duracao_segundos;
    return minutosDoCatalogo ? minutosDoCatalogo * 60 : 0;
  }
  return Number.isFinite(duracaoDoElemento) ? duracaoDoElemento : 0;
}

/**
 * Onde as legendas anteriores ao ponto de abertura ficam guardadas: 11 dias à
 * frente, longe de qualquer reprodução. Não é descarte — o player mantém os
 * tempos originais e recalcula a cada salto.
 */
export const FORA_DA_JANELA = 1e6;

/**
 * O tempo de uma legenda no relógio do ELEMENTO, não no do filme.
 *
 * O arquivo de legenda fala em tempo de filme. O `<video>`, no fluxo
 * convertido, conta a partir do segundo em que o ffmpeg foi ligado. Sem
 * descontar o deslocamento, retomar em 1h mostra as falas do primeiro minuto
 * sobre a cena de 1h — e da marca `duração - deslocamento` em diante não
 * sobra legenda nenhuma, porque não existe cue com tempo tão alto.
 *
 * Clampar em zero seria pior que não descontar: empilharia TODA fala anterior
 * ao ponto de abertura no primeiro instante do fluxo.
 */
export function tempoDaCue(
  original: { inicio: number; fim: number },
  atraso: number,
  deslocamento: number,
): { inicio: number; fim: number } {
  const inicio = original.inicio + atraso - deslocamento;
  const fim = original.fim + atraso - deslocamento;

  if (fim <= 0) return { inicio: FORA_DA_JANELA, fim: FORA_DA_JANELA };
  return { inicio: Math.max(0, inicio), fim };
}

// Abaixo disto retomar não economiza nada e ainda confunde: o filme pularia
// alguns segundos à frente sem razão aparente.
export const RETOMADA_MINIMA_S = 30;

// E perto demais do fim, retomar joga o usuário direto nos créditos de um
// filme que ele não terminou — melhor recomeçar do início.
export const RESTO_MINIMO_S = 60;

/**
 * Em que segundo abrir o fluxo, dado onde a pessoa parou.
 *
 * Existe como função à parte porque a resposta precisa ser conhecida ANTES do
 * primeiro byte. Decidindo depois — quando o elemento avisa que carregou —,
 * cada abertura de player pedia o filme duas vezes: uma do começo, que o
 * Real-Debrid começava a servir, e outra do ponto certo, matando a primeira.
 */
export function pontoDeRetomada(
  fonte: Fonte | undefined | null,
  paradoEm: number | null | undefined,
  terminou: boolean | null | undefined,
  duracao: number,
  modo?: string | null,
  torrentHash?: string | null,
): number {
  // no direto — e o torrent é direto — o elemento salta sozinho
  if (!ehConvertida(fonte, modo, torrentHash)) return 0;
  const parou = paradoEm ?? 0;
  if (terminou || duracao <= 0) return 0;
  if (parou <= RETOMADA_MINIMA_S) return 0;
  if (parou >= duracao - RESTO_MINIMO_S) return 0;
  return parou;
}

/**
 * O que dizer na tela sobre o que está acontecendo com esta fonte.
 *
 * O backend manda um rótulo — DIRECT PLAY, ÁUDIO CONVERTIDO, TRANSCODE — que
 * descreve o que ELE faria. Quando quem assiste impõe outro modo, esse rótulo
 * passa a descrever uma coisa que não está acontecendo, e a regra da casa é que
 * a tela não afirma o que não é verdade.
 *
 * Pedir reprodução direta de uma cópia com DTS é uma escolha legítima — serve
 * para mandar ao VLC, ou para quem só quer a imagem — mas o resultado é vídeo
 * mudo, e isso precisa estar escrito antes de a pessoa concluir que quebrou.
 */
export function rotuloDaFonte(
  fonte: Fonte | undefined | null,
  modo?: string | null,
  torrentHash?: string | null,
): string | undefined {
  // O torrent é uma fonte, e o resolvedor não sabe disso.
  //
  // MEDIDO na tela: com o filme TOCANDO do torrent — `readyState` 4, duração
  // de 2h34 lida do arquivo —, o selo dizia SEM FONTE e o Lumière escrevia por
  // cima "Sem fonte disponível. Nenhuma cópia em Real-Debrid, Jellyfin ou
  // Plex". Estava certo sobre o Real-Debrid e mentindo sobre o filme.
  //
  // A causa é a de sempre aqui: `fonte` responde "o que o resolvedor achou" e
  // a tela a usava para responder "há o que tocar". São perguntas diferentes
  // desde o dia em que o torrent virou uma origem possível.
  if (torrentHash) return 'TORRENT DIRETO';

  if (!fonte) return undefined;

  if (modo === DIRETO && fonte.precisa_converter === 'audio') return 'DIRETO — SEM ÁUDIO';
  if (modo === DIRETO && fonte.precisa_converter === 'tudo') return 'DIRETO — PODE NÃO ABRIR';
  if (modo === CONVERSAO && fonte.precisa_converter === 'nada') return 'CONVERSÃO A PEDIDO';

  return fonte.label;
}

/** Uma faixa de áudio como o backend a mede. */
export interface FaixaDeAudio {
  posicao: number;
  index: number;
  codec: string;
  canais: number;
  layout: string;
  idioma: string;
  titulo: string;
}

// Os idiomas que aparecem no acervo. ISO 639-2, que é o que o ffprobe devolve.
const IDIOMAS: Record<string, string> = {
  por: 'PORTUGUÊS', pob: 'PORTUGUÊS (BR)', eng: 'INGLÊS', fre: 'FRANCÊS',
  fra: 'FRANCÊS', spa: 'ESPANHOL', ita: 'ITALIANO', ger: 'ALEMÃO',
  deu: 'ALEMÃO', jpn: 'JAPONÊS', rus: 'RUSSO', kor: 'COREANO',
  chi: 'CHINÊS', zho: 'CHINÊS', swe: 'SUECO', dan: 'DINAMARQUÊS',
  nor: 'NORUEGUÊS', fin: 'FINLANDÊS', pol: 'POLONÊS', nld: 'HOLANDÊS',
  dut: 'HOLANDÊS', cze: 'TCHECO', hun: 'HÚNGARO', ara: 'ÁRABE',
  hin: 'HINDI', tur: 'TURCO', heb: 'HEBRAICO', gre: 'GREGO',
};

const ARRANJOS: Record<number, string> = { 1: 'MONO', 2: 'ESTÉREO', 6: '5.1', 8: '7.1' };

/**
 * Se esta faixa é comentário, e não o filme.
 *
 * Importa porque escolher errado não é um detalhe: em "Mártires" duas das
 * quatro faixas são comentários de especialistas, e cair numa delas troca o
 * filme por uma aula sobre ele. O ffprobe não tem campo para isso — a
 * informação vive no título, em inglês, porque é assim que os REMUX marcam.
 */
export function ehComentario(faixa: FaixaDeAudio): boolean {
  return /comment|commentary|coment[áa]rio/i.test(faixa.titulo);
}

/**
 * O nome curto da faixa, do jeito que ajuda a escolher.
 *
 * Idioma primeiro porque é o que se procura; arranjo depois, porque é o
 * desempate entre duas faixas do mesmo idioma. Sem idioma etiquetado — comum —
 * sobra o codec, que ao menos distingue uma faixa da outra.
 */
export function nomeDaFaixa(faixa: FaixaDeAudio): string {
  const partes = [
    IDIOMAS[faixa.idioma] || faixa.idioma.toUpperCase() || faixa.codec.toUpperCase(),
    ARRANJOS[faixa.canais] || (faixa.canais ? `${faixa.canais}CH` : ''),
    ehComentario(faixa) ? 'COMENTÁRIO' : '',
  ].filter(Boolean);
  return partes.join(' · ');
}

/**
 * Qual faixa tocar quando ninguém escolheu.
 *
 * A primeira que não seja comentário. `-map 0:a:0` pega a primeira do arquivo
 * e pronto, e em geral está certo — mas quando não está, o filme começa com
 * alguém explicando o filme.
 */
export function faixaPadrao(faixas: FaixaDeAudio[]): number {
  const primeira = faixas.findIndex((f) => !ehComentario(f));
  return primeira >= 0 ? primeira : 0;
}

/**
 * O que dizer sobre um download que está alimentando a reprodução.
 *
 * String vazia quando está saudável — a tela não anuncia normalidade.
 *
 * Os números não são enfeite: medido, um torrent com 1 par a 2,4 KB/s deixou
 * um pedido de 64 KB estourar 120 segundos sem entregar nada. Com 2 pares, o
 * mesmo pedido voltou em 0,04s. A diferença entre "vai travar" e "está indo"
 * está nesses dois números, e quem está olhando merece vê-los.
 */
export function avisoDoTorrent(estado: {
  pares: number; velocidade: number; sem_rota?: boolean;
  cache?: { pausado_por_cota: boolean } | null;
} | undefined): string {
  if (!estado) return '';

  // A ROTA ANTES DO ENXAME. Zero pares e sem caminho para fora dão o mesmo
  // número, e acusar o enxame quando o que caiu foi a VPN manda a pessoa
  // trocar de cópia até desistir do filme — nenhuma outra vai funcionar. O
  // motor já fazia essa distinção ao ACEITAR um magnet e não ao relatar
  // estado; agora ele manda `sem_rota` e a frase acompanha.
  if (estado.sem_rota) {
    return 'SEM ROTA PARA A INTERNET. NÃO É A CÓPIA — TROCAR NÃO ADIANTA. '
      + 'SE O MOTOR ESTÁ ATRÁS DE UMA VPN, O TÚNEL CAIU.';
  }

  if (estado.pares === 0) {
    return 'NENHUM SEMEADOR. ESTA CÓPIA NÃO TEM QUEM A COMPARTILHE AGORA — '
      + 'ESCOLHA OUTRA, OU MANDE BAIXAR NO REAL-DEBRID.';
  }

  if (estado.cache?.pausado_por_cota) {
    return 'O CACHE ENCHEU E O DOWNLOAD PAUSOU. ELE RETOMA CONFORME VOCÊ '
      + 'AVANÇA NO FILME; PARA NÃO PARAR, AUMENTE A COTA EM CONFIGURAÇÕES.';
  }

  // Abaixo disto não dá para sustentar nem um 1080p leve, que pede ~1 MB/s.
  if (estado.velocidade < 200 * 1024) {
    const kb = Math.round(estado.velocidade / 1024);
    return `POUCOS SEMEADORES — ${estado.pares} PAR(ES) A ${kb} KB/S. `
      + 'A REPRODUÇÃO PODE TRAVAR.';
  }

  return '';
}


/**
 * Se há ALGO tocando ou prestes a tocar — venha de onde vier.
 *
 * Existe para que a tela pare de responder essa pergunta com `!fonte`, que só
 * conhece Real-Debrid, Jellyfin e Plex. Um vídeo do torrent rodando debaixo de
 * um aviso de "sem fonte" não é um detalhe de estilo: é a tela afirmando o
 * contrário do que está acontecendo, e é o defeito que este projeto mais
 * repete.
 */
export function temOQueTocar(
  fonte: Fonte | undefined | null,
  torrentHash?: string | null,
): boolean {
  return Boolean(torrentHash) || Boolean(fonte);
}

/**
 * O selo de qualidade do player: a cópia QUE ESTÁ TOCANDO.
 *
 * MEDIDO como defeito: o player passava `movie.best_quality_available`, que é
 * o rótulo da cópia de MAIOR NOTA do acervo. A escolha da fonte é
 * deliberadamente a que o navegador aceita e não a de maior nota — a própria
 * docstring de `_por_utilidade` diz que "mandar a de maior nota para o player
 * entrega imagem sem som". Num filme com um REMUX 2160p DV ATMOS (nota alta,
 * DTS, não toca) e um WEB-DL 1080p pronto, o selo dourado dizia
 * "REMUX 2160p DV ATMOS" a centímetros do painel que media, do próprio
 * elemento, 1920×1080.
 *
 * `rotuloDoAcervo` entra como parâmetro DE PROPÓSITO, e é sempre ignorado:
 * ele está aqui para que o teste consiga provar que ninguém volta a usá-lo.
 */
export function rotuloDaCopia(
  fonte: Fonte | undefined | null,
  torrentHash?: string | null,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  rotuloDoAcervo?: string | null,
): string {
  // Tocando do torrent, quem escolheu não foi o resolvedor — mostrar o rótulo
  // dele seria descrever outra cópia de novo.
  if (torrentHash) return '';
  return fonte?.rotulo_da_copia || '';
}

/** Uma ilha de vídeo já carregado, em segundos do elemento. */
export interface FaixaCarregada { inicio: number; fim: number }

/**
 * O trecho carregado A PARTIR DE ONDE A PESSOA ESTÁ.
 *
 * `video.buffered` NÃO é um intervalo — é uma lista de ilhas descontínuas.
 * Depois de um salto o navegador mantém a ilha antiga e abre outra adiante, e
 * entre as duas não há um byte.
 *
 * O defeito: a barra usava `buffered.end(length - 1)`, o fim da ÚLTIMA ilha, e
 * pintava um bloco contínuo desde o início do fluxo. Quem assistiu os cinco
 * primeiros minutos e saltou para 1h30 via a barra cinza cobrir tudo até
 * 1h31 — afirmando que 1h25 de filme que não existe no navegador estavam
 * prontos. A barra de carregado serve para responder "até onde posso ver sem
 * esperar", e respondia outra coisa.
 *
 * Devolve `null` quando nada está carregado no ponto atual — logo depois de um
 * salto, por exemplo. Mostrar nada é o certo ali: não há mesmo nada.
 */
export function janelaCarregada(
  faixas: FaixaCarregada[] | undefined | null,
  tempoAtual: number,
): FaixaCarregada | null {
  for (const faixa of faixas || []) {
    // `<=` nas duas pontas: estar exatamente no fim de uma ilha ainda é estar
    // nela, e é justamente onde a reprodução costuma parar para esperar.
    if (tempoAtual >= faixa.inicio && tempoAtual <= faixa.fim) return faixa;
  }
  return null;
}

/** `video.buffered` virado em algo que dá para testar sem um DOM. */
export function faixasDe(buffered: TimeRanges | undefined | null): FaixaCarregada[] {
  const faixas: FaixaCarregada[] = [];
  for (let i = 0; i < (buffered?.length || 0); i += 1) {
    faixas.push({ inicio: buffered!.start(i), fim: buffered!.end(i) });
  }
  return faixas;
}
