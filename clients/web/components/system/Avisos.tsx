'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

import { FINE_ART_EASE } from '@/lib/motion';
import { useAvisos } from '@/features/notifications/useAvisos';

/**
 * Onde os avisos do Lumière aparecem.
 *
 * Um canto, e não uma caixa de entrada: o que chega por aqui é "a cópia que
 * você mandou baixar ficou pronta", e a resposta útil é um clique para
 * assistir. Some quando dispensado, e a contagem de não lidos vive no
 * servidor — outra aba que dispense o mesmo aviso o vê sumir daqui também.
 */
export function Avisos() {
  const { avisos, dispensa } = useAvisos();
  const router = useRouter();

  return (
    <div
      style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 999999,
        display: 'flex', flexDirection: 'column', gap: 10,
        // Só a caixa de cada aviso captura o clique; a coluna não pode virar
        // uma parede invisível sobre o canto da tela.
        pointerEvents: 'none', maxWidth: 360,
      }}
    >
      <AnimatePresence>
        {avisos.map((aviso) => (
          <motion.div
            key={aviso.id}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.4, ease: FINE_ART_EASE }}
            style={{
              pointerEvents: 'auto',
              backgroundColor: 'var(--void)',
              border: '1px solid rgba(191,143,60,0.4)',
              padding: '14px 16px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.9)',
              fontFamily: "'DM Mono', monospace",
            }}
          >
            <div style={{ fontSize: '9px', letterSpacing: '0.2em', color: 'var(--gold)', textTransform: 'uppercase' }}>
              {aviso.title}
            </div>
            <div style={{ fontSize: '9px', letterSpacing: '0.08em', color: 'var(--m2)', lineHeight: 1.8, marginTop: 8 }}>
              {aviso.message}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
              {aviso.action_url && (
                <button
                  onClick={() => { dispensa(aviso.id); router.push(aviso.action_url!); }}
                  style={{ background: 'transparent', border: 'none', color: 'var(--gold)', fontFamily: "'DM Mono', monospace", fontSize: '8px', letterSpacing: '0.2em', cursor: 'pointer', padding: 0 }}
                >
                  [ {(aviso.action_text || 'ABRIR').toUpperCase()} ]
                </button>
              )}
              <button
                onClick={() => dispensa(aviso.id)}
                style={{ background: 'transparent', border: 'none', color: 'var(--m3)', fontFamily: "'DM Mono', monospace", fontSize: '8px', letterSpacing: '0.2em', cursor: 'pointer', padding: 0 }}
              >
                [ DISPENSAR ]
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
