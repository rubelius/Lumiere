'use client';

import { AnimatePresence, motion } from 'framer-motion';

import {
  fracaoDoProgresso, silencioDoProgresso, useVivo,
} from '@/features/admin/useVivo';

/**
 * O que está acontecendo agora.
 *
 * O relato que originou esta seção: apertar "rastrear cópias agora" enfileirava
 * o trabalho e a tela não dizia mais nada — nem progresso, nem fila, nem em que
 * filme estava, nem quantas cópias tinha achado.
 *
 * Fica no topo da tela, acima de tudo: é o que a pessoa olha enquanto espera, e
 * o resto do painel é para depois.
 */

const MONO = "'DM Mono', monospace";
const SERIF = "'Cormorant Garamond', serif";

// Depois disto sem notícia, o progresso deixa de ser tratado como vivo. O
// rastreador leva de 60 a 150 segundos por filme, então o silêncio só vira
// suspeita bem depois disso.
const SEGUNDOS_ATE_DESCONFIAR = 240;

function Barra({ fracao, suspeito }: { fracao: number; suspeito: boolean }) {
  return (
    <div style={{ height: 2, background: 'rgba(237,232,220,0.07)', marginTop: 10 }}>
      <motion.div
        animate={{ width: `${fracao}%` }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        style={{ height: '100%', background: suspeito ? 'var(--terra)' : 'var(--gold)' }}
      />
    </div>
  );
}

function Linha({ rotulo, valor, tom = 'var(--m2)' }: { rotulo: string; valor: string; tom?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, padding: '7px 0' }}>
      <span style={{ fontFamily: MONO, fontSize: '9px', letterSpacing: '0.12em', color: 'var(--m3)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {rotulo}
      </span>
      <span style={{ fontFamily: MONO, fontSize: '9px', letterSpacing: '0.12em', color: tom, whiteSpace: 'nowrap' }}>
        {valor}
      </span>
    </div>
  );
}

function Caixa({ titulo, children, vazio }: { titulo: string; children?: React.ReactNode; vazio?: string }) {
  return (
    <div style={{ border: '1px solid rgba(237,232,220,0.06)', padding: '16px 18px' }}>
      <div style={{ fontFamily: MONO, fontSize: '8px', letterSpacing: '0.22em', color: 'var(--m3)', marginBottom: 10 }}>
        {titulo}
      </div>
      {children || (
        <div style={{ fontFamily: MONO, fontSize: '9px', letterSpacing: '0.12em', color: 'var(--m3)', opacity: 0.6 }}>
          {vazio}
        </div>
      )}
    </div>
  );
}

export function Vivo() {
  // O ritmo da consulta sai do próprio estado — ver `useVivo`.
  const { data: estado } = useVivo();
  if (!estado) return null;

  const emVoo = estado.progressos.filter((p) => !p.terminou);
  const terminados = estado.progressos.filter((p) => p.terminou);

  return (
    <section style={{ paddingBottom: 56, borderBottom: '1px solid rgba(237,232,220,0.05)', marginBottom: 56 }}>
      <h2 style={{ fontFamily: SERIF, fontSize: '2rem', color: 'var(--film)', margin: '0 0 6px', fontWeight: 400 }}>
        Agora
      </h2>
      <div style={{ fontFamily: MONO, fontSize: '8px', letterSpacing: '0.18em', color: 'var(--m3)', marginBottom: 24 }}>
        {emVoo.length || estado.ativas.length
          ? 'ATUALIZANDO A CADA 3 SEGUNDOS'
          : 'NADA EM CURSO · ATUALIZANDO A CADA 15 SEGUNDOS'}
      </div>

      <AnimatePresence>
        {[...emVoo, ...terminados].map((p) => {
          const fracao = fracaoDoProgresso(p);
          const silencio = silencioDoProgresso(p);
          const suspeito = !p.terminou && silencio > SEGUNDOS_ATE_DESCONFIAR;
          return (
            <motion.div
              key={p.tarefa}
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ marginBottom: 24, border: '1px solid rgba(191,143,60,0.25)', padding: '16px 18px' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.15em', color: 'var(--gold)' }}>
                  {p.tarefa.split('.').pop()}
                </span>
                <span style={{ fontFamily: MONO, fontSize: '9px', letterSpacing: '0.12em', color: 'var(--m2)' }}>
                  {p.terminou ? 'CONCLUÍDA' : `${p.feitos} DE ${p.total} · ${fracao}%`}
                </span>
              </div>

              <Barra fracao={p.terminou ? 100 : fracao} suspeito={suspeito} />

              <div style={{ marginTop: 12, fontFamily: MONO, fontSize: '9px', letterSpacing: '0.1em', color: 'var(--m2)', lineHeight: 1.9 }}>
                {p.terminou
                  ? p.resumo
                  : <>TRABALHANDO EM: <span style={{ color: 'var(--film)' }}>{p.agora_em || '—'}</span></>}
              </div>

              {!p.terminou && (
                <div style={{ marginTop: 6, fontFamily: MONO, fontSize: '8px', letterSpacing: '0.1em', color: suspeito ? 'var(--terra)' : 'var(--m3)' }}>
                  {p.achados} CÓPIA(S) NOVA(S) · {p.erros} FALHA(S)
                  {/* O silêncio é a única forma de perceber um worker que
                      morreu no meio: o progresso congela e nada mais o
                      atualiza. Dizer há quanto tempo é o que permite notar. */}
                  {suspeito && ` · SEM NOTÍCIA HÁ ${silencio}S`}
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        <Caixa titulo="FILAS" vazio="SEM FILA">
          {estado.filas.length > 0 && estado.filas.map((f) => (
            <Linha key={f.nome} rotulo={f.nome} valor={`${f.esperando} esperando`}
                   tom={f.esperando > 0 ? 'var(--gold)' : 'var(--m2)'} />
          ))}
        </Caixa>

        <Caixa titulo="EXECUTANDO AGORA" vazio="NENHUMA TAREFA ATIVA">
          {estado.ativas.length > 0 && estado.ativas.map((a) => (
            <Linha key={a.task_id} rotulo={`${a.tarefa} · ${a.worker.split('@')[0]}`}
                   valor={`${a.desde_s}s`} tom="var(--gold)" />
          ))}
        </Caixa>

        <Caixa titulo="BUSCANDO CÓPIAS" vazio="NENHUMA BUSCA EM CURSO">
          {estado.buscas.length > 0 && estado.buscas.map((b) => (
            <Linha key={b.filme} rotulo={b.filme} valor={b.estado} tom="var(--gold)" />
          ))}
        </Caixa>
      </div>

      <div style={{ marginTop: 28 }}>
        <div style={{ fontFamily: MONO, fontSize: '8px', letterSpacing: '0.22em', color: 'var(--m3)', marginBottom: 10 }}>
          ÚLTIMAS EXECUÇÕES
        </div>
        {estado.execucoes.length === 0 ? (
          <div style={{ fontFamily: MONO, fontSize: '9px', color: 'var(--m3)', opacity: 0.6, letterSpacing: '0.12em' }}>
            NENHUMA REGISTRADA AINDA — A MEDIÇÃO É NOVA.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 1, background: 'rgba(237,232,220,0.04)' }}>
            {estado.execucoes.map((e) => (
              <div key={e.task_id + e.quando} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto auto', gap: 18, alignItems: 'baseline', padding: '9px 0', background: 'var(--bg)' }}>
                <span style={{ fontFamily: MONO, fontSize: '9px', letterSpacing: '0.12em', color: 'var(--m2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {e.tarefa}
                  <span style={{ color: 'var(--m3)' }}>
                    {e.origem === 'manual' ? ` · à mão${e.por ? ` por ${e.por}` : ''}` : ' · agendada'}
                  </span>
                  {e.erro && <span style={{ color: 'var(--terra)' }}> · {e.erro}</span>}
                </span>
                <span style={{ fontFamily: MONO, fontSize: '9px', color: 'var(--m3)', whiteSpace: 'nowrap' }}>
                  {e.duracao_s === null ? '—' : `${e.duracao_s}s`}
                </span>
                {/* Três estados, e não dois: nulo é "ainda rodando", e tratá-lo
                    como falha faria toda tarefa em curso parecer quebrada. */}
                <span style={{ fontFamily: MONO, fontSize: '9px', whiteSpace: 'nowrap',
                               color: e.sucesso === null ? 'var(--gold)' : e.sucesso ? 'var(--m3)' : 'var(--terra)' }}>
                  {e.sucesso === null ? 'RODANDO' : e.sucesso ? 'OK' : 'FALHOU'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
