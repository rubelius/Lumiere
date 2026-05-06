import { APIError, APIErrorPayload } from './errors';
import { useAuthStore } from '@/features/auth/store/authStore';

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

  let body: { error: APIErrorPayload };
  try {
    body = await response.json();
  } catch {
    throw new APIError({
      code: 'PARSE_ERROR',
      message: 'Server returned malformed JSON',
    });
  }

  // Joga o erro no formato exato que o seu backend Django cospe
  throw new APIError(body.error);
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
  
  const token = useAuthStore.getState().accessToken;
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  headers.set('Content-Type', 'application/json');

  const response = await fetch(url.toString(), {
    ...fetchOptions,
    headers,
  });

  // TODO: Lógica de refresh token silencioso no caso de status 401

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