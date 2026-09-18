'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

import { ehEquipe, useUsuario } from '@/features/auth/hooks/useUsuario';
import { idadeDaMedicao, usePainel, type Painel } from '@/features/admin/usePainel';
import { Acoes } from '@/components/admin/Acoes';
import { Graficos } from '@/components/admin/Graficos';

/**
 * O painel de administração.
 *
 * A REGRA DESTA TELA: todo número vem acompanhado de DE ONDE veio, QUANDO foi
 * medido, e — quando for o caso — do que ele NÃO diz. Uma tela de
 * observabilidade é o lugar mais fácil do mundo para repetir o defeito que este
 * projeto mais comete, que é afirmar o que não é verdade; aqui a procedência
 * não é rodapé decorativo, é parte do dado.
 */

const FINE_ART_EASE = [0.22, 1, 0.36, 1] as const;

const MONO = "'DM Mono', monospace";
const SERIF = "'Cormorant Garamond', serif";

function Cabecalho({ painel }: { painel: Painel }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontFamily: SERIF, fontSize: '2rem', color: 'var(--film)', margin: 0, fontWeight: 400 }}>
        {painel.titulo}
      </h2>
      <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: MONO, fontSize: '8px', letterSpacing: '0.18em', color: 'var(--m3)' }}>
          {painel.origem.toUpperCase()}
        </span>
        <span style={{ fontFamily: MONO, fontSize: '8px', letterSpacing: '0.18em', color: 'var(--m3)' }}>
          · {idadeDaMedicao(painel.medido_em)}
        </span>
      </div>
    </div>
  );
}

