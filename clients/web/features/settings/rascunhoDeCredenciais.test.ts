import { describe, expect, it } from 'vitest';

import { limpaORascunho, temOQueGravar } from './rascunhoDeCredenciais';

// O campo dizia "CHAVE GRAVADA — deixe vazio para manter", e a regra só valia
// para um campo em que ninguém tocou: o `onChange` escrevia no rascunho a cada
// tecla, string vazia inclusive. Digitar e apagar — o gesto mais banal num
// campo de senha — mandava `{ jellyfin_token: '' }` e o backend APAGAVA a
// credencial. A tela prometia preservar e destruía.

describe('limpaORascunho', () => {
  it('segredo vazio não é enviado: vazio quer dizer "mantenha"', () => {
    expect(limpaORascunho({ jellyfin_token: '' })).toEqual({});
    expect(limpaORascunho({ realdebrid_api_key: '' })).toEqual({});
  });

  it('segredo preenchido é enviado', () => {
    expect(limpaORascunho({ plex_token: 'abc' })).toEqual({ plex_token: 'abc' });
  });

  it('URL vazia É enviada: apagar o endereço é pedido legítimo', () => {
    // Engolir isto criaria o defeito oposto — um campo que não dá para limpar.
    expect(limpaORascunho({ jellyfin_server_url: '' }))
      .toEqual({ jellyfin_server_url: '' });
  });

  it('não descarta o resto ao descartar um segredo vazio', () => {
    expect(limpaORascunho({ jellyfin_token: '', jellyfin_server_url: 'http://x' }))
      .toEqual({ jellyfin_server_url: 'http://x' });
  });
});

describe('temOQueGravar', () => {
  it('só um segredo apagado não acende o botão', () => {
    // Era isto que habilitava [ GRAVAR ] para uma gravação destrutiva.
    expect(temOQueGravar({ jellyfin_token: '' })).toBe(false);
  });

  it('rascunho vazio também não', () => {
    expect(temOQueGravar({})).toBe(false);
  });

  it('qualquer mudança de verdade acende', () => {
    expect(temOQueGravar({ jellyfin_token: 'x' })).toBe(true);
    expect(temOQueGravar({ jellyfin_server_url: '' })).toBe(true);
  });
});
