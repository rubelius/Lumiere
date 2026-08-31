import type { NextResponse } from 'next/server';

/**
 * Cookies de autenticação do Lumière.
 *
 * O Django valida o JWT a partir do cookie `access_token`
 * (lumiere.authentication.CookieJWTAuthentication), então a vida do cookie
 * precisa acompanhar a vida do token. Antes elas divergiam: o cookie durava
 * 15 minutos e o token 7 dias, e o usuário era chutado para o login com uma
 * credencial ainda perfeitamente válida.
 *
 * Em vez de repetir aqui a constante do backend (SIMPLE_JWT), lemos o `exp`
 * do próprio token — assim mudar a configuração do Django não exige mexer no
 * frontend.
 */

const FALLBACK_MAX_AGE = 60 * 15;

/**
 * Segundos até o `exp` do JWT. Só lê o payload; NÃO valida a assinatura —
 * quem valida é o Django. Serve apenas para dimensionar o cookie.
 */
export function secondsUntilExpiry(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = JSON.parse(
      Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
    );
    if (typeof json.exp !== 'number') return null;
    const restante = json.exp - Math.floor(Date.now() / 1000);
    return restante > 0 ? restante : null;
  } catch {
    return null;
  }
}

function base(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

/**
 * Grava os cookies de sessão. `refresh` é opcional porque nem toda resposta
 * o devolve — mas com ROTATE_REFRESH_TOKENS ligado no Django, quando vier é
 * um token novo e o antigo já foi para a blacklist: precisa ser gravado.
 */
export function setAuthCookies(res: NextResponse, access: string, refresh?: string) {
  res.cookies.set('access_token', access, base(secondsUntilExpiry(access) ?? FALLBACK_MAX_AGE));
  if (refresh) {
    res.cookies.set('refresh_token', refresh, base(secondsUntilExpiry(refresh) ?? 60 * 60 * 24 * 7));
  }
}

export function clearAuthCookies(res: NextResponse) {
  res.cookies.delete('access_token');
  res.cookies.delete('refresh_token');
}
