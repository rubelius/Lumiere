import { describe, expect, it } from 'vitest';
import { APIError, normalizaErro } from './errors';

describe('normalizaErro', () => {
  it('lê o formato canônico do custom_exception_handler', () => {
    const e = normalizaErro(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid input.', fields: { username: ['obrigatório'] } } },
      400,
    );
    expect(e).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Invalid input.',
      fields: { username: ['obrigatório'] },
    });
  });

  // O defeito que motivou o normalizador: 27 views respondem `{'error': 'texto'}`
  // sem passar pelo handler, e a mensagem sumia inteira no cliente.
  it('preserva a mensagem quando o backend manda erro como texto solto', () => {
    const e = normalizaErro({ error: 'Prowlarr not configured.' }, 400);
    expect(e.message).toBe('Prowlarr not configured.');
    expect(e.code).toBe('BAD_REQUEST');
  });

  it('lê o `detail` que o DRF usa em permissões e 404', () => {
    expect(normalizaErro({ detail: 'Não encontrado.' }, 404)).toEqual({
      code: 'NOT_FOUND',
      message: 'Não encontrado.',
    });
  });

  it('transforma erros de campo crus do DRF em validação', () => {
    const e = normalizaErro({ password: ['Senha curta demais.'] }, 400);
    expect(e.code).toBe('VALIDATION_ERROR');
    expect(e.message).toBe('Senha curta demais.');
    expect(e.fields).toEqual({ password: ['Senha curta demais.'] });
  });

  it('não inventa validação onde só há um texto de 400', () => {
    expect(normalizaErro({ error: 'movie_id is required' }, 400).code).not.toBe('VALIDATION_ERROR');
  });

  it('nunca devolve mensagem vazia, mesmo com corpo inútil', () => {
    for (const corpo of [null, {}, [], 42, { error: {} }, { error: null }]) {
      expect(normalizaErro(corpo, 503).message.trim()).not.toBe('');
    }
  });

  it('classifica 401 como falha de autenticação para o refresh silencioso', () => {
    expect(new APIError(normalizaErro({ error: 'Token expirado' }, 401), 401).isAuth()).toBe(true);
  });
});

describe('APIError', () => {
  it('carrega o status HTTP para quem precisa distinguir o motivo', () => {
    const e = new APIError(normalizaErro({ error: 'Indexador fora do ar' }, 502), 502);
    expect(e.status).toBe(502);
    expect(e.message).toBe('Indexador fora do ar');
  });

  it('expõe o erro do campo pedido', () => {
    const e = new APIError(normalizaErro({ username: ['Já existe.'] }, 400), 400);
    expect(e.fieldError('username')).toBe('Já existe.');
    expect(e.fieldError('email')).toBeUndefined();
  });
});
