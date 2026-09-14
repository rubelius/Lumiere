/**
 * Um cache de peças com cota, que apaga o que já passou.
 *
 * O PEDIDO: em vez de gravar o torrent inteiro em disco, manter uma janela —
 * como o Stremio na TV. Uma cota configurável e, ao passar dela, as peças
 * INICIAIS (as já assistidas) saem do disco.
 *
 * POR QUE UM ARQUIVO POR PEÇA, e não o arquivo do filme inteiro: apagar do
 * meio de um arquivo exige "furar buracos" nele — `FALLOC_FL_PUNCH_HOLE` no
 * Linux, `F_PUNCHHOLE` no macOS — e o Node não expõe nenhuma das duas. Com uma
 * peça por arquivo, apagar é `unlink`, que existe em todo lugar e devolve o
 * espaço de verdade. O filme nunca fica montado em disco, e não precisa: quem
 * monta é o servidor, ao servir a faixa pedida.
 *
 * A PARTE QUE NÃO É ÓBVIA, e foi medida: apagar a peça do disco NÃO BASTA. O
 * torrent continua achando que a tem — um salto para trás lê do store, toma
 * erro, e o fluxo termina com ZERO BYTES e sem erro nenhum. O filme para e a
 * tela não sabe por quê. Verificado com o experimento em experimento-evicao.mjs.
 *
 * A cura é `torrent._markUnverified(index)`, que é o que o próprio webtorrent
 * faz quando uma peça falha na verificação: recria a Piece, zera o bit e volta
 * a selecioná-la. Com isso, um salto para trás rebaixa a peça e toca — medido,
 * 1,0 segundo para a peça voltar.
 */

import fs from 'node:fs';
import path from 'node:path';

/** Cota padrão. O usuário pode mudar, inclusive para ilimitado. */
export const COTA_PADRAO = 10 * 1024 ** 3;

/**
 * Quantas peças à frente da leitura nunca são evacuadas.
 *
 * Sem essa folga, uma cota apertada apagaria justamente o que está prestes a
 * ser lido — o motor rebaixaria em seguida, e o filme engasgaria em ciclo.
 * Dezesseis peças são ~2 MB com peça de 128 KB, e chegam a dezenas de MB nos
 * torrents de peça grande; nos dois casos é o que está sendo assistido agora.
 */
export const FOLGA_A_FRENTE = 16;

export class CacheDeslizante {
  /**
   * @param {number} chunkLength tamanho da peça, que o webtorrent define
   * @param {object} opts recebe `path`, `name`, `torrent` e a nossa `cota`
   */
  constructor(chunkLength, opts = {}) {
    this.chunkLength = chunkLength;
    this.torrent = opts.torrent || null;
    this.cota = opts.cota === undefined ? COTA_PADRAO : opts.cota;

    this.pasta = path.join(opts.path || '.', (opts.name || 'torrent').replace(/[^\w.-]/g, '_'));
    fs.mkdirSync(this.pasta, { recursive: true });

    /** índice -> bytes gravados */
    this.guardadas = new Map();
    this.bytes = 0;

    // Onde a leitura está, em índice de peça. O servidor atualiza a cada faixa
    // servida; sem isso a evacuação não teria como saber o que já passou.
    this.lendoEm = 0;

    this.destruido = false;

    // Qual arquivo do torrent está tocando. O servidor informa; sem isso,
    // retomar o download voltaria a querer os extras também.
    this.arquivoEmUso = null;
  }

  _arquivo(index) {
    return path.join(this.pasta, `${index}.peca`);
  }

  put(index, buf, cb = () => {}) {
    if (this.destruido) return cb(new Error('store destruído'));

    fs.writeFile(this._arquivo(index), buf, (erro) => {
      if (erro) return cb(erro);

      if (!this.guardadas.has(index)) this.bytes += buf.length;
      this.guardadas.set(index, buf.length);

      this._evacuaSePreciso();
      cb(null);
    });
  }

  get(index, opts, cb) {
    if (typeof opts === 'function') { cb = opts; opts = {}; }
    cb = cb || (() => {});
    if (this.destruido) return cb(new Error('store destruído'));

    if (!this.guardadas.has(index)) {
      // Peça evacuada, ou nunca gravada. Erro é a resposta certa: quem chama
      // sabe lidar, e o `_markUnverified` da evacuação já garantiu que o
      // torrent vai rebaixá-la.
      return cb(new Error(`peça ${index} não está no cache`));
    }

    fs.readFile(this._arquivo(index), (erro, buf) => {
      if (erro) {
        // O arquivo sumiu por fora. O registro estava mentindo; corrige.
        this._esquece(index);
        return cb(erro);
      }
      const inicio = opts.offset || 0;
      const fim = opts.length ? inicio + opts.length : buf.length;
      cb(null, buf.subarray(inicio, fim));
    });
  }

  /** Tira a peça do registro e do disco. Não avisa o torrent — quem faz é o chamador. */
  _esquece(index) {
    const tamanho = this.guardadas.get(index);
    if (tamanho === undefined) return false;
    this.guardadas.delete(index);
    this.bytes -= tamanho;
    try { fs.unlinkSync(this._arquivo(index)); } catch { /* já não estava lá */ }
    return true;
  }

