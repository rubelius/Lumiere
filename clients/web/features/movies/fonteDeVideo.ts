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
export function ehConvertida(fonte?: Fonte | null, modo?: string | null): boolean {
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
): string | undefined {
  if (!fonte) return undefined;
  if (!ehConvertida(fonte, modo)) return fonte.stream_url;

  const params = new URLSearchParams();
  // A cópia que o backend REALMENTE resolveu, e não a que a URL pediu: quando
  // a página não indica nenhuma, quem escolhe é o resolvedor, e pedir a
  // conversão sem dizer qual faria a escolha de novo — podendo cair em outra.
  if (fonte.release_id) params.set('release', fonte.release_id);
  if (inicio > 0) params.set('inicio', inicio.toFixed(3));
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
): number {
  if (ehConvertida(fonte, modo)) {
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
): number {
  if (!ehConvertida(fonte, modo)) return 0;   // no direto o elemento salta sozinho
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
): string | undefined {
  if (!fonte) return undefined;

  if (modo === DIRETO && fonte.precisa_converter === 'audio') return 'DIRETO — SEM ÁUDIO';
  if (modo === DIRETO && fonte.precisa_converter === 'tudo') return 'DIRETO — PODE NÃO ABRIR';
  if (modo === CONVERSAO && fonte.precisa_converter === 'nada') return 'CONVERSÃO A PEDIDO';

  return fonte.label;
}
