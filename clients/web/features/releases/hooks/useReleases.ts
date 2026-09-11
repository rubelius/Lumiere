'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { APIError } from '@/services/http/errors';
import { movieKeys } from '@/features/movies/hooks/useMovies';
import { http } from '@/services/http/client';
import type { components } from '@/types/api-generated';

export type Release = components['schemas']['TorrentRelease'];

export type EstadoBusca = 'ociosa' | 'enfileirada' | 'buscando' | 'concluida' | 'erro';

/**
 * O que está acontecendo com a busca de cópias de um filme.
 *
 * Todo documento traz TODAS as chaves, sempre, para a tela nunca precisar
 * checar se um campo existe. Os contadores nascem `null` de propósito: "ainda
 * não sei" não é zero, e `cache_check_failed` tem três respostas — null é
 * "ainda não perguntei", false é "perguntei e está tudo certo", true é "não
 * deu para perguntar".
 */
export interface EstadoDaBusca {
  movie_id: string;
  estado: EstadoBusca;
  iniciada_em: string | null;
  concluida_em: string | null;
  erro: string | null;
  new_releases_found: number | null;
  total_releases: number | null;
  cache_check_failed: boolean | null;
  consultas_falhas: string[];
}

/**
 * Chaves próprias, fora de `movieKeys`.
 *
 * `useImportarRelease` e outros invalidam `movieKeys.all`, e a consulta de
 * estado seria refetchada junto sem motivo nenhum.
 */
export const releaseKeys = {
  all: ['releases'] as const,
  busca: (id: string) => [...releaseKeys.all, 'busca', id] as const,
} as const;

const MS_ENTRE_PERGUNTAS = 2000;
const EM_ANDAMENTO: EstadoBusca[] = ['enfileirada', 'buscando'];

/**
 * Acompanha a busca de cópias deste filme.
 *
 * Monta junto com a ficha, e não só depois do clique: a busca pode ter sido
 * disparada em outra aba, ou antes de a página ser fechada e reaberta. Como o
 * estado mora no servidor, a retomada não custa uma linha de código.
 */
export function useEstadoDaBusca(movieId: string | undefined) {
  return useQuery({
    queryKey: releaseKeys.busca(movieId ?? ''),
    queryFn: () => http.get<EstadoDaBusca>(`/api/movies/${movieId}/search_status/`),
    enabled: Boolean(movieId),
    refetchInterval: (query) =>
      EM_ANDAMENTO.includes(query.state.data?.estado as EstadoBusca)
        ? MS_ENTRE_PERGUNTAS
        : false,
    // O padrão do projeto é `refetchOnWindowFocus: false` (lib/queryClient.ts).
    // Aqui a verdade mora no servidor e a aba pode ter ficado escondida durante
    // a busca inteira, então esta consulta pede o contrário, explicitamente.
    refetchOnWindowFocus: true,
  });
}

/**
 * Toca a campainha da busca. Quem trabalha é o worker.
 *
 * O endpoint prendia a requisição de 40 a 100 segundos, porque um dos
 * indexadores agrega os do Jackett. Agora responde na hora com o documento de
 * estado, que já é semeado no cache do React Query para o acompanhamento
 * começar sem esperar a primeira pergunta.
 */
export function useBuscarReleases(movieId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (opcoes: { min_seeders?: number; min_resolution?: string } = {}) =>
      http.post<EstadoDaBusca>(`/api/movies/${movieId}/search_torrents/`, opcoes),
    onSuccess: (doc) => {
      // Semear, e não invalidar a ficha: no instante do clique nada mudou
      // ainda. A ficha é invalidada pela CONCLUSÃO, na tela.
      if (movieId) queryClient.setQueryData(releaseKeys.busca(movieId), doc);
    },
  });
}

export interface ResultadoDaImportacao {
  message: string;
  torrent_id: string;
  realdebrid_status: string;
  disponibilidade: Disponibilidade;
}

