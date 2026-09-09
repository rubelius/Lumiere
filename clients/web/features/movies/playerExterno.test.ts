import { describe, expect, it } from 'vitest';

import { PLAYERS, urlDaLegenda } from './playerExterno';

const STREAM = 'https://sao1-4.download.real-debrid.com/d/ABC/2001.mkv';

describe('players externos', () => {
  it('todo player monta um endereço com o fluxo dentro', () => {
    for (const p of PLAYERS) {
      const e = p.endereco(STREAM);
      expect(e.length).toBeGreaterThan(10);
      expect(decodeURIComponent(e)).toContain('real-debrid.com');
    }
  });

  // O motivo de o botão existir: o REMUX que o navegador cala toca no VLC.
  it('o VLC recebe o endereço sem o esquema http', () => {
    const vlc = PLAYERS.find((p) => p.nome === 'VLC')!;
    expect(vlc.endereco(STREAM)).toBe(
      'vlc://sao1-4.download.real-debrid.com/d/ABC/2001.mkv');
  });

  it('só o Infuse carrega a legenda pelo próprio esquema', () => {
    const comLegenda = PLAYERS.filter((p) => p.levaLegenda).map((p) => p.nome);
    expect(comLegenda).toEqual(['Infuse']);
  });

  it('o Infuse recebe a legenda quando ela existe, e passa sem ela', () => {
    const infuse = PLAYERS.find((p) => p.nome === 'Infuse')!;
    const legenda = 'http://localhost:3000/api/subtitles/42/vtt';

    expect(infuse.endereco(STREAM, legenda)).toContain(encodeURIComponent(legenda));
    expect(infuse.endereco(STREAM)).not.toContain('sub=');
  });

  it('a URL da legenda é absoluta', () => {
    // Um aplicativo de fora não tem origem: caminho relativo não resolve.
    expect(urlDaLegenda(42)).toMatch(/^https?:\/\/.+\/api\/subtitles\/42\/vtt$/);
  });

  it('caracteres especiais no endereço não quebram o esquema', () => {
    const comEspaco = 'https://cdn/d/ABC/2001 A Space Odyssey.mkv';
    const infuse = PLAYERS.find((p) => p.nome === 'Infuse')!;

    expect(infuse.endereco(comEspaco)).not.toContain(' ');
  });
});
