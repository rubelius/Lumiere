import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import { cookies } from 'next/headers';

// CORREÇÃO AQUI: Sem as chaves { } !
import MovieClient from './MovieClient'; 

// Força o Next.js a nunca cachear essa página inteira (Ótimo para apps dinâmicos como o nosso)
export const dynamic = 'force-dynamic';

export default async function MovieServerPage({ params }: { params: Promise<{ id: string }> }) {
  const queryClient = new QueryClient();
  
  const resolvedParams = await params;
  const movieId = resolvedParams.id;

  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;

  await queryClient.prefetchQuery({
    queryKey: ['movies', 'detail', movieId], 
    queryFn: async () => {
      const djangoUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${djangoUrl}/api/movies/${movieId}/`, {
        cache: 'no-store', // <-- O DESTRUIDOR DE CACHE AQUI!
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
      });

      if (!res.ok) throw new Error('Falha ao buscar dados do filme no servidor');
      return res.json();
    },
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <MovieClient />
    </HydrationBoundary>
  );
}