/**
 * Manda a cópia para a conta do Real-Debrid.
 *
 * Para o que já está no acervo do RD isso leva segundos; para o resto, o
 * Real-Debrid passa a baixar e a cópia fica em `baixando` até terminar.
 */
export function useImportarRelease() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (releaseId: string) =>
      http.post<ResultadoDaImportacao>(`/api/releases/${releaseId}/add_to_realdebrid/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: movieKeys.all }),
  });
}

export type Disponibilidade = components['schemas']['DisponibilidadeEnum'];

interface Rotulo {
  texto: string;
  detalhe: string;
  cor: 'pronta' | 'espera' | 'ausente';
  podeImportar: boolean;
  /** Dá para apertar e assistir esta cópia agora. */
  podeTocar: boolean;
}

const ROTULOS: Record<Disponibilidade, Rotulo> = {
  pronta: {
    texto: 'TOCA AGORA',
    detalhe: 'Está na sua conta do Real-Debrid, com link pronto.',
    cor: 'pronta',
    podeImportar: false,
    podeTocar: true,
  },
  instantanea: {
    texto: 'DISPONIBILIDADE IMEDIATA',
    detalhe: 'O Real-Debrid já tem este arquivo no acervo — importar leva segundos.',
    cor: 'pronta',
    podeImportar: false,
    podeTocar: true,
  },
  baixando: {
    texto: 'BAIXANDO',
    detalhe: 'Já foi enviada. O Real-Debrid ainda está buscando.',
    cor: 'espera',
    podeImportar: false,
    podeTocar: false,
  },
  ausente: {
    texto: 'PRECISA BAIXAR',
    detalhe: 'O Real-Debrid não tem este arquivo no acervo: importar significa '
      + 'esperar ele baixar, o que pode levar horas ou nem completar.',
    cor: 'ausente',
    podeImportar: true,
    podeTocar: false,
  },
};

/** As três leituras possíveis, em cor: já é seu, está a caminho, ou nem isso. */
export const CORES_DA_COPIA: Record<Rotulo['cor'], { texto: string; borda: string }> = {
  pronta: { texto: 'var(--gold)', borda: 'rgba(191,143,60,0.45)' },
  espera: { texto: 'var(--m2)', borda: 'rgba(134,131,125,0.45)' },
  ausente: { texto: 'var(--m3)', borda: 'rgba(86,84,80,0.4)' },
};

export type Compatibilidade = 'toca' | 'nao_toca' | 'talvez';

interface RotuloDeCompatibilidade {
  texto: string;
  detalhe: string;
  cor: 'pronta' | 'espera' | 'ausente';
}

const COMPATIBILIDADE: Record<Compatibilidade, RotuloDeCompatibilidade> = {
  toca: {
    texto: 'NAVEGADOR',
    detalhe: 'Vídeo e áudio que o navegador decodifica. Toca aqui mesmo, sem conversão.',
    cor: 'pronta',
  },
  talvez: {
    texto: 'TALVEZ',
    detalhe: 'O nome não diz o áudio. Pode tocar, pode vir sem som — só tentando para saber.',
    cor: 'espera',
  },
  nao_toca: {
    texto: 'SEM SOM',
    detalhe: 'Faixa DTS, TrueHD ou Dolby Digital, que o navegador não decodifica: '
      + 'a imagem anda e não sai áudio. Precisa de conversão ou de um player externo.',
    cor: 'ausente',
  },
};

/**
 * Como anunciar que uma cópia toca no navegador.
 *
 * A nota e o player querem coisas opostas: a nota premia REMUX e faixa sem
 * perdas, e é isso que o `<video>` recusa. Sem este selo, a cópia de maior
 * nota parece a melhor escolha e entrega imagem muda.
 */
export function rotuloDeCompatibilidade(
  r: Partial<Pick<Release, 'compatibilidade'>>,
): RotuloDeCompatibilidade {
  return COMPATIBILIDADE[(r.compatibilidade as Compatibilidade) ?? 'talvez']
    ?? COMPATIBILIDADE.talvez;
}

/**
 * A conta do score, em texto, para o título do número na tabela.
 *
 * Um REMUX 2160p somando 57 parece defeito e quase nunca é: 30 de vídeo já é o
 * teto, e o que falta costuma estar no áudio sem Atmos, na ausência de Dolby
 * Vision e num torrent sem semeadores. Sem a conta à vista, a única leitura
 * possível é desconfiar do número.
 */
export function explicaOScore(r: Pick<Release, 'quality_score' | 'motivos_do_score'>): string {
  const motivos = r.motivos_do_score ?? [];
  if (motivos.length === 0) {
    return `Nota ${r.quality_score ?? 0} de 100.`;
  }
  const linhas = motivos.map((m) => {
    const item = m as { rotulo?: string; pontos?: number; teto?: number; motivo?: string };
    return `${item.rotulo}: ${item.pontos}/${item.teto} — ${item.motivo}`;
  });
  return [`Nota ${r.quality_score ?? 0} de 100`, ...linhas].join('\n');
}

/**
 * Como anunciar o estado de uma cópia.
 *
 * Quatro estados, e a diferença entre eles é a que decide a escolha:
 *
 *   TOCA AGORA    já está na conta, com link. Aperta play.
 *   DISPONIBILIDADE IMEDIATA  o acervo do Real-Debrid tem o arquivo; importar
 *                             leva ~2 segundos, e o botão já leva ao player.
 *   BAIXANDO      já foi enviada, e o Real-Debrid ainda está buscando.
 *   IMPORTAR      nem uma coisa nem outra. Pode demorar, ou nem completar.
 *
 * A disponibilidade imediata chegou a ser removida: vinha de instantAvailability, que o
 * provedor desativou. Voltou com outra fonte — uma sondagem que adiciona o
 * magnet, observa se o Real-Debrid entrega os metadados na hora, e desfaz o
 * que criou.
 */
// Partial e não Pick: uma resposta guardada em cache de antes destes campos
// existirem chega sem eles, e o tipo gerado os dá como sempre presentes.
export function rotuloDaCopia(
  r: Partial<Pick<Release, 'disponibilidade' | 'pode_importar'>>,
): Rotulo {
  const rotulo = ROTULOS[r.disponibilidade ?? 'ausente'] ?? ROTULOS.ausente;
  // O estado diz que faria sentido importar; o backend diz se há como. Cópia
  // vinda da sincronização com o Real-Debrid não tem magnet, e o botão só
  // saberia dar erro.
  if (r.pode_importar === false) return { ...rotulo, podeImportar: false };
  return rotulo;
}

/**
 * Confere na conta do Real-Debrid o que já está lá, ao abrir a ficha.
 *
 * Substitui a checagem de cache que o provedor desativou. A varredura da conta
 * fica guardada alguns minutos no servidor, então abrir o segundo filme não
 * custa nada.
 */
export function useEstadoNoRealDebrid(movieId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      http.post<{ consulta_falhou: boolean; releases: Release[] }>(
        `/api/movies/${movieId}/realdebrid_state/`),
    onSuccess: () => {
      if (movieId) {
        queryClient.invalidateQueries({ queryKey: movieKeys.detail(movieId) });
      }
    },
  });
}

// A partir daqui, "enfileirada" sem ninguém ter pegado vira notícia: é o
// sintoma de um worker fora do ar, e a tela consegue dizer isso com segurança.
const SEGUNDOS_ATE_DESCONFIAR = 15;

// Um dos indexadores agrega os do Jackett e leva até 100s. Depois deste tempo
// a espera deixa de ser surpresa e passa a merecer explicação.
const SEGUNDOS_ATE_EXPLICAR = 45;

/**
 * Um relógio que anda enquanto `ativo`, para o contador da busca avançar.
 *
 * O refetch de 2 em 2 segundos NÃO basta: o React Query não re-renderiza
 * quando o documento volta estruturalmente igual, e durante `buscando` ele
 * volta igual toda vez — `iniciada_em` e `estado` não mudam. Sem este tique o
 * botão dizia "VASCULHANDO... 2s" do começo ao fim, o que é o mesmo tipo de
 * mentira que o botão travado era.
 */
export function useRelogio(ativo: boolean): Date {
  const [agora, setAgora] = useState(() => new Date());

  useEffect(() => {
    if (!ativo) return;
    const id = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(id);
  }, [ativo]);

  return agora;
}

export interface PainelDaBusca {
  rotuloDoBotao: string;
  ocupado: boolean;
  aviso: string;
  erro: string;
}

function segundosDesde(iso: string | null, agora: Date): number {
  if (!iso) return 0;
  const inicio = new Date(iso).getTime();
  if (Number.isNaN(inicio)) return 0;
  return Math.max(0, Math.floor((agora.getTime() - inicio) / 1000));
}

/**
 * O que o cabeçalho da aba de cópias diz, em cada estado da busca.
 *
 * Pura de propósito, como `rotuloDaCopia` e `motivoDaFalha`: é aqui que mora a
 * diferença entre "os indexadores responderam e não havia nada" e "a busca
 * quebrou", que o antigo 200-contra-502 carregava e que não pode se perder.
 */
export function mensagemDaBusca(
  doc: EstadoDaBusca | undefined,
  agora: Date,
): PainelDaBusca {
  const painel: PainelDaBusca = {
    // "ATUALIZAR" e não "PROCURAR": as cópias já estão no banco quando a
    // ficha abre — o rastreador as trouxe antes. O botão deixou de ser a
    // forma de consegui-las e passou a ser a forma de pedir o que existe
    // agora, que é outra coisa.
    rotuloDoBotao: '[ ATUALIZAR CÓPIAS ]',
    ocupado: false,
    aviso: '',
    erro: '',
  };

  if (!doc || doc.estado === 'ociosa') return painel;

  // A ressalva vale em qualquer desfecho: parte das consultas pode ter caído
  // sem derrubar a busca, e aí o que está na tela não é tudo que existe.
  if (doc.consultas_falhas.length > 0) {
    painel.aviso = 'UMA DAS CONSULTAS AO PROWLARR FALHOU — O QUE ESTÁ ABAIXO PODE NÃO SER TUDO.';
  }

  if (doc.estado === 'enfileirada') {
    painel.rotuloDoBotao = '[ NA FILA... ]';
    painel.ocupado = true;
    if (segundosDesde(doc.iniciada_em, agora) >= SEGUNDOS_ATE_DESCONFIAR) {
      painel.aviso = 'A BUSCA FOI ACEITA MAS NINGUÉM A PEGOU — O WORKER PODE ESTAR FORA DO AR.';
    }
    return painel;
  }

  if (doc.estado === 'buscando') {
    const s = segundosDesde(doc.iniciada_em, agora);
    painel.rotuloDoBotao = `[ VASCULHANDO... ${s}s ]`;
    painel.ocupado = true;
    if (s >= SEGUNDOS_ATE_EXPLICAR) {
      painel.aviso = 'UM DOS INDEXADORES AGREGA OUTROS E COSTUMA LEVAR ATÉ 100s.';
    }
    return painel;
  }

  if (doc.estado === 'erro') {
    // A frase do servidor, inteira: é a mesma que o 502 carregava.
    painel.erro = (doc.erro || 'A BUSCA FALHOU.').toUpperCase();
    return painel;
  }

  // concluida
  const novas = doc.new_releases_found ?? 0;
  painel.aviso = painel.aviso || (novas > 0
    ? `${novas} CÓPIA${novas > 1 ? 'S' : ''} NOVA${novas > 1 ? 'S' : ''}.`
    : 'NENHUMA CÓPIA NOVA — OS INDEXADORES RESPONDERAM E NÃO HAVIA NADA ALÉM DO QUE JÁ ESTÁ AQUI.');
  return painel;
}

/**
 * Rótulo técnico de uma cópia, montado dos campos que a API devolve.
 *
 * A tabela lia `release.res`, `release.type`, `release.audio` e
 * `release.group` — nenhum deles existe na resposta. Toda linha mostrava
 * "N/A", e um `any` no map impedia o TypeScript de acusar.
 */
export function especificacaoDaCopia(r: Release): string[] {
  const partes: string[] = [];
  if (r.is_remux) partes.push('REMUX');
  if (r.resolution) partes.push(r.resolution);
  if (r.has_dolby_vision) partes.push('DV');
  else if (r.has_hdr) partes.push('HDR');
  if (r.video_codec) partes.push(r.video_codec);
  if (r.has_atmos) partes.push('ATMOS');
  else if (r.has_dtsx) partes.push('DTS-X');
  else if (r.audio_codec) partes.push(r.audio_codec);
  return partes;
}

/** "75.2 GB" a partir do tamanho em bytes; o serializer já expõe size_gb. */
export function tamanhoLegivel(r: Release): string {
  const gb = r.size_gb ?? (r.size_bytes ? r.size_bytes / 1024 ** 3 : 0);
  if (!gb) return '—';
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(gb * 1024).toFixed(0)} MB`;
}

