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
import dns from 'node:dns/promises';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import WebTorrent from 'webtorrent';

import { CacheDeslizante, COTA_PADRAO } from './cacheDeslizante.js';
import { anunciosPara, arquivoPrincipal, cabeNoDisco, faixaPedida } from './escolhas.js';

const PORTA = Number(process.env.PORTA_TORRENT || 8001);

// Em que interface atender.
//
// O padrão é `127.0.0.1` e continua sendo: este serviço não autentica nada —
// quem alcança a porta manda o motor baixar o que quiser — e abri-lo para a
// rede local seria entregar isso ao primeiro aparelho do Wi-Fi.
//
// Mas dentro de um container esse padrão não atende NINGUÉM: o `localhost` do
// container não é o da máquina, e o Django, de fora, bate numa porta muda. Daí
// a variável — que existe para o compose dizer `0.0.0.0`, onde quem faz o
// papel de tranca é a rede do Docker e o firewall do gluetun, e não o bind.
const INTERFACE = process.env.INTERFACE_TORRENT || '127.0.0.1';

// A porta por onde os PARES entram. Coisa diferente da de cima: aquela é o
// HTTP que o Lumière consome, esta é o BitTorrent.
//
// Sem fixá-la o webtorrent sorteia uma a cada subida, e uma porta sorteada não
// tem como ser encaminhada — nem no roteador, nem pelo gluetun. Sem
// encaminhamento o motor ainda acha pares (as conexões de saída funcionam),
// mas só alcança quem aceita conexão, e num torrent magro isso é a diferença
// entre tocar e esperar.
const PORTA_DE_PARES = Number(process.env.PORTA_DE_PARES || 51413);

// E a da DHT, que precisa ser OUTRA.
//
// Medido ao pôr as duas no mesmo número: `bind EADDRINUSE 0.0.0.0:51413`. O
// `torrentPort` do webtorrent não é só TCP — o uTP fala UDP na mesma porta, e
// a DHT também é UDP. O erro ia para o `cliente.on('error')`, o serviço subia
// alegando "pares entram pela 51413", e nada escutava lá. Mais um caso do
// defeito da casa: a tela (aqui, o log) afirmando o que não é verdade.
const PORTA_DA_DHT = Number(process.env.PORTA_DA_DHT || PORTA_DE_PARES + 1);

// Desliga UPnP/NAT-PMP. Ligado é o padrão do webtorrent e faz sentido numa
// máquina atrás do roteador de casa; atrás de uma VPN não há roteador de casa
// para pedir nada.
const SEM_NAT = process.env.SEM_NAT_TORRENT === '1';

// Onde as peças caem. Fora do repositório de propósito: são gigabytes, e um
// `git status` num diretório desses é doloroso.
const PASTA = process.env.PASTA_TORRENT || path.join(os.tmpdir(), 'lumiere-torrent');

// Teto de DISCO — não de filme.
//
// A distinção é o conserto de um erro que este arquivo carregou desde antes do
// cache deslizante existir: comparar o teto com `arquivo.length` recusava um
// REMUX de 65 GB mesmo quando o cache estava configurado para nunca guardar
// mais que 10 GB dele. O tamanho do filme deixou de ser o que ocupa o disco no
// dia em que o cache passou a apagar o que já foi assistido.
//
// O que ocupa o disco é `bytesEmDisco()` logo abaixo. O teto guarda o sistema
// operacional de ficar sem espaço; ele não tem opinião sobre filmes grandes.
const LIMITE_DE_BYTES = Number(process.env.LIMITE_TORRENT_BYTES || 20 * 1024 ** 3);

/**
 * Quanto disco este torrent vai realmente pedir.
 *
 * Com cota, o cache nunca guarda mais que ela — o filme pode ter 65 GB e o
 * disco ver 10. Sem cota (`0` = ilimitado, escolha do usuário na tela), nada é
 * apagado e o disco vê o arquivo inteiro.
 */
function bytesEmDisco(tamanhoDoArquivo, cota) {
  return cota > 0 ? Math.min(cota, tamanhoDoArquivo) : tamanhoDoArquivo;
}

// Quanto o cache pode ocupar. `0` quer dizer ilimitado — baixa o filme inteiro
// e não apaga nada. O Lumière manda este valor a cada torrent, vindo das
// configurações do usuário; isto aqui é só o padrão de quem sobe o serviço
// sozinho.
const COTA_DO_CACHE = process.env.COTA_TORRENT_BYTES === undefined
  ? COTA_PADRAO
  : (Number(process.env.COTA_TORRENT_BYTES) || Infinity);

