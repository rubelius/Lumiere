'use client';

import { useQuery } from '@tanstack/react-query';

export interface UserProfile { name: string; bio: string; avatarUrl: string; role: string; accessLevel: string; }
export interface ProfileStats { watchTimeHours: number; moviesWatched: number; averageRating: number | string; }
export interface ProfileData {
  user: UserProfile;
  stats: ProfileStats;
  charts: {
    genres: { label: string; percent: number }[];
    decades: { dec: string; val: number }[];
    directors: { dir: string; val: number }[];
    countries: { c: string; p: number; col: string }[];
    weekly: number[];
  };
  achievements: any[]; 
  history: any[];      
  systemLogs: any[];
}

export function useProfile() {
  const query = useQuery({
    queryKey: ['profile', 'telemetry'],
    queryFn: async (): Promise<ProfileData> => {
      // 👇 AGORA É REAL! Fazemos a requisição para o seu servidor Django
      const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/profile/telemetry/`;
      
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // Se usar JWT no localStorage, o token tem que ir aqui. Se for cookie, o credentials: 'include' resolve.
          ...(typeof window !== 'undefined' && localStorage.getItem('access_token') 
                ? { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` } 
                : {})
        },
        credentials: 'include' // Essencial se o seu Django usa cookies HTTPOnly
      });
      
      if (!res.ok) {
        throw new Error('Falha ao obter telemetria do servidor.');
      }
      return res.json();
    }
  });

  const logout = async () => {
    // Os tokens vivem em cookies HttpOnly, e `document.cookie` não os enxerga
    // — é justamente o que HttpOnly significa. A versão anterior varria
    // document.cookie e o localStorage e não tocava em nenhum dos dois que
    // autenticam: a tela voltava ao login com a sessão ainda de pé.
    //
    // Só o servidor que gravou consegue apagar, com um Set-Cookie expirado.
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Rede fora: segue para o login mesmo assim. Melhor a tela travada em
      // login do que o usuário continuar dentro achando que saiu.
    }

    // Estado local que não é credencial, mas guarda rastro de quem usou.
    localStorage.clear();
    sessionStorage.clear();

    // Recarrega de verdade: limpa o cache do React Query e o estado em memória.
    window.location.href = '/login';
  };

  return { ...query, logout };
}