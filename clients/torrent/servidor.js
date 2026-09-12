/**
 * Serve um torrent por HTTP enquanto ele ainda está baixando.
 *
 * POR QUE EXISTE: quando nenhuma cópia tem disponibilidade imediata no
 * Real-Debrid, a alternativa era esperar o download terminar. Isto toca desde
 * o primeiro pedaço, como o Stremio.
 *
 * POR QUE UM SERVIÇO À PARTE, e não dentro do Django: o BitTorrent é um laço de
 * eventos ocupado — dezenas de conexões, verificação de hash, escrita em disco
 * — e nada disso pode dividir processo com quem responde requisições de tela.
 * Além do mais a biblioteca madura é de Node.
 *
 * O QUE ESTE SERVIÇO NÃO FAZ: escolher o que baixar. Ele recebe um magnet, e
 * só. Quem decide se vale a pena é o Lumière, que sabe o tamanho da cópia e
 * quanto disco existe.
 *
 * *** AVISO QUE O USUÁRIO PRECISA TER LIDO ***
 * Tocar direto do torrent põe o IP DESTA MÁQUINA no enxame, visível a qualquer
 * outro par. É diferente do Real-Debrid, que baixa em nome dele e entrega por
 * HTTP — com o RD, o enxame nunca vê este IP. A tela precisa dizer isso antes
 * do primeiro clique.
 */

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import WebTorrent from 'webtorrent';

import { arquivoPrincipal, faixaPedida } from './escolhas.js';

const PORTA = Number(process.env.PORTA_TORRENT || 8001);

// Onde as peças caem. Fora do repositório de propósito: são gigabytes, e um
// `git status` num diretório desses é doloroso.
const PASTA = process.env.PASTA_TORRENT || path.join(os.tmpdir(), 'lumiere-torrent');

// Teto por arquivo.
//
// Medido nesta máquina: 11 GB livres. Um REMUX de 65 GB simplesmente não cabe,
// e descobrir isso com o disco cheio é pior que recusar na hora — o sistema
// operacional inteiro começa a falhar antes do vídeo.
//
// O número é conservador de propósito: sobra espaço para o resto da máquina
// respirar enquanto um filme baixa.
const LIMITE_DE_BYTES = Number(process.env.LIMITE_TORRENT_BYTES || 6 * 1024 ** 3);

// Quanto esperar por um par antes de dizer que não há ninguém semeando.
//
// Um torrent sem semeadores não dá erro: ele fica parado para sempre, e a tela
// mostraria um vídeo que nunca começa. Trinta segundos é folgado para um
// torrent saudável achar o primeiro par e curto para não virar espera.
const SEGUNDOS_ATE_DESISTIR = 30;

// Um torrent parado sem ninguém lendo é disco ocupado à toa.
const MINUTOS_OCIOSO = 20;

const cliente = new WebTorrent();

/**
 * Nada derruba o processo.
 *
 * Aconteceu na primeira execução: um magnet que a biblioteca não soube
 * interpretar lançou dentro de um `queueMicrotask` — fora de qualquer
 * try/catch possível — e o serviço INTEIRO morreu. Quem estivesse assistindo
 * perdeu o filme por causa de outro pedido.
 *
 * O laço de eventos do BitTorrent recebe dados de estranhos o tempo todo; um
 * par malformado não pode ter o poder de encerrar o processo.
 */
process.on('uncaughtException', (erro) => {
  console.error('[lumiere-torrent] exceção não tratada, seguindo:', erro?.message || erro);
});
process.on('unhandledRejection', (erro) => {
  console.error('[lumiere-torrent] promessa rejeitada, seguindo:', erro?.message || erro);
});

cliente.on('error', (erro) => {
  console.error('[lumiere-torrent] cliente:', erro?.message || erro);
});
/** infoHash -> { torrent, arquivo, criadoEm, ultimoAcesso, erro } */
const emCurso = new Map();

fs.mkdirSync(PASTA, { recursive: true });


function estadoDe(entrada) {
  const { torrent, arquivo, erro } = entrada;
  return {
    info_hash: torrent.infoHash,
    arquivo: arquivo ? arquivo.name : null,
    tamanho: arquivo ? arquivo.length : null,
    pares: torrent.numPeers,
    // Do ARQUIVO, e não do torrent: um torrent com extras tem progresso baixo
    // enquanto o filme já está quase todo aqui.
    progresso: arquivo ? arquivo.progress : torrent.progress,
    baixado: torrent.downloaded,
    velocidade: torrent.downloadSpeed,
    pronto: Boolean(arquivo),
    erro: erro || null,
  };
}

