export interface APIErrorPayload {
  code: string;
  message: string;
  fields?: Record<string, string[]>;
}

/**
 * A API fala duas línguas. O `custom_exception_handler` do Django devolve o
 * formato canônico `{error: {code, message, fields}}`, mas dezenas de views
 * respondem `Response({'error': 'texto solto'})` sem passar por ele — e o DRF
 * ainda pode cuspir `{campo: ["msg"]}` cru. Traduzir tudo aqui é o que impede
 * a tela de trocar um motivo real ("Prowlarr não está configurado") por um
 * encolher de ombros genérico.
 */
export function normalizaErro(corpo: unknown, status: number): APIErrorPayload {
  const codigo = codigoDoStatus(status);
  const corpoObj = ehObjeto(corpo) ? corpo : {};
  const bruto = corpoObj.error;

  if (ehObjeto(bruto)) {
    const mensagem = texto(bruto.message) || texto(bruto.detail);
    if (mensagem) {
      return {
        code: texto(bruto.code) || codigo,
        message: mensagem,
        fields: campos(bruto.fields) ?? undefined,
      };
    }
  }

  const solto = texto(bruto) || texto(corpoObj.detail) || texto(corpo);
  if (solto) return { code: codigo, message: solto };

  // DRF cru: {"username": ["Este campo é obrigatório."]}
  const dosCampos = campos(corpo);
  if (dosCampos) {
    const primeira = Object.values(dosCampos).find((v) => v.length > 0)?.[0];
    return {
      code: 'VALIDATION_ERROR',
      message: primeira ?? 'Dados inválidos.',
      fields: dosCampos,
    };
  }

  return { code: codigo, message: `HTTP ${status}` };
}

function codigoDoStatus(status: number): string {
  switch (status) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'AUTHENTICATION_FAILED';
    case 403:
      return 'PERMISSION_DENIED';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 429:
      return 'THROTTLED';
    default:
      return status >= 500 ? 'SERVER_ERROR' : 'REQUEST_FAILED';
  }
}

function ehObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function texto(v: unknown): string {
  return typeof v === 'string' && v.trim() ? v.trim() : '';
}

function campos(v: unknown): Record<string, string[]> | null {
  if (!ehObjeto(v)) return null;
  const saida: Record<string, string[]> = {};
  for (const [chave, valor] of Object.entries(v)) {
    if (Array.isArray(valor) && valor.every((x) => typeof x === 'string')) {
      saida[chave] = valor as string[];
    } else if (typeof valor === 'string') {
      saida[chave] = [valor];
    }
  }
  return Object.keys(saida).length > 0 ? saida : null;
}

export class APIError extends Error {
  code: string;
  status: number;
  fields?: Record<string, string[]>;

  constructor(payload: APIErrorPayload, status = 0) {
    super(payload.message);
    this.name = 'APIError';
    this.code = payload.code;
    this.status = status;
    this.fields = payload.fields;
  }

  isValidation(): boolean {
    return this.code === 'VALIDATION_ERROR';
  }

  isAuth(): boolean {
    return this.code === 'AUTHENTICATION_FAILED';
  }

  fieldError(field: string): string | undefined {
    return this.fields?.[field]?.[0];
  }
}
