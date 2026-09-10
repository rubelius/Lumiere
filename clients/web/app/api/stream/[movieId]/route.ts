import { cookies } from 'next/headers';

const DJANGO_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Repassa o fluxo convertido do Django enquanto ele é produzido.
 *
 * O `<video>` não decodifica DTS, TrueHD nem Dolby Digital, e são essas as
 * faixas das cópias de maior nota do acervo. O Django converte o áudio na hora
 * e serve MP4 fragmentado; esta rota existe só para que a página possa apontar
 * o `src` para a própria origem, levando o cookie de sessão junto — o `src`
 * direto no Django precisaria de `crossOrigin`, e o mesmo elemento também
 * carrega legendas e tocaria fontes sem CORS.
 *
 * O corpo é repassado como fluxo, não lido. `await resposta.text()` — que é o
 * que a rota da legenda faz, e ali está certo — aqui esperaria o filme inteiro
 * terminar de converter antes do primeiro byte chegar ao navegador.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ movieId: string }> },
) {
  const { movieId } = await params;
  const access = (await cookies()).get('access_token')?.value;

  if (!access) {
    return new Response('Sessão expirada.', { status: 401 });
  }

  const pedido = new URL(request.url);
  const alvo = new URL(
    `${DJANGO_API_URL}/api/movies/${encodeURIComponent(movieId)}/transcode/`,
  );
  for (const chave of ['release', 'inicio']) {
    const valor = pedido.searchParams.get(chave);
    if (valor) alvo.searchParams.set(chave, valor);
  }

  const resposta = await fetch(alvo, {
    headers: { Cookie: `access_token=${access}` },
    cache: 'no-store',
    // Sem isto o navegador que fecha a aba deixa este fetch vivo, e com ele o
    // ffmpeg do outro lado baixando o filme inteiro para ninguém.
    signal: request.signal,
  });

  if (!resposta.ok || !resposta.body) {
    return new Response('Não foi possível converter esta cópia.', {
      status: resposta.status || 502,
    });
  }

  return new Response(resposta.body, {
    headers: {
      'Content-Type': resposta.headers.get('Content-Type') || 'video/mp4',
      // O fluxo está sendo produzido agora: pedir uma faixa dele não faz
      // sentido, e o navegador que tenta recebe o começo e conclui que o vídeo
      // tem a duração errada.
      'Accept-Ranges': 'none',
      'Cache-Control': 'no-store',
      'X-Lumiere-Transcode': resposta.headers.get('X-Lumiere-Transcode') || '',
    },
  });
}