function jsonDe(resposta, codigo, corpo) {
  const texto = JSON.stringify(corpo);
  resposta.writeHead(codigo, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(texto),
  });
  resposta.end(texto);
}

/**
 * Põe um magnet no ar, ou devolve o que já está.
 *
 * Resolve quando os METADADOS chegam — não quando o arquivo termina. É a
 * diferença entre este recurso existir e não existir: os metadados vêm em
 * segundos, e a partir deles já dá para começar a servir bytes.
 */
function adiciona(magnet) {
  return new Promise((resolve, reject) => {
    const existente = [...emCurso.values()].find(
      (e) => e.magnet === magnet || magnet.includes(e.torrent.infoHash));
    if (existente) {
      existente.ultimoAcesso = Date.now();
      return resolve(existente);
    }

    const torrent = cliente.add(magnet, { path: PASTA });
    const entrada = { torrent, magnet, arquivo: null, criadoEm: Date.now(),
                      ultimoAcesso: Date.now(), erro: null };

    const desistir = setTimeout(() => {
      if (entrada.arquivo) return;
      entrada.erro = torrent.numPeers === 0
        ? 'Nenhum semeador respondeu. Este torrent não tem quem o compartilhe agora.'
        : 'Os metadados do torrent não chegaram a tempo.';
      reject(new Error(entrada.erro));
      torrent.destroy();
    }, SEGUNDOS_ATE_DESISTIR * 1000);

    torrent.on('error', (erro) => {
      clearTimeout(desistir);
      entrada.erro = String(erro?.message || erro);
      reject(erro);
    });

    torrent.on('metadata', () => {
      clearTimeout(desistir);
      const arquivo = arquivoPrincipal(torrent.files);

      if (!arquivo) {
        torrent.destroy();
        return reject(new Error('O torrent não tem nenhum arquivo.'));
      }

      if (arquivo.length > LIMITE_DE_BYTES) {
        torrent.destroy();
        const gb = (arquivo.length / 1024 ** 3).toFixed(1);
        const teto = (LIMITE_DE_BYTES / 1024 ** 3).toFixed(0);
        return reject(new Error(
          `Esta cópia tem ${gb} GB e o limite de disco para tocar direto do ` +
          `torrent é ${teto} GB. Escolha uma cópia menor, ou mande baixar no ` +
          `Real-Debrid.`));
      }

      // Só o arquivo que vai tocar. Sem isto o motor baixa extras e amostras,
      // gastando disco e banda em coisa que ninguém vai ver.
      torrent.files.forEach((f) => (f === arquivo ? f.select() : f.deselect()));

      entrada.arquivo = arquivo;
      emCurso.set(torrent.infoHash, entrada);
      resolve(entrada);
    });
  });
}

/**
 * Serve o arquivo, honrando `Range`.
 *
 * É a peça que faz o `<video>` funcionar: sem 206 e sem `Content-Range` o
 * navegador não consegue buscar posição, e um filme de duas horas vira uma
 * fita que só anda para frente.
 */
function transmite(entrada, requisicao, resposta) {
  const { arquivo } = entrada;
  entrada.ultimoAcesso = Date.now();

  const total = arquivo.length;
  const pedido = faixaPedida(requisicao.headers.range, total);

  // Faixa impossível precisa dizer que é impossível. Servir o arquivo inteiro
  // no lugar faz o navegador montar um vídeo corrompido, sem erro nenhum.
  if (!pedido) {
    resposta.writeHead(416, { 'Content-Range': `bytes */${total}` });
    return resposta.end();
  }

  const { inicio, fim, parcial } = pedido;

  resposta.writeHead(parcial ? 206 : 200, {
    'Content-Type': 'video/mp4',
    'Content-Length': fim - inicio + 1,
    'Accept-Ranges': 'bytes',
    ...(parcial ? { 'Content-Range': `bytes ${inicio}-${fim}/${total}` } : {}),
  });

  // `createReadStream`, e NÃO `stream()`.
  //
  // No webtorrent 3 os dois existem e devolvem coisas diferentes: `stream()`
  // é um ReadableStream da web, que não tem `.pipe()`. Usá-lo lança dentro de
  // uma promessa, a resposta fica sem ninguém para escrevê-la, e o navegador
  // espera para sempre — 0 bytes em 90 segundos, com 6 pares conectados.
  const fluxo = arquivo.createReadStream({ start: inicio, end: fim });
  fluxo.pipe(resposta);

  // O navegador abandona faixas o tempo todo — a cada salto, e ao fechar a
  // aba. Sem destruir o fluxo, cada um desses deixa o motor buscando peças que
  // ninguém espera mais.
  resposta.on('close', () => fluxo.destroy());
  fluxo.on('error', () => resposta.destroyed || resposta.end());
}

