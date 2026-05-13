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

  const response = await fetch(url.toString(), {
    ...fetchOptions,
    headers,
    credentials: 'include', // <-- A MÁGICA ACONTECE AQUI. O navegador envia o Cookie HttpOnly automaticamente.
  });

  // TODO: Lógica de refresh token silencioso no caso de status 401
  // Será implementada posteriormente usando a rota /api/auth/refresh do Next.js

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