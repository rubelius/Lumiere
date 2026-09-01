import { cookies } from 'next/headers';

const DJANGO_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Repassa a legenda em WebVTT vinda do Django.
 *
 * Existe por um motivo específico: uma <track> de outra origem exigiria
 * `crossOrigin` no <video>, e isso quebraria a reprodução — a CDN do
 * Real-Debrid não devolve cabeçalhos CORS, então o vídeo passaria a falhar.
 * Servindo a legenda pela mesma origem da página, o <track> carrega sem
 * exigir nada do elemento de vídeo.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;
  const access = (await cookies()).get('access_token')?.value;

  if (!access) {
    return new Response('WEBVTT\n\n', { status: 401, headers: { 'Content-Type': 'text/vtt' } });
  }

  const resposta = await fetch(`${DJANGO_API_URL}/api/subtitles/${encodeURIComponent(fileId)}/vtt/`, {
    headers: { Cookie: `access_token=${access}` },
    cache: 'no-store',
  });

  if (!resposta.ok) {
    // Devolve VTT vazio e válido: um corpo inválido faria o navegador
    // registrar erro de parsing em vez de simplesmente não mostrar legenda.
    return new Response('WEBVTT\n\n', {
      status: resposta.status,
      headers: { 'Content-Type': 'text/vtt; charset=utf-8' },
    });
  }

  return new Response(await resposta.text(), {
    headers: { 'Content-Type': 'text/vtt; charset=utf-8', 'Cache-Control': 'private, max-age=3600' },
  });
}
