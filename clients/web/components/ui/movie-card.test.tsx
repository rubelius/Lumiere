import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MovieCard } from './movie-card';

/**
 * A seção de obras correlatas lia `similar.id`, `similar.title` e
 * `similar.img` — campos que a API devolve dentro de `similar.movie`, não na
 * raiz. Tudo saía `undefined`: cards em branco com link para
 * `/movie/undefined`. Um `any` no map era o que impedia o TypeScript de
 * acusar, e o recomendador inteiro chegava à tela sem aparecer.
 *
 * Estes testes fixam o que um card precisa ter para não ser aquele card.
 */
describe('MovieCard', () => {
  it('mostra o título e leva para o filme certo', () => {
    render(<MovieCard id="abc-123" title="Stalker" year="1979" imageUrl="/p.jpg" />);

    expect(screen.getByText('Stalker')).toBeInTheDocument();
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/movie/abc-123');
  });

  it('nunca aponta para /movie/undefined', () => {
    // A forma exata do defeito: id ausente virava a string 'undefined' na URL.
    render(<MovieCard id="abc-123" title="Stalker" imageUrl="/p.jpg" />);
    expect(screen.getByRole('link').getAttribute('href')).not.toContain('undefined');
  });

  it('marca o filme já assistido', () => {
    render(<MovieCard id="a" title="Solaris" imageUrl="/p.jpg" watched />);
    expect(screen.getByLabelText('Já projetado')).toBeInTheDocument();
  });

  it('não marca o que ainda não foi visto', () => {
    render(<MovieCard id="a" title="Solaris" imageUrl="/p.jpg" />);
    expect(screen.queryByLabelText('Já projetado')).not.toBeInTheDocument();
  });

  it('descreve o pôster para quem usa leitor de tela', () => {
    render(<MovieCard id="a" title="Persona" year="1966" imageUrl="/p.jpg" />);
    expect(screen.getByAltText(/Persona/)).toBeInTheDocument();
  });
});
