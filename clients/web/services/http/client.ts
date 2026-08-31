import { APIError, APIErrorPayload } from './errors';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

type RequestOptions = RequestInit & {
  params?: Record<string, string | number | boolean | undefined>;
};

async function parseError(response: Response): Promise<never> {
  const contentType = response.headers.get('content-type') ?? '';

  if (!contentType.includes('application/json')) {
    // Se o Django retornar um erro não-JSON (como 502 Bad Gateway)
    throw new APIError({
      code: 'SERVER_ERROR',
      message: `Server error: HTTP ${response.status}`,
    });
  }

  let body: any;
  try {
    body = await response.json();
  } catch {
    throw new APIError({
      code: 'PARSE_ERROR',
      message: 'Server returned malformed JSON',
    });
  }

  // Joga o erro no formato exato que o seu backend Django cospe
  // O fallback (|| body) garante que erros nativos do Django DRF como {"detail": "..."} sejam lidos
  throw new APIError(body.error || body);
}

/**
 * Uma renovação por vez: várias queries paralelas tomando 401 juntas devem
 * compartilhar o mesmo refresh, e não disparar N rotações de token (o Django
 * usa ROTATE_REFRESH_TOKENS, então corridas invalidariam umas às outras).
 */
let isRefreshing: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  if (!isRefreshing) {
    isRefreshing = fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        isRefreshing = null;
      });
  }
  return isRefreshing;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { params, ...fetchOptions } = options;

  // Constrói a URL com query params se existirem
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) url.searchParams.set(k, String(v));
    });
  }

  const headers = new Headers(fetchOptions.headers);
  headers.set('Content-Type', 'application/json');

  const enviar = () =>
    fetch(url.toString(), {
      ...fetchOptions,
      headers,
      credentials: 'include', // o navegador envia o Cookie HttpOnly automaticamente
    });

  let response = await enviar();

  // Refresh silencioso: no 401, renova a sessão pela rota do Next (que guarda
  // o refresh_token HttpOnly) e repete a requisição uma única vez. Requisições
  // simultâneas aguardam a mesma renovação — refreshSession() faz a dedupe.
  if (response.status === 401) {
    const renovou = await refreshSession();
    if (renovou) response = await enviar();
  }

  if (!response.ok) return parseError(response);
  
  // Trata respostas de deleção ou ações vazias (204 No Content)
  if (response.status === 204) return undefined as unknown as T;

  return response.json() as Promise<T>;
}

export const http = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};