'use client';

import { motion } from 'framer-motion';
import { Eye } from 'lucide-react';

import { FINE_ART_EASE } from '@/lib/motion';

/**
 * Marca de "já projetado" num card do acervo.
 *
 * Fica visível em repouso, não só no hover: as etiquetas de disponibilidade do
 * card da grade vivem dentro do overlay que só aparece ao passar o mouse, e um
 * indicador de assistido ali seria invisível justamente quando o usuário
 * varre a grade procurando o que ainda não viu.
 *
 * Discreto de propósito. Numa cinemateca o que já foi visto não é lixo a
 * descartar — é acervo pessoal —, então marca sem gritar: reduz o pôster e põe
 * um sinal dourado no canto, na mesma linguagem do resto da interface.
 */
export function SeloAssistido({ compacto = false }: { compacto?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: FINE_ART_EASE }}
      title="Já projetado"
      aria-label="Já projetado"
      style={{
        position: 'absolute',
        top: 8,
        left: 8,
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        padding: compacto ? '3px 5px' : '4px 8px',
        backgroundColor: 'rgba(4,4,2,0.82)',
        border: '1px solid rgba(191,143,60,0.45)',
        backdropFilter: 'blur(4px)',
        fontFamily: "'DM Mono', monospace",
        fontSize: '8px',
        letterSpacing: '0.18em',
        color: 'var(--gold)',
        pointerEvents: 'none',
      }}
    >
      <Eye style={{ width: 10, height: 10 }} strokeWidth={1.5} />
      {!compacto && 'PROJETADO'}
    </motion.div>
  );
}

/**
 * Véu sobre o pôster de um filme já visto.
 *
 * Separado do selo porque a lista não tem pôster para escurecer, e o card da
 * grade precisa dos dois.
 */
export const veuDeAssistido = {
  filter: 'grayscale(60%) brightness(0.62)',
} as const;
