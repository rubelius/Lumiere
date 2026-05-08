import { NextResponse } from 'next/server';

const DJANGO_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 1. CORREÇÃO DA ROTA: Agora com /api/auth/token/
    const djangoResponse = await fetch(`${DJANGO_API_URL}/api/auth/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    // BLINDAGEM: Verifica se o Django devolveu HTML (ex: Erro 404 ou 500)
    const contentType = djangoResponse.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      console.error("Django devolveu HTML em vez de JSON. Verifique a URL e o terminal do backend.");
      return NextResponse.json({ error: 'Erro de comunicação com o servidor central.' }, { status: 502 });
    }

    const data = await djangoResponse.json();

    if (!djangoResponse.ok) {
      return NextResponse.json(data, { status: djangoResponse.status });
    }

    // Sucesso! Configurando os Cookies HttpOnly
    const response = NextResponse.json({ success: true });

    response.cookies.set('access_token', data.access, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 15,
      path: '/',
    });

    response.cookies.set('refresh_token', data.refresh, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;

  } catch (error) {
    console.error("Erro no Proxy de Login:", error);
    return NextResponse.json({ error: 'Falha interna na comunicação.' }, { status: 500 });
  }
}