'use client';
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import type { ComoTocar, CopiaResumida } from "@/features/movies/types";

/**
 * A pergunta que o Lumière faz quando não pode simplesmente projetar.
 *
 * Ela aparece em dois casos, e a diferença entre eles muda o que faz sentido
 * oferecer:
 *
 *   `escolher` — há cópia pronta para tocar agora, mas nenhuma que o navegador
 *                aceite sem ajuda. Tocar já é possível; a pergunta é a que
 *                preço.
 *   `nada`     — não há cópia pronta nenhuma. Só resta esperar um download, ou
 *                tocar direto do torrent, que ainda não existe.
 *
 * As três saídas custam coisas diferentes — minutos de espera, uma reprodução
 * que pode engasgar, ou CPU convertendo — e é por isso que a escolha é de quem
 * vai assistir e não do programa.
 */

const CAIXA: React.CSSProperties = {
  width: '100%', textAlign: 'left', background: 'transparent',
  padding: '12px 14px', fontFamily: "'DM Mono', monospace",
  fontSize: '9px', letterSpacing: '0.15em', lineHeight: 1.8,
  marginBottom: 10, cursor: 'pointer',
};

const DETALHE: React.CSSProperties = {
  color: 'var(--m3)', fontSize: '8px', marginTop: 6, letterSpacing: '0.1em',
};

/** Uma cópia em uma linha, do jeito que ajuda a decidir. */
function descreve(copia: CopiaResumida): string {
  const partes = [
    copia.resolution || null,
    copia.audio_codec || null,
    copia.size_gb ? `${copia.size_gb.toFixed(1)} GB` : null,
    `NOTA ${copia.quality_score}`,
  ].filter(Boolean);
  return partes.join(' · ').toUpperCase();
}

