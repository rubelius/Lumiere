import { cookies } from 'next/headers';

const MOTOR = process.env.TORRENT_SERVICE_URL || 'http://127.0.0.1:8001';

/**
 * Repassa o vídeo que o motor de torrent está servindo enquanto baixa.
 *
 * Existe pelos mesmos dois motivos do proxy do conversor: manter o `src` na
 * própria origem (o cookie de sessão acompanha, e nada precisa de
 * `crossOrigin`) e não expor a porta do motor ao navegador.
 *
 * A DIFERENÇA em relação ao conversor é o `Range`, e é ela que faz o filme
 * poder ser navegado: o motor entrega bytes por faixa, buscando as peças sob
 * demanda — medido, os últimos 64 KB de um arquivo com 0% baixado chegaram em
 * 1,2 segundo. O conversor não pode fazer isso, porque produz um fluxo ao
 * vivo; aqui o `Range` do navegador vai inteiro para o motor e volta como 206.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ hash: string }> },
) {
  const { hash } = await params;
  const access = (await cookies()).get('access_token')?.value;

  if (!access) {
    return new Response('Sessão expirada.', { status: 401 });
  }

  // Só hexadecimal: o valor entra numa URL de serviço interno, e um hash
  // inventado não pode virar outro caminho.
  if (!/^[0-9a-f]{40}$/i.test(hash)) {
    return new Response('Hash inválido.', { status: 400 });
  }

  const faixa = request.headers.get('range');

  const resposta = await fetch(`${MOTOR}/torrent/${hash}/stream`, {
    // O `Range` é repassado como veio. É ele que permite saltar no filme.
    headers: faixa ? { Range: faixa } : {},
    cache: 'no-store',
    // Sem isto, a aba fechada deixa este fetch vivo e o motor seguiria
    // buscando peças para ninguém.
    signal: request.signal,
  });

  if (!resposta.ok || !resposta.body) {
    return new Response('O motor de torrent não está servindo esta cópia.', {
      status: resposta.status || 502,
    });
  }

  // 206 e `Content-Range` precisam chegar ao navegador como vieram: sem eles
  // o <video> conclui que o arquivo não aceita faixa e desiste de navegar.
  const cabecalhos = new Headers();
  for (const nome of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
    const valor = resposta.headers.get(nome);
    if (valor) cabecalhos.set(nome, valor);
  }
  cabecalhos.set('Cache-Control', 'no-store');

  return new Response(resposta.body, { status: resposta.status, headers: cabecalhos });
}
