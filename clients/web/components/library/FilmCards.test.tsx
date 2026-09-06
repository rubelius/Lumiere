import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FilmGridCard, FilmRow } from './FilmCards';

const roteador = { push: vi.fn() };

function filme(overrides: Record<string, unknown> = {}) {
  return {
    id: 'abc-123',
    number: '001',
    title: 'Stalker',
    year: '1979',
    img: '/poster.jpg',
    backgroundSrc: '/bg.jpg',
    director: 'Andrei Tarkovsky',
    qualities: ['DISPONÍVEL', 'REMUX 2160p'],
    runtime: '2h 42m',
    synopsis: 'Uma expedição à Zona.',
    watched: false,
    ...overrides,
  };
}

describe('card em grade do acervo', () => {
  it('marca o filme já assistido de forma visível em repouso', () => {
    // As etiquetas de disponibilidade vivem no overlay que só aparece no
    // hover. Um indicador de assistido ali seria invisível justamente quando
    // o usuário varre a grade procurando o que ainda não viu.
    render(
      <FilmGridCard film={filme({ watched: true })} router={roteador}
                    setExpandedId={() => {}} onHover={() => {}} />,
    );
    expect(screen.getByLabelText('Já projetado')).toBeInTheDocument();
  });

  it('não marca o que ainda não foi visto', () => {
    render(
      <FilmGridCard film={filme()} router={roteador}
                    setExpandedId={() => {}} onHover={() => {}} />,
    );
    expect(screen.queryByLabelText('Já projetado')).not.toBeInTheDocument();
  });

  it('mostra o título', () => {
    render(
      <FilmGridCard film={filme()} router={roteador}
                    setExpandedId={() => {}} onHover={() => {}} />,
    );
    expect(screen.getByText('Stalker')).toBeInTheDocument();
  });
});

describe('linha da lista do acervo', () => {
  it('marca o assistido mesmo sem pôster em repouso', () => {
    // A lista não mostra pôster até o hover, então o sinal vai junto do
    // número — que é o que o olho percorre ao descer a coluna.
    render(
      <FilmRow film={filme({ watched: true })} isHovered={false} isDimmed={false}
               isExpanded={false} onHover={() => {}} onClick={() => {}} router={roteador} />,
    );
    expect(screen.getByLabelText('Já projetado')).toBeInTheDocument();
  });

  it('não marca o que ainda não foi visto', () => {
    render(
      <FilmRow film={filme()} isHovered={false} isDimmed={false}
               isExpanded={false} onHover={() => {}} onClick={() => {}} router={roteador} />,
    );
    expect(screen.queryByLabelText('Já projetado')).not.toBeInTheDocument();
  });
});
