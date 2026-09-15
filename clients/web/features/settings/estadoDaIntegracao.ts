/**
 * O que a tela pode AFIRMAR sobre uma integração.
 *
 * O defeito: a linha do Jellyfin (e a do Plex) mostrava ✓ [CONECTADO] em
 * dourado porque `jellyfin_connected` era `bool(url && token)` no backend — um
 * predicado que responde "os dois campos têm texto" e estava respondendo "o
 * servidor respondeu". URL com um dígito errado, token vencido, servidor
 * desligado: tudo aparecia como conectado.
 *
 * São três estados, e não dois. "Gravado" não é um meio-termo simpático: é o
 * que de fato se sabe quando ninguém perguntou ao servidor.
 */

export const NAO_CONFIGURADO = 'nao_configurado';
export const GRAVADO = 'gravado';
export const RESPONDEU = 'respondeu';

export interface SeloDaIntegracao {
  texto: string;
  /** Só o dourado com ✓ afirma que funciona. Os outros são cinza. */
  confirmado: boolean;
}

/**
 * O selo da linha.
 *
 * `verificadoEm` entra para a frase poder dizer QUANDO — "respondeu às 09:12"
 * envelhece na frente de quem lê, e "[CONECTADO]" não envelhecia nunca.
 */
export function seloDaIntegracao(
  estado: string | null | undefined,
  verificadoEm?: string | null,
): SeloDaIntegracao {
  if (estado === RESPONDEU) {
    const quando = verificadoEm ? horaDe(verificadoEm) : '';
    return { texto: quando ? `RESPONDEU ÀS ${quando}` : 'RESPONDEU', confirmado: true };
  }
  if (estado === GRAVADO) {
    // A frase precisa dizer o que falta, senão "gravado" se lê como falha.
    return { texto: 'CHAVE GRAVADA · SEM RESPOSTA', confirmado: false };
  }
  return { texto: 'NÃO CONFIGURADO', confirmado: false };
}

function horaDe(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Para as integrações que não têm servidor a que perguntar.
 *
 * Real-Debrid e OpenSubtitles são serviços na nuvem e o Lumière os exercita a
 * cada busca — não há "servidor de casa desligado" a distinguir. Aqui o
 * booleano continua sendo a resposta certa, e forçá-los nos três estados seria
 * inventar uma dúvida que não existe.
 */
export function seloPorBooleano(conectado: boolean): SeloDaIntegracao {
  return { texto: conectado ? 'CONECTADO' : 'NÃO CONFIGURADO', confirmado: conectado };
}
