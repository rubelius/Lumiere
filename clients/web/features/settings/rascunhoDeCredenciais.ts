/**
 * O que de fato vai ser gravado, a partir do que foi digitado.
 *
 * O DEFEITO: o campo de token diz "CHAVE GRAVADA — deixe vazio para manter",
 * e a regra só valia para um campo em que ninguém tocou. O `onChange` escreve
 * no rascunho a CADA TECLA, string vazia inclusive — então digitar algo e
 * apagar, ou selecionar tudo e deletar, deixava `{ jellyfin_token: '' }` no
 * rascunho, o botão [ GRAVAR ] habilitava, e o backend apagava a credencial.
 *
 * A tela prometia preservar e destruía, com o gesto mais banal que existe num
 * campo de senha.
 */

/** Os campos em que vazio quer dizer "mantenha o que está lá". */
export const CAMPOS_DE_SEGREDO = [
  'jellyfin_token', 'plex_token', 'realdebrid_api_key', 'opensubtitles_api_key',
];

export function limpaORascunho(
  rascunho: Record<string, unknown>,
): Record<string, unknown> {
  const limpo: Record<string, unknown> = {};
  for (const [campo, valor] of Object.entries(rascunho)) {
    // Só os SEGREDOS têm a regra do "vazio mantém". Uma URL apagada é um
    // pedido legítimo de desconectar aquele servidor, e engolir isso seria
    // criar o defeito oposto: um campo que não dá para limpar.
    if (CAMPOS_DE_SEGREDO.includes(campo) && valor === '') continue;
    limpo[campo] = valor;
  }
  return limpo;
}

/** Se há algo de verdade para gravar — o que decide se o botão acende. */
export function temOQueGravar(rascunho: Record<string, unknown>): boolean {
  return Object.keys(limpaORascunho(rascunho)).length > 0;
}