// Quanto esperar por um par antes de dizer que não há ninguém semeando.
//
// Um torrent sem semeadores não dá erro: ele fica parado para sempre, e a tela
// mostraria um vídeo que nunca começa. Trinta segundos é folgado para um
// torrent saudável achar o primeiro par e curto para não virar espera.
const SEGUNDOS_ATE_DESISTIR = 30;

// Um torrent parado sem ninguém lendo é disco ocupado à toa.
const MINUTOS_OCIOSO = 20;

const cliente = new WebTorrent({
  // Fixas para poderem ser encaminhadas. Ver PORTA_DE_PARES acima.
  torrentPort: PORTA_DE_PARES,
  dhtPort: PORTA_DA_DHT,
  // O webtorrent liga UPnP e NAT-PMP por padrão, para pedir ao roteador de
  // casa que abra a porta. Dentro do gluetun não há roteador de casa: o
  // gateway é a ponta do túnel, e o pedido vai bater na VPN. Quem cuida de
  // porta ali é o gluetun, quando o provedor oferece.
  natUpnp: !SEM_NAT,
  natPmp: !SEM_NAT,
});

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
/**
 * ...MAS SÓ DEPOIS DE ESTAR NO AR.
 *
 * A guarda acima foi escrita para o laço de eventos do BitTorrent, e lá ela
 * está certa. Na SUBIDA ela é o contrário de uma proteção.
 *
 * MEDIDO: com `PASTA_TORRENT` apontando para um caminho sem permissão, o
 * `mkdirSync` lança, a guarda engole, o módulo para antes do `listen` — e o
 * processo NÃO MORRE, porque os sockets que o WebTorrent já abriu seguram o
 * laço de eventos. Fica vivo para sempre sem atender ninguém, e nada no log
 * depois da primeira linha. Num container é pior: o Docker vê um processo de
 * pé, `restart` nenhum dispara, e o Lumière responde "motor fora do ar" sem
 * conseguir dizer por quê.
 *
 * Não existe falha de subida da qual valha a pena seguir em frente.
 */
let noAr = false;

function seguirOuMorrer(rotulo, erro) {
  if (noAr) {
    console.error(`[lumiere-torrent] ${rotulo}, seguindo:`, erro?.message || erro);
    return;
  }
  console.error(`[lumiere-torrent] ${rotulo} ANTES DE SUBIR — desistindo:`,
                erro?.stack || erro?.message || erro);
  process.exit(1);
}

process.on('uncaughtException', (erro) => seguirOuMorrer('exceção não tratada', erro));
process.on('unhandledRejection', (erro) => seguirOuMorrer('promessa rejeitada', erro));

cliente.on('error', (erro) => {
  console.error('[lumiere-torrent] cliente:', erro?.message || erro);
});
/** infoHash -> { torrent, arquivo, criadoEm, ultimoAcesso, erro } */
const emCurso = new Map();

fs.mkdirSync(PASTA, { recursive: true });

/**
 * Apaga o que sobrou de uma execução anterior.
 *
 * Todo o estado vive no `Map emCurso`, que é memória: um `docker kill`, um
 * OOM, um reboot — nenhum passa pelo SIGTERM que limpa as peças. Com volume
 * persistente isso vaza gigabytes para sempre, porque nada mais olha para essa
 * pasta depois.
 *
 * Apagar tudo na subida é seguro justamente porque o estado é memória: nada
 * aqui pode estar em uso, e o cache também não sabe reaproveitar — ele nasce
 * com o registro vazio e rebaixaria as peças de qualquer jeito. O que está no
 * disco não é economia, é lixo.
 */
function varreOQueSobrou() {
  let pastas = 0;
  for (const nome of fs.readdirSync(PASTA, { withFileTypes: true })) {
    if (!nome.isDirectory()) continue;
    fs.rmSync(path.join(PASTA, nome.name), { recursive: true, force: true });
    pastas += 1;
  }
  if (pastas) {
    console.log(`[faxina] ${pastas} pasta(s) de peças de uma execução anterior, apagadas`);
  }
}
varreOQueSobrou();

