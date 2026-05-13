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
    console.log("Iniciando Sequência de Desconexão...");

    // 1. Destrói TODOS os rastros locais
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.clear(); 
    sessionStorage.clear();
    
    // 2. Destrói todos os Cookies que o navegador tiver acesso
    document.cookie.split(";").forEach((c) => {
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });

    // 3. HARD RELOAD (A Opção Nuclear): Arranca a árvore do React pela raiz e limpa a memória RAM
    window.location.href = '/login';
  };

  return { ...query, logout };
}