function remove(infoHash) {
  const entrada = emCurso.get(infoHash);
  if (!entrada) return false;
  emCurso.delete(infoHash);
  // `destroy` com `destroyStore` apaga as peças do disco. Sem isso cada filme
  // assistido fica ocupando gigabytes para sempre.
  entrada.torrent.destroy({ destroyStore: true });
  return true;
}

// Faxina: torrent sem ninguém lendo é disco parado.
setInterval(() => {
  const limite = Date.now() - MINUTOS_OCIOSO * 60 * 1000;
  for (const [hash, entrada] of emCurso) {
    if (entrada.ultimoAcesso < limite) {
      console.log(`[faxina] removendo ${hash}, ocioso há ${MINUTOS_OCIOSO} min`);
      remove(hash);
    }
  }
}, 60 * 1000).unref();

const servidor = http.createServer(async (requisicao, resposta) => {
  const url = new URL(requisicao.url, `http://localhost:${PORTA}`);
  const partes = url.pathname.split('/').filter(Boolean);

  try {
    if (url.pathname === '/saude') {
      return jsonDe(resposta, 200, {
        ok: true, torrents: emCurso.size,
        limite_bytes: LIMITE_DE_BYTES, pasta: PASTA,
      });
    }

    // POST /torrent  { magnet }
    if (requisicao.method === 'POST' && url.pathname === '/torrent') {
      const corpo = await new Promise((r) => {
        let dados = '';
        requisicao.on('data', (p) => (dados += p));
        requisicao.on('end', () => r(dados));
      });
      const { magnet } = JSON.parse(corpo || '{}');
      if (!magnet) return jsonDe(resposta, 400, { erro: 'magnet ausente' });

      const entrada = await adiciona(magnet);
      return jsonDe(resposta, 200, estadoDe(entrada));
    }

    // GET /torrent/:hash/estado  |  /stream   |  DELETE /torrent/:hash
    if (partes[0] === 'torrent' && partes[1]) {
      const entrada = emCurso.get(partes[1]);
      if (!entrada) return jsonDe(resposta, 404, { erro: 'torrent não está no ar' });

      if (requisicao.method === 'DELETE') {
        remove(partes[1]);
        return jsonDe(resposta, 200, { removido: true });
      }
      if (partes[2] === 'estado') return jsonDe(resposta, 200, estadoDe(entrada));
      if (partes[2] === 'stream') return transmite(entrada, requisicao, resposta);
    }

    return jsonDe(resposta, 404, { erro: 'rota desconhecida' });
  } catch (erro) {
    // Depois de `writeHead` não há como mandar JSON: a tentativa vira
    // "Cannot write headers after they are sent" e o erro REAL desaparece
    // atrás dela. Foi assim que um `.pipe()` inexistente virou um silêncio de
    // 90 segundos em vez de uma mensagem.
    if (resposta.headersSent) {
      console.error('[lumiere-torrent] erro depois do cabeçalho:', erro?.message || erro);
      return resposta.destroyed || resposta.end();
    }
    return jsonDe(resposta, 502, { erro: String(erro?.message || erro) });
  }
});

servidor.listen(PORTA, '127.0.0.1', () => {
  console.log(`[lumiere-torrent] ouvindo em 127.0.0.1:${PORTA}`);
  console.log(`[lumiere-torrent] peças em ${PASTA}, teto de ` +
              `${(LIMITE_DE_BYTES / 1024 ** 3).toFixed(0)} GB por arquivo`);
});

for (const sinal of ['SIGINT', 'SIGTERM']) {
  process.on(sinal, () => {
    console.log('[lumiere-torrent] encerrando e apagando as peças');
    for (const hash of [...emCurso.keys()]) remove(hash);
    cliente.destroy(() => process.exit(0));
  });
}
