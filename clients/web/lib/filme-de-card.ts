/**
 * A forma que os cards do acervo consomem.
 *
 * Estava declarada três vezes — em app/library/page.tsx, em app/search/page.tsx
 * e em components/library/FilmCards.tsx —, byte a byte igual nas três, e cada
 * tela montava a sua por projeção manual de campo em campo. Campo novo vindo
 * da API era descartado em silêncio por qualquer projeção que esquecesse de
 * incluí-lo, sem erro de tipo, porque as três cópias também precisariam ser
 * atualizadas para o compilador reclamar.
 *
 * Uma definição só: acrescentar um campo aqui quebra o build em toda projeção
 * que ainda não o produz, que é exatamente o aviso que faltava.
 */
export interface FilmeDeCard {
  id: string | number;
  number: string;
  title: string;
  year: string;
  img: string;
  backgroundSrc: string;
  director: string;
  qualities: string[];
  runtime: string;
  synopsis: string;
  /** Se este usuário já assistiu. Vem de `watched` na API. */
  watched: boolean;
}

/** Compatibilidade com o nome antigo, usado nas props dos componentes. */
export type Movie = FilmeDeCard;
