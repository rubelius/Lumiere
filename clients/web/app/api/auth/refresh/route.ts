import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { clearAuthCookies, setAuthCookies } from '@/lib/auth-cookies';

const DJANGO_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Renova a sessão a partir do refresh_token HttpOnly.
 *
 * O refresh nunca passa pelo navegador: ele sai do cookie aqui no servidor e
 * vai direto para o Django. Como o backend usa ROTATE_REFRESH_TOKENS com
 * BLACKLIST_AFTER_ROTATION, a resposta traz um refresh novo e invalida o
 * anterior — por isso é obrigatório regravar os dois cookies.
 */
export async function POST() {
  const refresh = (await cookies()).get('refresh_token')?.value;

  if (!refresh) {
    return NextResponse.json({ error: 'Sessão ausente.' }, { status: 401 });
  }

  try {
    const djangoResponse = await fetch(`${DJANGO_API_URL}/api/auth/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    });

    const contentType = djangoResponse.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Erro de comunicação com o servidor central.' }, { status: 502 });
    }

    const data = await djangoResponse.json();

    if (!djangoResponse.ok) {
      // Refresh expirado ou na blacklist: a sessão acabou de verdade.
      const response = NextResponse.json(data, { status: djangoResponse.status });
      clearAuthCookies(response);
      return response;
    }

    const response = NextResponse.json({ success: true });
    setAuthCookies(response, data.access, data.refresh);
    return response;
  } catch (error) {
    console.error('Erro ao renovar sessão:', error);
    return NextResponse.json({ error: 'Falha interna na comunicação.' }, { status: 500 });
  }
}