/** Quanto disco os torrents no ar já prometeram ocupar. */
function discoJaPrometido() {
  let total = 0;
  for (const entrada of emCurso.values()) {
    if (entrada.arquivo) total += bytesEmDisco(entrada.arquivo.length, entrada.cota);
  }
  return total;
}


/**
 * O cache deslizante de dentro dos embrulhos do webtorrent.
 *
 * Ele envolve o store em `ImmediateChunkStore(CacheChunkStore(o nosso))`, e
 * cada camada guarda a de baixo em `.store`. Procurar pelo método em vez de
 * contar as camadas sobrevive a uma mudança nesse empilhamento.
 */
function _cacheDe(torrent) {
  let alvo = torrent?.store;
  for (let i = 0; i < 5 && alvo; i++) {
    if (typeof alvo.defineLeitura === 'function') return alvo;
    alvo = alvo.store;
  }
  return null;
}

/**
 * Se existe rota para fora, agora.
 *
 * Um DNS em vez de um HTTP porque é o que quebra primeiro e mais barato: com o
 * túnel do gluetun morto, a resolução falha na hora com EAI_AGAIN — medido —
 * enquanto um TCP ficaria pendurado até o timeout.
 *
 * Resposta pessimista de propósito: na dúvida, dizemos que NÃO há rota. O
 * custo de errar para um lado é uma frase que menciona a VPN sem necessidade;
 * para o outro, é mandar a pessoa trocar de cópia até desistir do filme.
 */
