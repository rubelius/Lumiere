'use client';

import { motion } from 'framer-motion';

import { Grafico as Canvas } from '@/components/admin/Grafico';
import { opcoesDeBarras, opcoesDeLinhas } from '@/features/admin/temaDoGrafico';
import type { Barra, Grafico, SerieDeLinhas } from '@/features/admin/usePainel';

/**
 * Os gráficos, e a ausência deles.
 *
 * `sem-dado` é uma resposta legítima e ela aparece na tela com a mesma
 * dignidade de um gráfico: duas medições não descrevem tendência, e uma linha
 * entre dois pontos convence sem ter o que dizer. Dizer "a medição começou
 * agora" é informação; desenhar a linha seria invenção.
 */

const MONO = "'DM Mono', monospace";
const SERIF = "'Cormorant Garamond', serif";

function Moldura({ g, children }: { g: Grafico; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-6%' }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      style={{ marginBottom: 44 }}
    >
      <div style={{ fontFamily: SERIF, fontSize: '1.35rem', color: 'var(--film)', marginBottom: 4 }}>
        {g.titulo}
      </div>
      <div style={{ fontFamily: MONO, fontSize: '8px', letterSpacing: '0.16em', color: 'var(--m3)', marginBottom: 14 }}>
        {g.origem.toUpperCase()}
      </div>
      {children}
      {g.ressalva && (
        <div style={{ marginTop: 10, paddingLeft: 12, borderLeft: '1px solid rgba(166,96,60,0.5)', fontFamily: MONO, fontSize: '8px', letterSpacing: '0.1em', color: 'var(--m3)', lineHeight: 2 }}>
          {g.ressalva}
        </div>
      )}
    </motion.div>
  );
}

export function Graficos({ graficos }: { graficos: Grafico[] }) {
  if (!graficos.length) return null;

  return (
    <section style={{ paddingBottom: 56, borderBottom: '1px solid rgba(237,232,220,0.05)', marginBottom: 56 }}>
      <h2 style={{ fontFamily: SERIF, fontSize: '2rem', color: 'var(--film)', margin: '0 0 28px', fontWeight: 400 }}>
        Observação
      </h2>

      {graficos.map((g) => (
        <Moldura key={g.chave} g={g}>
          {g.tipo === 'sem-dado' ? (
            <div style={{
              height: 110, display: 'flex', alignItems: 'center',
              border: '1px dashed rgba(237,232,220,0.08)', padding: '0 20px',
              fontFamily: MONO, fontSize: '9px', letterSpacing: '0.18em', color: 'var(--m3)',
            }}>
              {/* A ausência ocupa espaço de propósito: some da tela e ninguém
                  percebe que havia algo para medir ali. */}
              AINDA SEM MASSA PARA UM GRÁFICO
            </div>
          ) : g.tipo === 'linhas' ? (
            <Canvas opcoes={opcoesDeLinhas(g.dados as SerieDeLinhas[])} altura={260} />
          ) : (
            <Canvas opcoes={opcoesDeBarras(g.dados as Barra[])} altura={240} />
          )}
        </Moldura>
      ))}
    </section>
  );
}