export function EscolhaDeProjecao({
  plano, aberta, onFechar, onTocar, onBaixar, baixando,
}: {
  plano: ComoTocar;
  aberta: boolean;
  onFechar: () => void;
  /** Toca esta cópia. `modo` vazio deixa o backend recomendar. */
  onTocar: (releaseId: string, modo?: 'direto' | 'conversao') => void;
  onBaixar: (releaseId: string) => void;
  baixando: boolean;
}) {
  // Qual cópia imediata o usuário escolheu tocar. Enquanto for null, a
  // sub-pergunta (direto ou convertido) nem aparece: perguntar as duas coisas
  // de uma vez transformaria a escolha num formulário.
  const [paraTocar, setParaTocar] = useState<CopiaResumida | null>(null);

  const alvoDoDownload = plano.melhor_para_navegador;
  const temImediatas = plano.imediatas.length > 0;

  return (
    <AnimatePresence>
      {aberta && (
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
          style={{ border: '1px solid rgba(86,84,80,0.5)', backgroundColor: 'var(--void)', padding: '16px' }}
        >
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: 'var(--m3)', letterSpacing: '0.15em', lineHeight: 1.9, marginBottom: 16 }}>
            {temImediatas
              ? 'NENHUMA CÓPIA PRONTA TOCA NESTE NAVEGADOR SEM CONVERSÃO.'
              : 'NENHUMA CÓPIA ESTÁ PRONTA PARA TOCAR AGORA.'}
          </div>

          {/* ── a sub-pergunta, quando uma cópia imediata já foi escolhida ── */}
          {paraTocar ? (
            <div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', color: 'var(--m2)', letterSpacing: '0.15em', lineHeight: 1.9, marginBottom: 14 }}>
                {descreve(paraTocar)}
              </div>

              <motion.button
                onClick={() => onTocar(paraTocar.release_id, 'conversao')}
                whileHover={{ x: 4 }}
                style={{ ...CAIXA, border: '1px solid rgba(191,143,60,0.4)', color: 'var(--gold)' }}
              >
                [ CONVERTER O ÁUDIO E TOCAR AQUI ]
                <div style={DETALHE}>
                  O SERVIDOR CONVERTE ENQUANTO VOCÊ ASSISTE. COPIA O VÍDEO
                  INTACTO E SÓ REFAZ O SOM — MEDIDO, 15% DE CPU.
                </div>
              </motion.button>

              <motion.button
                onClick={() => onTocar(paraTocar.release_id, 'direto')}
                whileHover={{ x: 4 }}
                style={{ ...CAIXA, border: '1px solid rgba(86,84,80,0.5)', color: 'var(--m2)' }}
              >
                [ TOCAR SEM CONVERTER ]
                <div style={DETALHE}>
                  {paraTocar.precisa_converter === 'tudo'
                    ? 'O NAVEGADOR PROVAVELMENTE NÃO ABRE ESTE VÍDEO. SERVE PARA MANDAR A UM PLAYER EXTERNO.'
                    : 'IMAGEM SEM SOM: ESTE ÁUDIO O NAVEGADOR NÃO DECODIFICA. SERVE PARA MANDAR A UM PLAYER EXTERNO.'}
                </div>
              </motion.button>

              <button
                onClick={() => setParaTocar(null)}
                style={{ marginTop: 6, background: 'transparent', border: 'none', color: 'var(--m3)', fontFamily: "'DM Mono', monospace", fontSize: '8px', letterSpacing: '0.2em', cursor: 'pointer' }}
              >
                [ VOLTAR ]
              </button>
            </div>
          ) : (
            <div>
              {/* ── 1. tocar uma que já está pronta ── */}
              {plano.imediatas.map((copia) => (
                <motion.button
                  key={copia.release_id}
                  onClick={() => setParaTocar(copia)}
                  whileHover={{ x: 4 }}
                  style={{ ...CAIXA, border: '1px solid rgba(191,143,60,0.4)', color: 'var(--gold)' }}
                >
                  [ TOCAR AGORA ] {copia.title.slice(0, 46).toUpperCase()}
                  <div style={DETALHE}>{descreve(copia)}</div>
                </motion.button>
              ))}

              {/* ── 2. baixar a que o navegador toca, e ser avisado ── */}
              {alvoDoDownload ? (
                <motion.button
                  onClick={() => onBaixar(alvoDoDownload.release_id)}
                  disabled={baixando}
                  whileHover={baixando ? undefined : { x: 4 }}
                  style={{ ...CAIXA, border: '1px solid rgba(86,84,80,0.5)', color: 'var(--m2)', opacity: baixando ? 0.5 : 1, cursor: baixando ? 'wait' : 'pointer' }}
                >
                  {baixando ? '[ ENVIANDO... ]' : '[ BAIXAR NO REAL-DEBRID E ME AVISAR ]'}
                  <div style={DETALHE}>
                    {descreve(alvoDoDownload)} — TOCA SEM CONVERSÃO QUANDO FICAR PRONTA.
                  </div>
                </motion.button>
              ) : (
                <div style={{ ...CAIXA, border: '1px solid rgba(86,84,80,0.3)', color: 'var(--m3)', opacity: 0.6, cursor: 'default' }}>
                  [ BAIXAR NO REAL-DEBRID ]
                  <div style={DETALHE}>
                    NENHUMA CÓPIA PARA BAIXAR: OU JÁ ESTÃO TODAS DISPONÍVEIS, OU
                    AS QUE FALTAM VIERAM SEM MAGNET E NÃO HÁ O QUE ENVIAR.
                  </div>
                </div>
              )}

              {/* ── 3. tocar direto do torrent — no backlog ── */}
              <div
                title="Ainda não construído"
                style={{ ...CAIXA, border: '1px solid rgba(86,84,80,0.3)', color: 'var(--m3)', opacity: 0.6, cursor: 'default' }}
              >
                [ TOCAR DIRETO DO TORRENT ]
                <div style={DETALHE}>
                  AINDA NÃO EXISTE. EXIGE UM MOTOR DE TORRENT QUE SIRVA O
                  ARQUIVO ENQUANTO BAIXA — E COM POUCOS SEMEADORES A REPRODUÇÃO TRAVA.
                </div>
              </div>

              <button
                onClick={onFechar}
                style={{ marginTop: 6, background: 'transparent', border: 'none', color: 'var(--m3)', fontFamily: "'DM Mono', monospace", fontSize: '8px', letterSpacing: '0.2em', cursor: 'pointer' }}
              >
                [ FECHAR ]
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
