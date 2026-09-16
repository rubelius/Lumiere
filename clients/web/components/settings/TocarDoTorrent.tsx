'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';

import type { IntegrationSettings } from '@/features/settings/hooks/useIntegrations';

/**
 * Onde se liga — ou não — a reprodução direta do torrent.
 *
 * O AVISO VEM ANTES DA CHAVE, e essa ordem é a única coisa que importa nesta
 * tela. Tocar direto põe o IP desta máquina no enxame, visível a qualquer
 * outro par; o Real-Debrid não faz isso, porque baixa em nome do usuário e
 * entrega por HTTP. Quem monta um acervo em torno do Real-Debrid pode nunca
 * ter pensado nessa diferença, e ligar isso sem dizer seria decidir por ele.
 *
 * Por isso a chave não é um interruptor solto: é um botão que aparece depois
 * do aviso, com o texto dizendo o que vai passar a acontecer.
 */

const GB = 1024 ** 3;

/** Os tamanhos que fazem sentido oferecer, mais o ilimitado. */
const TAMANHOS = [
  { rotulo: '5 GB', bytes: 5 * GB },
  { rotulo: '10 GB', bytes: 10 * GB },
  { rotulo: '25 GB', bytes: 25 * GB },
  { rotulo: '50 GB', bytes: 50 * GB },
  // Zero é a única forma de dizer "não apague nada". O motor entende assim, e
  // a tela precisa dizer o que isso custa.
  { rotulo: 'ILIMITADO', bytes: 0 },
];

export function descreveCota(bytes: number): string {
  if (!bytes) return 'ILIMITADO';
  const gb = bytes / GB;
  return gb >= 1 ? `${Number(gb.toFixed(1))} GB` : `${Math.round(bytes / 1024 ** 2)} MB`;
}

const CAIXA: React.CSSProperties = {
  fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em',
  padding: '10px 16px', background: 'transparent', cursor: 'pointer',
};

export function TocarDoTorrent({
  integracoes, onSalvar, salvando, carregando,
}: {
  integracoes: IntegrationSettings | undefined;
  onSalvar: (dados: Partial<IntegrationSettings>) => void;
  salvando: boolean;
  carregando?: boolean;
}) {
  const ligado = Boolean(integracoes?.torrent_direto_permitido);
  // Sem resposta ainda, `?? 10 GB` mostraria o padrão como se fosse a escolha
  // do usuário — e o botão de 10 GB apareceria aceso sobre uma conta que
  // escolheu ILIMITADO.
  const cota = integracoes?.torrent_cache_bytes ?? 10 * GB;
  const [avisoLido, setAvisoLido] = useState(false);

  return (
    <div style={{ border: '1px solid rgba(237,232,220,0.05)', padding: 24, marginTop: 24 }}>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'var(--gold)', letterSpacing: '0.2em', marginBottom: 6 }}>
        TOCAR DIRETO DO TORRENT
      </div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', color: 'var(--m3)', letterSpacing: '0.1em', lineHeight: 1.9, marginBottom: 20 }}>
        PARA QUANDO NENHUMA CÓPIA ESTÁ PRONTA NO REAL-DEBRID. TOCA DESDE O
        PRIMEIRO PEDAÇO, SEM ESPERAR O DOWNLOAD TERMINAR.
      </div>

      {/* O aviso, em cor de alerta, e antes de qualquer controle. */}
      <div style={{ border: '1px solid var(--terra)', padding: '14px 16px', marginBottom: 20, fontFamily: "'DM Mono', monospace", fontSize: '9px', color: 'var(--terra)', letterSpacing: '0.1em', lineHeight: 1.9 }}>
        ISTO EXPÕE O IP DESTA MÁQUINA.<br />
        <span style={{ color: 'var(--m2)' }}>
          AO TOCAR DIRETO, ESTA MÁQUINA ENTRA NO ENXAME DO TORRENT E O ENDEREÇO
          DELA FICA VISÍVEL A QUALQUER OUTRO PAR. O REAL-DEBRID NÃO FAZ ISSO —
          ELE BAIXA EM NOME DA SUA CONTA E ENTREGA POR HTTP, E O ENXAME NUNCA VÊ
          A SUA CASA.
        </span>
      </div>

      {carregando ? (
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: 'var(--m3)', letterSpacing: '0.15em' }}>
          {/* Sem resposta do servidor ainda, não se afirma que está desligado:
              mostrar a caixa de consentimento aqui faria quem já ligou ler que
              precisa ligar de novo. */}
          CONSULTANDO...
        </div>
      ) : ligado ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: 'var(--gold)', letterSpacing: '0.15em' }}>
              ● LIGADO
            </span>
            <motion.button
              whileHover={{ x: 3 }}
              disabled={salvando}
              onClick={() => onSalvar({ torrent_direto_permitido: false })}
              style={{ ...CAIXA, border: '1px solid rgba(86,84,80,0.5)', color: 'var(--m3)', padding: '8px 14px' }}
            >
              [ DESLIGAR ]
            </motion.button>
          </div>

          <div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: 'var(--m2)', letterSpacing: '0.15em', marginBottom: 4 }}>
              CACHE EM DISCO — {descreveCota(cota)}
            </div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', color: 'var(--m3)', letterSpacing: '0.1em', lineHeight: 1.9, marginBottom: 14 }}>
              O QUE JÁ FOI ASSISTIDO É APAGADO PARA CABER NESTA COTA. CHEIO, O
              DOWNLOAD PAUSA ATÉ VOCÊ AVANÇAR NO FILME.<br />
              EM <strong style={{ color: 'var(--m2)' }}>ILIMITADO</strong> NADA
              É APAGADO: O FILME INTEIRO FICA EM DISCO.
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {TAMANHOS.map((t) => {
                const ativo = cota === t.bytes;
                return (
                  <motion.button
                    key={t.rotulo}
                    whileHover={{ y: -2 }}
                    disabled={salvando}
                    onClick={() => onSalvar({ torrent_cache_bytes: t.bytes })}
                    style={{
                      ...CAIXA,
                      border: `1px solid ${ativo ? 'var(--gold)' : 'rgba(237,232,220,0.1)'}`,
                      color: ativo ? 'var(--gold)' : 'var(--m3)',
                      backgroundColor: ativo ? 'rgba(191,143,60,0.05)' : 'transparent',
                    }}
                  >
                    {t.rotulo}
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={avisoLido}
              onChange={(e) => setAvisoLido(e.target.checked)}
              style={{ marginTop: 2, accentColor: 'var(--gold)' }}
            />
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: 'var(--m2)', letterSpacing: '0.1em', lineHeight: 1.8 }}>
              ENTENDI QUE O IP DESTA MÁQUINA FICARÁ VISÍVEL NO ENXAME.
            </span>
          </label>

          <motion.button
            whileHover={avisoLido ? { backgroundColor: 'var(--gold)', color: 'var(--void)' } : undefined}
            disabled={!avisoLido || salvando}
            onClick={() => onSalvar({ torrent_direto_permitido: true })}
            style={{
              ...CAIXA, alignSelf: 'flex-start', padding: '12px 24px',
              border: '1px solid var(--gold)', color: 'var(--gold)',
              opacity: avisoLido ? 1 : 0.35,
              cursor: avisoLido ? 'pointer' : 'not-allowed',
            }}
          >
            {salvando ? '[ GRAVANDO... ]' : '[ LIGAR MESMO ASSIM ]'}
          </motion.button>
        </div>
      )}
    </div>
  );
}