async function alcancaAInternet() {
  try {
    await Promise.race([
      dns.resolve4('one.one.one.one'),
      new Promise((_, x) => setTimeout(() => x(new Error('demorou')), 4000)),
    ]);
    return true;
  } catch {
    return false;
  }
}

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
    cache: _cacheDe(torrent)?.estado() || null,
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
function adiciona(magnet, cota = COTA_DO_CACHE) {
  return new Promise((resolve, reject) => {
    const existente = [...emCurso.values()].find(
      (e) => e.magnet === magnet || magnet.includes(e.torrent.infoHash));
    if (existente) {
      existente.ultimoAcesso = Date.now();
      return resolve(existente);
    }

    // O cache precisa do próprio torrent para poder dizer "não tenho mais
    // esta peça", e o torrent só existe depois do `add`. Por isso o store é
    // uma classe que se auto-referencia via `opts.torrent`, que o webtorrent
    // injeta ao construir.
    const torrent = cliente.add(magnet, {
      path: PASTA,
      store: CacheDeslizante,
      storeOpts: { cota },
      // Sem isto o acervo inteiro depende da DHT: nenhum magnet vindo dos
      // indexadores traz `&tr=`. Medido no mesmo torrent — 30s sem um par,
      // 2,3s com anúncio.
      announce: anunciosPara(magnet),
    });
    const entrada = { torrent, magnet, arquivo: null, cota, criadoEm: Date.now(),
                      ultimoAcesso: Date.now(), erro: null };

    const desistir = setTimeout(async () => {
      if (entrada.arquivo) return;

      // "Nenhum semeador" e "sem rota para fora" produzem o MESMO silêncio, e
      // dizer o primeiro quando é o segundo manda a pessoa procurar outra
      // cópia para sempre — nenhuma vai funcionar.
      //
      // MEDIDO com o motor atrás de um gluetun cujo túnel não fechava: o
      // container respondia `/saude` normalmente, o Docker o dava como
      // healthy, e todo magnet voltava "nenhum semeador respondeu". A frase
      // era falsa e acionável na direção errada.
      const temRota = torrent.numPeers === 0 ? await alcancaAInternet() : true;

      entrada.erro = !temRota
        ? 'Sem rota para a internet. Se o motor está atrás de uma VPN, o túnel caiu — '
          + 'confira com ./infra/confere-a-vpn.sh.'
        : torrent.numPeers === 0
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

      const pedido = bytesEmDisco(arquivo.length, cota);
      const jaEmUso = discoJaPrometido();
      if (!cabeNoDisco(pedido, jaEmUso, LIMITE_DE_BYTES)) {
        torrent.destroy();
        const gb = (pedido / 1024 ** 3).toFixed(1);
        const teto = (LIMITE_DE_BYTES / 1024 ** 3).toFixed(0);
        // A frase precisa apontar para o que a pessoa pode mudar. Com cota, o
        // que estoura é a cota (e ela está na tela de configurações); sem cota,
        // é o filme.
        const culpado = cota > 0
          ? 'Reduza o cache em Configurações › Reprodução'
          : 'Defina um cache com tamanho em Configurações › Reprodução, ou escolha uma cópia menor';
        // Dizer quanto já está ocupado muda a ação: com outro torrent no ar, o
        // que resolve é fechar aquele, não trocar esta cópia.
        const ocupado = jaEmUso > 0
          ? ` Outro(s) torrent(s) já ocupam ${(jaEmUso / 1024 ** 3).toFixed(1)} GB.`
          : '';
        return reject(new Error(
          `Tocar esta cópia pediria ${gb} GB de disco e o limite é ${teto} GB.` +
          `${ocupado} ${culpado}.`));
      }

      // Só o arquivo que vai tocar. Sem isto o motor baixa extras e amostras,
      // gastando disco e banda em coisa que ninguém vai ver.
      torrent.files.forEach((f) => (f === arquivo ? f.select() : f.deselect()));

      entrada.arquivo = arquivo;
      // O cache precisa saber qual arquivo é o filme para saber o que
      // reselecionar ao retomar.
      const cacheDoTorrent = _cacheDe(torrent);
      if (cacheDoTorrent) cacheDoTorrent.arquivoEmUso = arquivo;
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

  // O cache precisa saber onde a leitura está para não apagar o que vem a
  // seguir. `inicio` é byte no ARQUIVO; a peça é no TORRENT, então entra o
  // deslocamento do arquivo dentro dele.
  const cache = _cacheDe(entrada.torrent);
  if (cache) {
    cache.defineLeitura(Math.floor((arquivo.offset + inicio) / entrada.torrent.pieceLength));
  }

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
      const { magnet, cota } = JSON.parse(corpo || '{}');
      if (!magnet) return jsonDe(resposta, 400, { erro: 'magnet ausente' });

      // `cota: 0` do cliente quer dizer ilimitado.
      const entrada = await adiciona(
        magnet, cota === undefined ? COTA_DO_CACHE : (Number(cota) || Infinity));
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

/**
 * Não conseguir atender é fatal, e a guarda de exceção não pode encobrir isso.
 *
 * MEDIDO: com a porta 8001 ocupada, o `EADDRINUSE` caía no
 * `uncaughtException` lá de cima — que existe para um par malformado não
 * derrubar o processo — e o serviço seguia VIVO sem atender ninguém. A guarda
 * estava certa para o que foi feita e errada para isto: um erro de escuta não
 * é um par malformado, é o serviço inteiro não existindo.
 *
 * Em container a diferença fica maior: um processo vivo e mudo é "saudável"
 * para o Docker, que não reinicia nada. Sair com código de erro é o que faz a
 * `restart: unless-stopped` funcionar.
 */
servidor.on('error', (erro) => {
  console.error(`[lumiere-torrent] não consegui atender em ${INTERFACE}:${PORTA} — `
    + (erro?.code === 'EADDRINUSE'
      ? 'a porta já está ocupada. Outro motor rodando?'
      : String(erro?.message || erro)));
  process.exit(1);
});

servidor.listen(PORTA, INTERFACE, () => {
  // A partir daqui um par malformado não derruba mais nada — e até aqui,
  // qualquer tropeço derruba.
  noAr = true;
  console.log(`[lumiere-torrent] ouvindo em ${INTERFACE}:${PORTA}`);
  console.log(`[lumiere-torrent] pares pela ${PORTA_DE_PARES}, DHT pela ${PORTA_DA_DHT}`);
  console.log(`[lumiere-torrent] peças em ${PASTA}, teto de ` +
              `${(LIMITE_DE_BYTES / 1024 ** 3).toFixed(0)} GB por arquivo`);
  if (INTERFACE !== '127.0.0.1') {
    // Vale ser barulhento: este serviço não pede senha a ninguém, e quem
    // alcança a porta manda baixar o que quiser.
    console.warn(`[lumiere-torrent] ATENÇÃO: atendendo em ${INTERFACE}, e este `
      + 'serviço não autentica pedido nenhum. Só faça isso numa rede fechada '
      + '— a do Docker, por exemplo.');
  }
});

for (const sinal of ['SIGINT', 'SIGTERM']) {
  process.on(sinal, () => {
    console.log('[lumiere-torrent] encerrando e apagando as peças');
    for (const hash of [...emCurso.keys()]) remove(hash);
    cliente.destroy(() => process.exit(0));
  });
}
