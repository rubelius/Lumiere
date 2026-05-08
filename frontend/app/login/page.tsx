'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/features/auth/store/authStore';
import { Lock, ScanFace, ArrowRight, Loader2 } from 'lucide-react';

const FINE_ART_EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState<'username' | 'password' | null>(null);
  const [bootSequence, setBootSequence] = useState(true);
  
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);

  // Efeito rápido de "Boot" do sistema ao carregar a página
  useEffect(() => {
    const timer = setTimeout(() => setBootSequence(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // ATENÇÃO: Agora chamamos a NOSSA API do Next.js (Proxy), e não o Django diretamente!
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'CREDENCIAIS INVÁLIDAS. ACESSO NEGADO.');
      }

      setAuth({ username });
      
      window.location.href = '/';
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', backgroundColor: '#060606' }}>
      
      {/* ── BACKGROUND ESPACIAL E CINEMÁTICO ── */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        {/* Ruído granulado imitando película */}
        <div className="fixed inset-0 bg-noise opacity-[0.04] mix-blend-overlay" />
        
        {/* Feixe de projetor principal girando lentamente */}
        <motion.div 
          animate={{ rotate: 360, scale: [1, 1.1, 1], opacity: [0.15, 0.25, 0.15] }} 
          transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
          style={{ position: 'absolute', top: '-20%', left: '-10%', width: '70vw', height: '70vw', background: 'radial-gradient(circle, rgba(191,143,60,0.08) 0%, transparent 60%)', filter: 'blur(60px)' }} 
        />

        {/* Foco de luz seguindo a parte inferior */}
        <motion.div 
          animate={{ x: ['-20%', '20%', '-20%'] }} 
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
          style={{ position: 'absolute', bottom: '-10%', right: '10%', width: '50vw', height: '30vw', background: 'radial-gradient(ellipse, rgba(86,84,80,0.1) 0%, transparent 60%)', filter: 'blur(80px)' }} 
        />
      </div>

      {/* ── SEQUÊNCIA DE BOOT INICIAL ── */}
      <AnimatePresence>
        {bootSequence && (
          <motion.div 
            initial={{ opacity: 1 }} exit={{ opacity: 0, filter: 'blur(10px)', scale: 1.1 }} transition={{ duration: 0.8, ease: FINE_ART_EASE }}
            style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#060606' }}
          >
            <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ duration: 1, repeat: Infinity }} style={{ fontFamily: "'DM Mono', monospace", fontSize: '12px', color: '#BF8F3C', letterSpacing: '0.3em' }}>
              INICIALIZANDO LENTES ÓPTICAS...
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── CAIXA DE AUTENTICAÇÃO ── */}
      <motion.div
        initial={{ opacity: 0, y: 40, filter: 'blur(10px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 1.2, delay: 0.4, ease: FINE_ART_EASE }}
        style={{ width: '100%', maxWidth: 440, zIndex: 10, position: 'relative' }}
      >
        <div style={{ position: 'relative', padding: '56px 48px', border: '1px solid rgba(237,232,220,0.08)', backgroundColor: 'rgba(6,6,6,0.6)', backdropFilter: 'blur(20px)', boxShadow: '0 30px 100px -20px rgba(0,0,0,1)' }}>
          
          {/* Bordas decorativas (Câmera de formato médio) */}
          <div style={{ position: 'absolute', top: 0, left: 0, width: 24, height: 1, backgroundColor: '#BF8F3C' }} />
          <div style={{ position: 'absolute', top: 0, left: 0, width: 1, height: 24, backgroundColor: '#BF8F3C' }} />
          <div style={{ position: 'absolute', bottom: 0, right: 0, width: 24, height: 1, backgroundColor: '#BF8F3C' }} />
          <div style={{ position: 'absolute', bottom: 0, right: 0, width: 1, height: 24, backgroundColor: '#BF8F3C' }} />

          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <motion.div 
              initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 1, delay: 0.8, ease: FINE_ART_EASE }}
              style={{ width: '40px', height: '1px', backgroundColor: '#BF8F3C', margin: '0 auto 24px', transformOrigin: 'center' }}
            />
            <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '3rem', fontWeight: 300, color: '#EDE8DC', margin: 0, lineHeight: 1, letterSpacing: '-0.02em' }}>
              Lumière.
            </h1>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#8C8880', letterSpacing: '0.4em', textTransform: 'uppercase', marginTop: 16 }}>
              Terminal de Acesso
            </p>
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            
            {/* Campo: Usuário */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'relative' }} className="group">
              <label style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: focusedInput === 'username' ? '#BF8F3C' : '#565450', letterSpacing: '0.2em', transition: 'color 0.3s', display: 'flex', alignItems: 'center', gap: 8 }}>
                <ScanFace style={{ width: 12, height: 12 }} /> IDENTIFICAÇÃO
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onFocus={() => setFocusedInput('username')}
                onBlur={() => setFocusedInput(null)}
                placeholder="Insira seu código operário..."
                style={{ 
                  background: 'transparent', border: 'none', borderBottom: '1px solid rgba(237,232,220,0.1)',
                  color: '#EDE8DC', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', padding: '8px 0',
                  outline: 'none', transition: 'border-color 0.3s', fontStyle: 'italic'
                }}
              />
              <motion.div 
                initial={false}
                animate={{ width: focusedInput === 'username' ? '100%' : '0%', opacity: focusedInput === 'username' ? 1 : 0 }}
                transition={{ duration: 0.4, ease: FINE_ART_EASE }}
                style={{ position: 'absolute', bottom: 0, left: 0, height: '1px', backgroundColor: '#BF8F3C', boxShadow: '0 0 10px rgba(191,143,60,0.5)' }}
              />
            </div>

            {/* Campo: Senha */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'relative' }} className="group">
              <label style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: focusedInput === 'password' ? '#BF8F3C' : '#565450', letterSpacing: '0.2em', transition: 'color 0.3s', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Lock style={{ width: 12, height: 12 }} /> CHAVE CRIPTOGRÁFICA
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocusedInput('password')}
                onBlur={() => setFocusedInput(null)}
                placeholder="••••••••••••"
                style={{ 
                  background: 'transparent', border: 'none', borderBottom: '1px solid rgba(237,232,220,0.1)',
                  color: '#EDE8DC', fontFamily: "'DM Mono', monospace", fontSize: '1.2rem', padding: '8px 0',
                  outline: 'none', transition: 'border-color 0.3s', letterSpacing: '0.3em'
                }}
              />
              <motion.div 
                initial={false}
                animate={{ width: focusedInput === 'password' ? '100%' : '0%', opacity: focusedInput === 'password' ? 1 : 0 }}
                transition={{ duration: 0.4, ease: FINE_ART_EASE }}
                style={{ position: 'absolute', bottom: 0, left: 0, height: '1px', backgroundColor: '#BF8F3C', boxShadow: '0 0 10px rgba(191,143,60,0.5)' }}
              />
            </div>

            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#B05050', letterSpacing: '0.1em', textAlign: 'center', padding: '12px', border: '1px solid rgba(176,80,80,0.3)', backgroundColor: 'rgba(176,80,80,0.05)' }}>
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              type="submit"
              disabled={isLoading}
              whileHover={!isLoading ? { backgroundColor: 'rgba(191,143,60,0.1)', paddingLeft: '24px' } : {}}
              whileTap={!isLoading ? { scale: 0.98 } : {}}
              style={{
                marginTop: 24, background: 'transparent', border: '1px solid rgba(191,143,60,0.4)',
                color: isLoading ? '#8C8880' : '#BF8F3C', padding: '20px', cursor: isLoading ? 'wait' : 'pointer',
                fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.2em', transition: 'all 0.4s ease',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', overflow: 'hidden'
              }}
              className="group"
            >
              {/* Efeito de Scan cinético no botão */}
              <motion.div 
                animate={{ x: ['-100%', '200%'] }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                style={{ position: 'absolute', top: 0, bottom: 0, width: '30%', background: 'linear-gradient(to right, transparent, rgba(191,143,60,0.2), transparent)', zIndex: 0 }}
              />
              
              <span style={{ zIndex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
                {isLoading ? <Loader2 className="animate-spin" style={{ width: 14, height: 14 }} /> : '[ AUTENTICAR SESSÃO ]'}
              </span>
              
              {!isLoading && (
                <ArrowRight style={{ width: 14, height: 14, zIndex: 1, opacity: 0.5, transition: 'opacity 0.3s, transform 0.3s' }} className="group-hover:opacity-100 group-hover:translate-x-1" />
              )}
            </motion.button>
          </form>

        </div>
      </motion.div>
    </div>
  );
}