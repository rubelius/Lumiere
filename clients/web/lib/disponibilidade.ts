/**
 * Como um filme do acervo é rotulado quanto a poder ser visto agora.
 *
 * A cadeia de reprodução do Lumière é Real-Debrid, depois Jellyfin, depois
 * Plex. A interface, porém, decidia disponibilidade olhando só `in_plex` — e
 * o Plex é justamente o degrau adiado. Resultado: os filmes que realmente
 * tocavam, via Real-Debrid, apareciam como OFFLINE no acervo inteiro.
 *
 * A regra vive aqui porque estava repetida em quatro telas, e foi por estar
 * repetida que envelheceu em todas ao mesmo tempo.
 */

export interface DisponibilidadeDoFilme {
  in_plex?: boolean;
  available_instantly?: boolean;
  /** O Real-Debrid tem o arquivo, mas ele ainda não foi importado. */
  cached_in_realdebrid?: boolean;
  best_quality_available?: string | null;
}

/**
 * Etiquetas da esquina do card, da mais informativa para a menos.
 *
 * `best_quality_available` só aparece quando o filme toca: anunciar "REMUX
 * 2160p" num filme que não se pode ver é propaganda, não informação.
 *
 * O estado do meio existe porque "cacheado no Real-Debrid" não é nem tocar
 * agora nem ficar sem — é um clique de distância. Somado a OFFLINE, escondia
 * justamente as cópias mais fáceis de conseguir.
 */
export function etiquetasDeDisponibilidade(filme: DisponibilidadeDoFilme): string[] {
  if (filme.available_instantly) {
    const qualidade = filme.best_quality_available?.trim();
    return qualidade ? ['DISPONÍVEL', qualidade] : ['DISPONÍVEL'];
  }

  if (filme.cached_in_realdebrid) return ['UM CLIQUE'];

  if (filme.in_plex) return ['PLEX'];

  return ['OFFLINE'];
}

/**
 * Se o filme pode ser reproduzido por qualquer degrau da cadeia.
 *
 * Cacheado no Real-Debrid não conta: sem importar para a conta não existe
 * link, e o play falharia.
 */
export function podeReproduzir(filme: DisponibilidadeDoFilme): boolean {
  return Boolean(filme.available_instantly || filme.in_plex);
}
