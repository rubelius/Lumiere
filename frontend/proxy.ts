import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ATENÇÃO: Mudamos o nome da função de 'middleware' para 'proxy'
export function proxy(request: NextRequest) {
  // Confere se o nosso HttpOnly cookie existe
  const token = request.cookies.get('access_token')?.value;
  const isLoginPage = request.nextUrl.pathname === '/login';

  // Se não tem token e não está na tela de login -> chuta pro login
  if (!token && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Se tem token e tenta acessar o login -> manda de volta pro arquivo
  if (token && isLoginPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

// Dizemos ao proxy para rodar em todas as rotas, EXCETO imagens e rotas internas do Next
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|images|favicon.ico).*)'],
};