  /**
   * Apaga as peças mais antigas até caber na cota.
   *
   * "Mais antigas" quer dizer menor índice, e não menos usadas: num filme a
   * leitura anda para frente, e o que ficou para trás é justamente o que já
   * foi assistido. Uma política por uso recente (LRU) apagaria a peça que o
   * leitor está prestes a alcançar.
   */
  _evacuaSePreciso() {
    // Ilimitado é `Infinity`, e a linha abaixo já cobre esse caso: nada é
    // maior que Infinity. Havia aqui um `Number.isFinite` antes dela que não
    // mudava resultado nenhum — encontrado por mutação.
    if (this.bytes <= this.cota) return;

    // A checagem vem ANTES de apagar qualquer coisa.
    //
    // Na primeira versão eu apagava e só então descobria que não dava para
    // avisar o torrent — e uma peça já tinha ido, criando exatamente a
    // truncagem silenciosa que esta guarda existe para impedir. Encontrado por
    // teste.
    if (!this._podeAvisar()) return;

    const limite = this.lendoEm - 1;
    const candidatas = [...this.guardadas.keys()]
      .filter((i) => i <= limite)              // só o que já passou
      .sort((a, b) => a - b);

    for (const index of candidatas) {
      if (this.bytes <= this.cota) break;
      if (this._esquece(index)) this._avisaOTorrent(index);
    }

    // Ainda estourado depois de apagar tudo que passou? Então PARA DE BAIXAR.
    //
    // Apagar o que vem à frente seria apagar o filme que está tocando. E
    // deixar baixar torna a cota um enfeite: sem leitura avançando não há o
    // que evacuar, e um download solto passa da cota sem limite — medido, 123
    // MB com cota de 20 MB, porque ninguém estava assistindo.
    //
    // Pausado, o torrent retoma sozinho assim que a leitura avançar e liberar
    // espaço. A espera é visível na tela como buffer, que é honesto: o disco
    // que o usuário concedeu acabou.
    this._ajustaOFluxo();
  }

  /**
   * "Não tenho mais esta peça."
   *
   * Sem isto, o torrent segue achando que tem: um salto para trás lê do store,
   * toma erro, e o fluxo termina com zero bytes SEM ERRO — o filme para e
   * ninguém sabe por quê. Medido.
   *
   * `_markUnverified` é interno do webtorrent (daí o underscore), e é a mesma
   * chamada que ele usa quando uma peça falha na verificação. Se uma versão
   * futura removê-la, a evacuação é desligada e o cache passa a ser ilimitado:
   * gastar disco é ruim, servir silêncio é pior.
   */
  /**
   * Pausa quando não cabe mais, retoma quando couber.
   *
   * É o que faz a cota ser um teto e não uma sugestão.
   */
  _ajustaOFluxo() {
    const torrent = this.torrent;
    if (!torrent || typeof torrent.pause !== 'function') return;

    const estourado = this.bytes > this.cota;

    if (estourado && !this._pausado) {
      this._pausado = true;
      torrent.pause();
      // `pause()` sozinho não basta: ele impede conexões NOVAS e pedidos
      // novos, mas os pares já conectados seguem enviando o que foi pedido.
      // Medido: com cota de 20 MB o torrent chegou aos 123 MB do arquivo
      // inteiro. `deselect` é o que diz "não quero mais estas peças".
      for (const arquivo of torrent.files || []) arquivo.deselect();
      console.warn(`[cache] cota de ${(this.cota / 1024 ** 2).toFixed(0)} MB `
        + 'cheia; download pausado até a leitura avançar');
    } else if (!estourado && this._pausado) {
      this._pausado = false;
      // Só o arquivo que está tocando volta a ser querido; os outros do
      // torrent (amostras, extras) continuam de fora, como na escolha inicial.
      if (this.arquivoEmUso) this.arquivoEmUso.select();
      torrent.resume();
    }
  }

  _podeAvisar() {
    if (typeof this.torrent?._markUnverified === 'function') return true;

    if (!this._jaAvisouDaFalta) {
      this._jaAvisouDaFalta = true;
      console.error('[cache] `_markUnverified` sumiu do webtorrent; '
        + 'evacuação desligada para não servir silêncio');
    }
    // Vira ilimitado: gastar disco é ruim, servir zero bytes sem erro é pior.
    this.cota = Infinity;
    return false;
  }

  _avisaOTorrent(index) {
    this.torrent._markUnverified(index);
  }

  /**
   * O servidor diz onde a leitura está, e é isso que define o que já passou.
   *
   * Avaliar a cota AQUI também, e não só ao gravar, é o que faz a evacuação
   * funcionar num filme já baixado: sem mais `put`, o gatilho de escrita nunca
   * volta a disparar, e o cache ficaria com o arquivo inteiro para sempre por
   * mais que a leitura avançasse. Medido — 987 peças antes e depois de assistir
   * o filme todo.
   */
  defineLeitura(index) {
    const antes = this.lendoEm;
    this.lendoEm = Math.max(0, index - FOLGA_A_FRENTE);
    if (this.lendoEm > antes) this._evacuaSePreciso();
  }

  estado() {
    return {
      bytes: this.bytes,
      pecas: this.guardadas.size,
      cota: Number.isFinite(this.cota) ? this.cota : null,
      lendo_em: this.lendoEm,
      pausado_por_cota: Boolean(this._pausado),
    };
  }

  close(cb = () => {}) { this.destruido = true; cb(null); }

  destroy(cb = () => {}) {
    this.destruido = true;
    this.guardadas.clear();
    this.bytes = 0;
    fs.rm(this.pasta, { recursive: true, force: true }, () => cb(null));
  }
}
