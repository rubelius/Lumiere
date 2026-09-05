'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

import { MovieCard } from '@/components/ui/movie-card';
import { useRecomendados } from '@/features/movies/hooks/useMovies';
import { FINE_ART_EASE } from '@/lib/motion';

/**
 * Faixa de recomendação pessoal na home.
 *
 * O perfil de gosto é retreinado a cada filme concluído, e até agora não tinha
 * nenhuma superfície: a recomendação melhorava para ninguém. Esta é a ponta
 * que faltava da corrente.
 *
 * A seção some quando não há o que mostrar, em vez de exibir um espaço vazio
 * ou cair em popularidade — apresentar os mais bem classificados do acervo
 * como "escolhido para você" seria propaganda, não curadoria.
 */
export function AfinidadeAferida() {
  const { data, isLoading, isError } = useRecomendados();

  // Enquanto não há perfil, a faixa não existe. Explicar que "faltam filmes
  // para calibrar" no meio da home seria pedir desculpa por uma ausência que
  // o usuário não notou.
  if (isLoading || isError || !data?.has_profile || !data.results?.length) {
    return null;
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-10%' }}
      transition={{ duration: 0.9, ease: FINE_ART_EASE }}
      style={{ padding: '96px 72px 40px', borderTop: '1px solid rgba(86,84,80,0.25)' }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 40,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: '9px',
              color: 'var(--m3)',
              letterSpacing: '0.2em',
              marginBottom: 14,
            }}
          >
            // AFINIDADE AFERIDA
          </div>
          <h2
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: '2.1rem',
              fontWeight: 300,
              color: 'var(--film)',
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            Deduzido do seu percurso
          </h2>
        </div>

        <Link
          href="/library"
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: '9px',
            color: 'var(--m3)',
            letterSpacing: '0.2em',
            textDecoration: 'none',
          }}
        >
          VER ACERVO →
        </Link>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 28,
        }}
      >
        {data.results.slice(0, 12).map((filme, i) => (
          <MovieCard
            key={filme.id}
            id={filme.id as string}
            title={filme.title}
            year={filme.year ? String(filme.year) : undefined}
            imageUrl={filme.poster_url ?? ''}
            watched={filme.watched}
            index={i}
          />
        ))}
      </div>
    </motion.section>
  );
}
