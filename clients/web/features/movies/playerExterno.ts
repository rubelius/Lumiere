/**
 * Abrir o filme num player externo.
 *
 * Existe porque o `<video>` do navegador não decodifica DTS, TrueHD nem Dolby
 * Digital — medido com `canPlayType` — e são justamente essas as faixas das
 * cópias de maior nota. Um REMUX 2160p toca no VLC e cala no Chrome.
 *
 * Os esquemas abaixo são os que os players registram no sistema operacional.
 * Nenhum confirma nada de volta: o navegador dispara o esquema e não fica
 * sabendo se algum aplicativo atendeu. Por isso a tela oferece também o link
 * cru, para copiar — é a saída que funciona mesmo sem player instalado.
 */

export interface PlayerExterno {
  nome: string;
  /** Monta o endereço que o sistema entrega ao aplicativo. */
  endereco: (streamUrl: string, legendaUrl?: string) => string;
  /** Se o esquema aceita a legenda junto, ou se ela precisa ir à parte. */
  levaLegenda: boolean;
}

export const PLAYERS: PlayerExterno[] = [
  {
    nome: 'VLC',
    // O esquema do VLC aceita apenas o fluxo. A legenda entra por arquivo, e é
    // por isso que a tela oferece o download dela ao lado.
    endereco: (url) => `vlc://${url.replace(/^https?:\/\//, '')}`,
    levaLegenda: false,
  },
  {
    nome: 'IINA',
    endereco: (url) => `iina://weblink?url=${encodeURIComponent(url)}`,
    levaLegenda: false,
  },
  {
    nome: 'Infuse',
    // O único dos três que carrega a legenda pelo próprio esquema.
    endereco: (url, legenda) => {
      const base = `infuse://x-callback-url/play?url=${encodeURIComponent(url)}`;
      return legenda ? `${base}&sub=${encodeURIComponent(legenda)}` : base;
    },
    levaLegenda: true,
  },
];

/**
 * O endereço absoluto da legenda, que um aplicativo de fora consegue buscar.
 *
 * A `<track>` do player usa caminho relativo porque é servida pela mesma
 * origem. Um player externo não tem origem nenhuma: precisa do endereço
 * completo, ou não acha o arquivo.
 */
export function urlDaLegenda(fileId: number | string): string {
  const base = typeof window === 'undefined' ? '' : window.location.origin;
  return `${base}/api/subtitles/${fileId}/vtt`;
}