function Bloco({ painel }: { painel: Painel }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-8%' }}
      transition={{ duration: 0.8, ease: FINE_ART_EASE }}
      style={{ paddingBottom: 56, borderBottom: '1px solid rgba(237,232,220,0.05)', marginBottom: 56 }}
    >
      <Cabecalho painel={painel} />

      <div style={{ display: 'grid', gap: 1, background: 'rgba(237,232,220,0.04)' }}>
        {painel.valores.map((v) => (
          <div
            key={v.rotulo}
            style={{
              display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto',
              gap: 24, alignItems: 'baseline', padding: '14px 0',
              background: 'var(--bg)',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.12em', color: 'var(--m2)' }}>
                {v.rotulo}
              </div>
              {v.detalhe && (
                <div style={{ fontFamily: MONO, fontSize: '8px', letterSpacing: '0.1em', color: 'var(--m3)', marginTop: 4, lineHeight: 1.8 }}>
                  {v.detalhe}
                </div>
              )}
            </div>
            <div style={{ fontFamily: SERIF, fontSize: '1.5rem', color: 'var(--film)', whiteSpace: 'nowrap' }}>
              {typeof v.valor === 'number' ? v.valor.toLocaleString('pt-BR') : v.valor}
            </div>
          </div>
        ))}
      </div>

      {painel.ressalva && (
        <div
          style={{
            marginTop: 20, padding: '12px 16px', borderLeft: '1px solid var(--terra)',
            fontFamily: MONO, fontSize: '8px', letterSpacing: '0.1em',
            color: 'var(--m2)', lineHeight: 2,
          }}
        >
          {/* A ressalva é parte do dado, e não nota de rodapé: é ela que
              impede o número de cima de ser lido como algo que ele não é. */}
          O QUE ESTE NÚMERO NÃO DIZ — {painel.ressalva}
        </div>
      )}
    </motion.section>
  );
}

export default function AdminPage() {
  const { data: usuario, isLoading: carregandoUsuario } = useUsuario();
  const equipe = ehEquipe(usuario);
  const { data, isLoading, isError, error } = usePainel();

  const moldura = (conteudo: React.ReactNode) => (
    <div style={{ background: 'var(--bg)', color: 'var(--film)', minHeight: '100dvh' }}>
      <main style={{ padding: 'clamp(48px, 8vh, 96px) clamp(24px, 6vw, 96px)', maxWidth: 1100 }}>
        {conteudo}
      </main>
    </div>
  );

  if (carregandoUsuario || (equipe && isLoading)) {
    return moldura(
      <div style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.2em', color: 'var(--m3)' }}>
        CONSULTANDO...
      </div>,
    );
  }

  // A recusa é explicada, e não é um 403 cru. Quem chega aqui por engano
  // precisa saber que a tela existe e não é para ele — não que quebrou.
  if (!equipe) {
    return moldura(
      <>
        <h1 style={{ fontFamily: SERIF, fontSize: '2.6rem', fontWeight: 400, margin: '0 0 12px' }}>
          Esta sala é da equipe.
        </h1>
        <p style={{ fontFamily: MONO, fontSize: '9px', letterSpacing: '0.15em', color: 'var(--m3)', lineHeight: 2 }}>
          O PAINEL MOSTRA TAMANHO DE BANCO, CONTAS, CREDENCIAIS EM USO E O ESTADO
          DE CADA SERVIÇO. A SUA CONTA NÃO TEM ESSA MARCA.
        </p>
        <Link href="/" style={{ display: 'inline-block', marginTop: 32, fontFamily: MONO, fontSize: '9px', letterSpacing: '0.2em', color: 'var(--gold)', textDecoration: 'none', border: '1px solid rgba(191,143,60,0.4)', padding: '10px 20px' }}>
          [ VOLTAR AO ÍNDICE ]
        </Link>
      </>,
    );
  }

  if (isError) {
    return moldura(
      <>
        <h1 style={{ fontFamily: SERIF, fontSize: '2.6rem', fontWeight: 400, margin: '0 0 12px' }}>
          O painel não respondeu.
        </h1>
        <p style={{ fontFamily: MONO, fontSize: '9px', letterSpacing: '0.15em', color: 'var(--terra)', lineHeight: 2 }}>
          {String((error as Error)?.message || '').toUpperCase() || 'SEM DETALHE.'}
        </p>
      </>,
    );
  }

  const paineis = data?.paineis ?? [];

  return moldura(
    <>
      <div style={{ marginBottom: 56 }}>
        <div style={{ fontFamily: MONO, fontSize: '9px', letterSpacing: '0.25em', color: 'var(--m3)', marginBottom: 10 }}>
          SALA DE PROJEÇÃO · {usuario?.username?.toUpperCase()}
        </div>
        <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(2.6rem, 6vw, 4rem)', fontWeight: 400, margin: 0, lineHeight: 1 }}>
          O estado do Lumière.
        </h1>
      </div>

      {/* Um painel que falhou é notícia, e não silêncio. Sem isto a tela
          simplesmente teria uma seção a menos e ninguém saberia. */}
      {(data?.falharam?.length ?? 0) > 0 && (
        <div style={{ marginBottom: 48, padding: '14px 18px', border: '1px solid var(--terra)', fontFamily: MONO, fontSize: '9px', letterSpacing: '0.1em', color: 'var(--terra)', lineHeight: 2 }}>
          {data!.falharam.length} PAINEL(IS) NÃO PUDERAM SER MEDIDOS:<br />
          {data!.falharam.map((f) => <div key={f} style={{ color: 'var(--m2)' }}>{f}</div>)}
        </div>
      )}

      {/* AGIR vem antes de OBSERVAR, e observar antes de contar.
          Quem abre esta tela quase sempre já sabe o que quer fazer; os
          números existem para confirmar depois. A ordem antiga — só números —
          obrigava a rolar a página inteira e depois abrir um terminal. */}
      <Acoes acoes={data?.acoes ?? []} />

      <Graficos graficos={data?.graficos ?? []} />

      {paineis.map((p) => <Bloco key={p.chave} painel={p} />)}

      {paineis.length === 0 && (
        <div style={{ fontFamily: MONO, fontSize: '9px', letterSpacing: '0.15em', color: 'var(--m3)' }}>
          NENHUM PAINEL PÔDE SER MEDIDO.
        </div>
      )}
    </>,
  );
}
