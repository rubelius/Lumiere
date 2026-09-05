import { NextResponse } from 'next/server';

import { clearAuthCookies } from '@/lib/auth-cookies';

/**
 * Encerra a sessão.
 *
 * Os cookies de autenticação são HttpOnly — é o que impede um script na
 * página de lê-los — e por isso o JavaScript também não consegue apagá-los.
 * O botão de sair limpava só o estado do cliente: a tela voltava para o
 * login enquanto o cookie continuava válido e qualquer requisição seguia
 * autenticada. Apagar o cookie só é possível aqui, com um Set-Cookie vindo
 * da mesma origem que o gravou.
 */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  clearAuthCookies(res);
  return res;
}
