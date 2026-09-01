'use client';

import Link from "next/link";
import { FINE_ART_EASE } from '@/lib/motion';
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";


export default function NotFound() {
  return (
    <div
      className="min-h-screen w-full flex items-center justify-center"
      style={{ backgroundColor: 'var(--bg)', color: 'var(--film)' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: FINE_ART_EASE }}
        style={{ maxWidth: 560, padding: '0 32px' }}
      >
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', color: 'var(--m3)', textTransform: 'uppercase' }}>
          [ Referência não localizada ]
        </div>

        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '4rem', fontWeight: 400, lineHeight: 1, margin: '24px 0 0 0' }}>
          Rolo ausente.
        </h1>

        <div style={{ height: 1, background: 'color-mix(in srgb, var(--film) 7%, transparent)', margin: '32px 0' }} />

        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', lineHeight: 1.8, letterSpacing: '0.05em', color: 'var(--m2)', margin: 0 }}>
          Esta bobina não consta no acervo. O endereço pode ter sido
          reclassificado, ou nunca ter existido.
        </p>

        <motion.div whileHover="hover" initial="rest" animate="rest" style={{ display: 'inline-block', marginTop: 48 }}>
          <Link
            href="/"
            style={{ display: 'flex', alignItems: 'center', gap: 12, fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)', border: '1px solid color-mix(in srgb, var(--gold) 30%, transparent)', padding: '14px 24px' }}
          >
            <motion.span variants={{ rest: { x: 0 }, hover: { x: -4 } }} style={{ display: 'flex' }}>
              <ArrowLeft style={{ width: 14, height: 14 }} />
            </motion.span>
            Retornar ao acervo
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}