/**
 * O que dizer quando a busca falha.
 *
 * O backend distingue os motivos — "o Prowlarr não está configurado" (400),
 * "o Prowlarr devolveu algo que não é JSON" (502) — e repetir o motivo é o que
 * separa um problema acionável de um encolher de ombros. Antes, qualquer falha
 * virava silêncio e a tela parecia dizer que não havia cópia nenhuma.
 */
export function motivoDaFalha(
  erro: unknown,
  padrao = 'Não foi possível procurar cópias agora.',
): string {
  const motivo = erro instanceof APIError ? erro.message : '';
  return (motivo || padrao).toUpperCase();
}


// ── o estado do motor ─────────────────────────────────────────────────────

export interface EstadoDoMotor {
  workers: number;
  beat: boolean;
  ultimo_pulso: string | null;
  busca_funciona: boolean;
  rastreio_funciona: boolean;
}

/**
 * Se o motor está de pé para prometer uma busca.
 *
 * Pergunta de um em um minuto, e não mais: o servidor guarda a resposta por
 * meio minuto de qualquer jeito, e o que muda aqui muda em escala de minutos —
 * um worker que cai não volta em dez segundos.
 */
export function useEstadoDoMotor() {
  return useQuery({
    queryKey: ['motor'],
    queryFn: () => http.get<EstadoDoMotor>('/api/motor/'),
    refetchInterval: 60_000,
    // Silencioso: um motor fora do ar já é a notícia ruim do dia, e um erro
    // vermelho sobre a consulta ao estado dele não ajuda ninguém.
    retry: false,
  });
}

/**
 * O que dizer quando o motor não está inteiro.
 *
 * String vazia quando está tudo de pé — a tela não anuncia normalidade.
 *
 * Existe porque o silêncio já custou caro: uma busca ficou dez minutos "na
 * fila" sem worker para pegá-la, e o único lugar onde isso aparecia era o log
 * do servidor. Pior, o aviso que existia só surgia 15 segundos DEPOIS de
 * clicar, e sumia junto com o estado da busca cinco minutos mais tarde.
 */
export function avisoDoMotor(motor: EstadoDoMotor | undefined): string {
  if (!motor) return '';

  if (!motor.busca_funciona) {
    return 'O MOTOR DE BUSCA ESTÁ FORA DO AR — NENHUM WORKER RESPONDE. '
      + 'ATUALIZAR CÓPIAS NÃO VAI ADIANTAR ATÉ ELE VOLTAR.';
  }

  if (!motor.rastreio_funciona) {
    return 'O AGENDADOR ESTÁ FORA DO AR. BUSCAR CÓPIAS AINDA FUNCIONA, '
      + 'MAS A PRÉ-CARGA AUTOMÁTICA PAROU.';
  }

  return '';
}
