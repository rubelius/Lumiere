'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/features/auth/store/authStore';
import { http } from '@/services/http/client';

const FINE_ART_EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  
  // Puxa a função de salvar o token do nosso estado global
  const setAuth = useAuthStore((state) => state.setAuth);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Ajuste a rota '/api/token/' para a exata que o seu Django usa para gerar o JWT
      // Padrão do SimpleJWT geralmente é /api/token/ ou /api/auth/token/
      const response = await http.post<{ access: string; refresh: string }>('/api/auth/token/', {
        username,
        password,
      });

      // Salva o token no Zustand
      setAuth(response.access, { id: '1', username, email: '' }); 
      
      // Redireciona para o arquivo
      router.push('/library');
    } catch (err: any) {
      setError(err.message || 'CREDENCIAIS INVÁLIDAS. ACESSO NEGADO.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
      
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at center, #0A0A0A 0%, #060606 100%)', zIndex: -1 }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, ease: FINE_ART_EASE }}
        style={{ width: '100%', maxWidth: 420, padding: 48, border: '1px solid rgba(237,232,220,0.05)', backgroundColor: '#080806', position: 'relative' }}
      >
        {/* Detalhe estético (Perfuradores de filme) */}
        <div style={{ position: 'absolute', top: -6, left: 24, display: 'flex', gap: 6 }}>
          {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 4, backgroundColor: '#060606', border: '1px solid rgba(237,232,220,0.1)' }} />)}
        </div>

        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
            style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#BF8F3C', letterSpacing: '0.3em', marginBottom: 16 }}
          >
            SISTEMA CENTRAL
          </motion.div>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.5rem', fontWeight: 400, color: '#EDE8DC', margin: 0, lineHeight: 1 }}>
            Autenticação
          </h1>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#8C8880', letterSpacing: '0.15em' }}>
              [ IDENTIFICAÇÃO ]
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{ 
                background: 'transparent', border: 'none', borderBottom: '1px solid rgba(237,232,220,0.2)',
                color: '#EDE8DC', fontFamily: "'DM Mono', monospace", fontSize: '12px', padding: '8px 0',
                outline: 'none', transition: 'border-color 0.3s'
              }}
              onFocus={(e) => e.target.style.borderBottom = '1px solid #BF8F3C'}
              onBlur={(e) => e.target.style.borderBottom = '1px solid rgba(237,232,220,0.2)'}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#8C8880', letterSpacing: '0.15em' }}>
              [ CÓDIGO DE ACESSO ]
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ 
                background: 'transparent', border: 'none', borderBottom: '1px solid rgba(237,232,220,0.2)',
                color: '#EDE8DC', fontFamily: "'DM Mono', monospace", fontSize: '12px', padding: '8px 0',
                outline: 'none', transition: 'border-color 0.3s', letterSpacing: '0.2em'
              }}
              onFocus={(e) => e.target.style.borderBottom = '1px solid #BF8F3C'}
              onBlur={(e) => e.target.style.borderBottom = '1px solid rgba(237,232,220,0.2)'}
            />
          </div>

          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#B05050', letterSpacing: '0.1em', textAlign: 'center', marginTop: 8 }}>
              {error}
            </motion.div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            style={{
              marginTop: 16, background: isLoading ? 'transparent' : 'rgba(191,143,60,0.05)',
              border: isLoading ? '1px solid rgba(237,232,220,0.1)' : '1px solid rgba(191,143,60,0.4)',
              color: isLoading ? '#8C8880' : '#BF8F3C', padding: '16px', cursor: isLoading ? 'wait' : 'pointer',
              fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.2em', transition: 'all 0.3s'
            }}
          >
            {isLoading ? 'VERIFICANDO...' : '[ ACESSAR DIRETÓRIO ]'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}