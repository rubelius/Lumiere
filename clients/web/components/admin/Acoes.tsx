'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

import { useDisparaAcao, type Acao } from '@/features/admin/usePainel';

/**
 * O que dá para MANDAR o Lumière fazer.
 *
 * A confirmação em dois tempos não é cerimônia: estas ações enfileiram
 * trabalho real — o rastreador vai a indexadores, a sincronização vai ao
 * Real-Debrid — e um clique de passagem num painel que se atualiza sozinho é
 * fácil demais. O segundo clique é o consentimento.
 */

const MONO = "'DM Mono', monospace";
const SERIF = "'Cormorant Garamond', serif";

export function Acoes({ acoes }: { acoes: Acao[] }) {
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [disparadas, setDisparadas] = useState<Record<string, string>>({});
  const disparar = useDisparaAcao();

  if (!acoes.length) return null;

  return (
    <section style={{ paddingBottom: 56, borderBottom: '1px solid rgba(237,232,220,0.05)', marginBottom: 56 }}>
      <h2 style={{ fontFamily: SERIF, fontSize: '2rem', color: 'var(--film)', margin: '0 0 6px', fontWeight: 400 }}>
        Agir
      </h2>
      <div style={{ fontFamily: MONO, fontSize: '8px', letterSpacing: '0.18em', color: 'var(--m3)', marginBottom: 28 }}>
        NENHUMA DESTAS APAGA NADA · TODAS FICAM REGISTRADAS COM QUEM DISPAROU
      </div>

      <div style={{ display: 'grid', gap: 1, background: 'rgba(237,232,220,0.04)' }}>
        {acoes.map((a) => {
          const aguardando = confirmando === a.chave;
          const feita = disparadas[a.chave];
          const emVoo = disparar.isPending && confirmando === a.chave;

          return (
            <div
              key={a.chave}
              style={{
                display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto',
                gap: 24, alignItems: 'center', padding: '16px 0', background: 'var(--bg)',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.12em', color: 'var(--m2)' }}>
                  {a.titulo}
                </div>
                <div style={{ fontFamily: MONO, fontSize: '8px', letterSpacing: '0.1em', color: 'var(--m3)', marginTop: 5, lineHeight: 1.9 }}>
                  {a.descricao}
                </div>
                {feita && (
                  <div style={{ fontFamily: MONO, fontSize: '8px', letterSpacing: '0.1em', color: 'var(--gold)', marginTop: 6 }}>
                    {/* O id da tarefa, e não um "pronto!": ele é o que permite
                        achar esta execução na lista logo abaixo. */}
                    ENFILEIRADA · {feita}
                  </div>
                )}
              </div>

              <motion.button
                whileHover={{ x: 3 }}
                disabled={disparar.isPending}
                onClick={() => {
                  if (!aguardando) { setConfirmando(a.chave); return; }
                  disparar.mutate(a.chave, {
                    onSuccess: (r) => {
                      setDisparadas((d) => ({ ...d, [a.chave]: r.task_id.slice(0, 8) }));
                      setConfirmando(null);
                    },
                    onError: () => setConfirmando(null),
                  });
                }}
                onBlur={() => aguardando && setConfirmando(null)}
                style={{
                  background: 'transparent',
                  border: `1px solid ${aguardando ? 'var(--gold)' : 'rgba(86,84,80,0.5)'}`,
                  color: aguardando ? 'var(--gold)' : 'var(--m3)',
                  padding: '10px 18px', fontFamily: MONO, fontSize: '9px',
                  letterSpacing: '0.2em', cursor: disparar.isPending ? 'wait' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {emVoo ? '[ ENFILEIRANDO... ]' : aguardando ? '[ CONFIRMAR ]' : '[ RODAR AGORA ]'}
              </motion.button>
            </div>
          );
        })}
      </div>

      {disparar.isError && (
        <div style={{ marginTop: 16, padding: '12px 16px', border: '1px solid var(--terra)', fontFamily: MONO, fontSize: '9px', letterSpacing: '0.1em', color: 'var(--terra)', lineHeight: 1.9 }}>
          {String((disparar.error as Error)?.message || 'NÃO CONSEGUI ENFILEIRAR.').toUpperCase()}
        </div>
      )}
    </section>
  );
}
