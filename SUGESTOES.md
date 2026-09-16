# Sugestões para o Lumière

Levantadas em 2026-09-16, a pedido. São 29 de estética e 28 de
UI/UX — o pedido era 20 de cada.

**Como ler:** cada uma diz ONDE entra (tela e arquivo), POR QUE melhora para
quem usa, e COMO, com detalhe suficiente para implementar sem redescobrir.
Estão ordenadas por custo, do mais barato ao mais caro, porque o barato
primeiro é o que faz a tela mudar de cara num fim de semana.

**O que NÃO está aqui:** nada que já exista, e nada que dependa de dado que o
acervo não tem. `themes` e `moods` estão vazios em 100% dos 25.908 filmes, e
por isso nenhuma sugestão fala em "climas". As que dependem de dado citam o
número medido.

Nenhuma destas foi implementada. Elas não estão no BACKLOG.md de propósito: o
backlog é o que está decidido, e isto é o que está proposto.

---

## Estética

A régua: o Lumière quer parecer uma cinemateca, não um catálogo de streaming.

### 1. Louros de festival estão invisíveis  ·  custo baixo
**Onde:** Ficha do filme, coluna esquerda — clients/web/components/movie/FestivalLaurels.tsx:94-105, montado por clients/web/components/movie/MovieSidebar.tsx:143
**Por quê:** 5.709 filmes (22,0% do acervo) têm premiação. Hoje o nome do prêmio sai em `text-slate-800` (#1E293B) sobre fundo #080806 — contraste 1,15:1, praticamente invisível — e o louro em `text-yellow-500/90` (#EAB308), um amarelo saturado de Tailwind que não é o --gold (#BF8F3C). Os `dark:` que consertariam isso nunca entram: o <html> em app/layout.tsx:14 não tem className="dark" e globals.css:105 define `@custom-variant dark (&:is(.dark *))`. O elemento mais 'cinemateca' que o acervo possui está apagado.
**Como:** Trocar `text-yellow-500/90 dark:text-yellow-600` por `color: var(--gold)`; `text-slate-800 dark:text-slate-200` por --film em DM Mono 10px / 0,18em; `text-slate-500` por --m3 em 9px. O botão de expandir perde `rounded-full` e ganha filete de 1px em --m4. Reduzir o ícone de 96px para 64px: seis louros a 96px não cabem numa coluna de 320px (MovieSidebar usa width 320).

### 2. Obras correlatas falam outro sistema de design  ·  custo baixo
**Onde:** Rodapé de toda ficha de filme — clients/web/components/ui/movie-card.tsx:112-186, usado em clients/web/app/movie/[id]/MovieClient.tsx (seção OBRAS CORRELATAS IDENTIFICADAS)
**Por quê:** É a última coisa que se vê em cada filme e é a única grade do produto com `rounded-xl` (12px, contra --radius de 3px), placeholder `bg-neutral-200` (#E5E5E5, cinza CLARO), `animate-pulse`, e título em `font-heading text-lg font-semibold text-white` — sans seminegrito branco, enquanto todo o resto do produto titula em Cormorant. `font-heading`, `text-accent-500` e `primary-400` sequer existem no @theme de globals.css: caem em fallback silencioso.
**Como:** Reescrever o interior: aspect 2/3, borderRadius 0, borda 1px rgba(237,232,220,0.05) que vai a var(--gold) no hover, placeholder var(--void) com 'SEM PÔSTER' em DM Mono 8px --m3 (já existe o caso, 758 filmes sem poster), título em Cormorant 1.5rem --film, ano em DM Mono 9px --m3. Trocar `animate-pulse` por fade de opacidade 0→1 em 600ms com FINE_ART_EASE. Remover `drop-shadow-lg` e os dois `bg-linear-to-*`.

### 3. O grão que oito telas pedem não existe  ·  custo baixo
**Onde:** clients/web/app/library/page.tsx:156, search/page.tsx:214, settings/page.tsx:94, profile/page.tsx:52, party/page.tsx:215, session/page.tsx:427, login/page.tsx:63, player/page.tsx:602
**Por quê:** As oito telas renderizam `<div className="fixed inset-0 bg-noise …">` e `bg-noise` NÃO está definido em app/globals.css nem em nenhum outro lugar do projeto (medido: 8 usos, 0 definições). São oito divs vazios ocupando a tela inteira em z-50. O único grão real do produto é o canvas de MotionShell — a textura que essas telas acham que estão aplicando nunca chegou.
**Como:** Decidir uma coisa só. Ou definir `.bg-noise` em globals.css com o SVG feTurbulence tileado em 128×128 e `background-repeat: repeat` (o padrão já está escrito no `body`, globals.css:190) — e então baixar a opacidade do canvas, porque dois grãos de frequências diferentes sobrepostos dão moiré. Ou apagar os oito divs e assumir o canvas como fonte única. A segunda é mais honesta e mais barata.

### 4. Grão a 24 quadros por segundo, não a 60  ·  custo baixo
**Onde:** clients/web/components/system/MotionShell.tsx, função GrainCanvas (presente em todas as rotas via app/layout.tsx:25)
**Por quê:** O ruído é regerado a cada requestAnimationFrame: num monitor de 2560×1440 são 3,7 milhões de pixels reescritos 60 vezes por segundo, 14,7 MB de ImageData por quadro. Grão de película cintila a 24q/s; a 60 ele vira chuvisco eletrônico — a textura de vídeo, não a de filme. O produto inteiro está por baixo dessa camada.
**Como:** Guardar o timestamp do último desenho e só redesenhar quando passaram ≥41,7ms: `if (ts - last < 41.7) { frame.current = requestAnimationFrame(draw); return }`. Dois ganhos no mesmo commit — a cadência vira a do meio e o custo cai 60%. Variante ainda melhor: gerar 4 quadros de ruído uma vez, guardá-los em ImageBitmap e alterná-los em ciclo a 24q/s, que é literalmente como grão de película se comporta.

### 5. Quatro cores de gênero no maior elemento do site  ·  custo baixo
**Onde:** Hero da home — clients/web/app/page.tsx:38-47 (getCinematicColor), consumido em components/home/HeroProgramme.tsx:119, 120, 158 e 177
**Por quê:** A função devolve #4A7A8C (azul), #8C3A3A (vermelho), #A87A8C (rosa) e #5E8872 (verde) conforme o gênero, e essas quatro cores pintam o filete, o número do programa, a duração e o BOTÃO PRIMÁRIO do hero — o elemento mais visível do produto inteiro. O dourado deveria ser o único acento; aqui ele é simplesmente substituído. Um cartaz de festival não muda de tinta conforme o gênero do filme.
**Como:** Apagar getCinematicColor e passar `accentColor = 'var(--gold)'` fixo (app/page.tsx:153). Se a variação por obra for desejada, ela tem que vir da imagem e não do rótulo: amostrar a luminância média do backdrop e mexer apenas na temperatura do gradiente de fundo (`linear-gradient(to right, var(--bg) 15%, …)`, HeroProgramme.tsx:110) — nunca na tinta do botão, do filete ou do número.

### 6. OFFLINE em dourado parece um prêmio  ·  custo baixo
**Onde:** Overlay de hover do card da grade — clients/web/components/library/FilmCards.tsx:182-188, alimentado por lib/disponibilidade.ts:31
**Por quê:** As etiquetas são DISPONÍVEL / UM CLIQUE / PLEX / OFFLINE, e as quatro são renderizadas com o mesmo `border: 1px solid rgba(191,143,60,0.4)` e `color: var(--gold)`. Medido: 185 filmes (0,7%) têm ao menos uma cópia e apenas 4 têm `available_instantly`. Ou seja, em 99,3% do acervo a única marca dourada do card diz OFFLINE — o acento mais precioso da identidade aplicado à ausência.
**Como:** Separar tinta por significado, sem inventar cor nova: DISPONÍVEL e UM CLIQUE em --gold com borda --gold; PLEX em --m2 com borda rgba(237,232,220,0.12); OFFLINE some — ausência não precisa de selo, e a falta do selo já é o sinal. Assim o dourado volta a significar 'isto se pode ver agora', que é a única coisa que ele deveria significar num card.

### 7. Pesos tipográficos pedidos e nunca carregados  ·  custo baixo
**Onde:** components/system/MotionShell.tsx:72 (a marca LUMIÈRE), components/home/HeroProgramme.tsx:178 (botão PROJETAR), components/home/Sections.tsx:341 e :399 (ADMIT ONE e o número do ingresso), app/movie/[id]/MovieClient.tsx:310, app/party/page.tsx:379/578/655, components/profile/ProfileWidgets.tsx:511/551, app/session/page.tsx:584
**Por quê:** app/layout.tsx:19 carrega Cormorant 300/400/600, DM Mono 300/400/500 e DM Sans 300/400. O código pede DM Mono 'bold' (700) em 6 lugares, DM Mono 600 em 2, Cormorant 700 em 1 e Cormorant 500 em 3 — inclusive na palavra LUMIÈRE, a marca. Nenhum desses pesos existe: o navegador ou sintetiza (engorda o traço artificialmente, com serifas deformadas) ou cai para o mais próximo. Traço sintetizado é exatamente o que separa um livro de arte de um PDF.
**Como:** Reescrever para pesos reais, que é melhor do que carregar mais arquivos: LUMIÈRE em Cormorant 600, ADMIT ONE em Cormorant 600, o número do ingresso em Cormorant 400, botões em DM Mono 500, chips de gênero em DM Mono 400 (ali a ênfase já vem da caixa alta e do tracking de 0,2em — o peso não acrescenta nada além de borrão).

### 8. O display fica mais leve quanto maior  ·  custo baixo
**Onde:** app/movie/[id]/MovieClient.tsx:245 (clamp 7-14rem), components/home/HeroProgramme.tsx:133 (clamp 4-9rem), app/library/page.tsx (4.5rem), app/settings/page.tsx e app/session/page.tsx (clamp 4-5.5rem), components/profile/ProfileWidgets.tsx (4.5rem)
**Por quê:** Todos usam Cormorant 400. O peso 300 está carregado e é usado em apenas 5 lugares no produto inteiro. Na tipografia de livro o peso desce conforme o corpo sobe: um garamond 400 a 224px tem hastes grossas demais e perde a delicadeza que é a razão de escolher garamond. É o ajuste que faz uma página parecer composta, e não ampliada.
**Como:** Regra única, aplicada nos seis títulos de página e no título da ficha: `fontWeight: 300` quando o corpo for ≥4rem; 400 entre 1,5 e 4rem; 400 abaixo. Nada mais muda — nem cor, nem tracking, nem espaço.

### 9. O título da ficha não cabe em 28% do acervo  ·  custo baixo
**Onde:** clients/web/app/movie/[id]/MovieClient.tsx:245
**Por quê:** `fontSize: clamp(7rem, 14vw, 14rem)` com `lineHeight: 0.85` numa coluna de maxWidth 1000px. Medido no acervo: 7.361 filmes (28,4%) têm título com mais de 20 caracteres, 2.134 passam de 30, a média é 17,3 e o maior tem 204 caracteres. A 224px, um título de 21 caracteres precisa de cerca de 1.900px: quebra em três linhas de caixas de 190px, e as descidas de uma linha encostam nas ascendentes da seguinte.
**Como:** Escalonar pelo comprimento do título, não pela viewport: ≤12 caracteres → clamp(6rem, 12vw, 12rem); 13-20 → clamp(4rem, 8vw, 8rem); 21-35 → clamp(3rem, 5vw, 5rem); >35 → 2.5rem. E subir lineHeight de 0,85 para 0,92 nos dois últimos degraus — 0,85 só funciona em título de uma linha, que é a única situação para a qual ele foi escolhido.

### 10. Linha de sinopse com 140 caracteres  ·  custo baixo
**Onde:** Hover das linhas da home — components/home/FilmProgramme.tsx (bloco de sinopse, `maxWidth: 1120`); versão do acervo em components/library/FilmCards.tsx:94 (`maxWidth: 720`)
**Por quê:** A 1,2rem (19,2px) em Cormorant itálico, 1120px dão cerca de 140 caracteres por linha; 720px dão cerca de 90. A medida confortável de leitura é 45-75. O olho perde a linha no retorno — e é justamente o texto que a interface revela com mais cerimônia (0,9s de animação, com máscara e blur).
**Como:** Trocar `maxWidth: 1120` e `maxWidth: 720` por `maxWidth: '62ch'`, que resolve os dois e acompanha o corpo se ele mudar. No mesmo bloco, baixar lineHeight de 1,6 para 1,45: 1,6 num itálico de 19px abre buracos brancos entre as linhas e desfia o parágrafo.

### 11. O entrelinhamento da sinopse da ficha  ·  custo baixo
**Onde:** clients/web/app/movie/[id]/MovieClient.tsx:319-329
**Por quê:** 2rem com lineHeight 1,6 são 51px de entrelinha num serifado display — o parágrafo vira linhas soltas em vez de bloco. E o clamp de 3 linhas corta no meio da frase, sem reticências, com o botão [ EXPANDIR REGISTRO ] a 24px de distância. 98,8% dos filmes têm overview, então esse é o parágrafo mais visto do produto.
**Como:** lineHeight 1,32 e maxWidth '58ch' (hoje 800px, que dá quase certo, mas em ch acompanha o corpo). O clamp passa de 3 para 4 linhas e ganha `maskImage: linear-gradient(to bottom, black 70%, transparent 100%)`: o texto se apaga em vez de ser decepado, que é a diferença entre um corte editorial e um `overflow: hidden`.

### 12. Duas scanlines de passos diferentes na mesma tela  ·  custo baixo
**Onde:** components/system/MotionShell.tsx (camada 1: passo 4px, rgba(4,4,2,0.04)) e components/home/Sections.tsx:125-129 (passo 3px, rgba(4,4,2,0.08), dentro do visor do NowProjecting)
**Por quê:** A camada global cobre a tela inteira; o visor do 'em projeção agora' põe outra por cima, com passo e opacidade diferentes. Duas grades de 1px quase alinhadas produzem moiré — faixas que nadam quando a página rola. É o artefato que denuncia 'efeito aplicado por cima' em vez de 'textura do meio'.
**Como:** A opção forte: remover a scanline global de MotionShell e manter apenas a do visor. A linha de varredura passa a significar alguma coisa — 'isto aqui é uma imagem projetada' — em vez de ser papel de parede. A opção conservadora: manter a global, remover a do visor, e igualar passo (4px) e opacidade (0,04). O que não pode continuar é ter as duas.

### 13. O número do card é um contador de linha  ·  custo baixo
**Onde:** app/library/page.tsx:80 e app/search/page.tsx:144, renderizado em components/library/FilmCards.tsx:149 como `[{film.number}]`
**Por quê:** `String((page-1)*20 + index + 1).padStart(3,'0')` é a posição na página carregada: muda quando se filtra, muda quando se rola, reinicia em 001. Parece número de catálogo e não é — e um número de catálogo falso é pior que nenhum. Enquanto isso `ranking_current` está preenchido em 25.908 de 25.908 filmes, com valores todos distintos de 1 a 26.551, e JÁ chega ao cliente (backend/apps/movies/serializers.py:75).
**Como:** Imprimir `movie.ranking_current` com 5 dígitos — `#00042`, `#26551` — em DM Mono 10px --m4, virando --gold no hover. Um número estável, idêntico em qualquer tela, é metade do que faz um acervo parecer catalogado em vez de listado. Acrescentar o campo a FilmeDeCard (lib/filme-de-card.ts): o build acusa as três projeções que precisam mudar.

### 14. A linha de crédito que o card joga fora  ·  custo baixo
**Onde:** components/library/FilmCards.tsx:199-201 (grade) e :114-117 (lista)
**Por quê:** O card imprime apenas `DIRETOR // ANO`. A listagem já recebe do servidor, sem nenhuma consulta nova: `color` (100%), `country` (100%), `cinematographer` (72,7% = 18.845 filmes), `composer` (52,0%), `mpaa_rating` (40,0%), `collection_name`, `length_minutes`. A ficha de uma cinemateca é exatamente essa linha de créditos — é ela que separa um catálogo de um mural de capas.
**Como:** Duas linhas sob o título, em DM Mono 10px / 0,14em: primeira `DIRETOR`; segunda `PAÍS · ANO · DURAÇÃO · P&B|COR`, com os separadores em --m4 e o ano em --m3. A fotografia entra como terceira linha só no hover — `FOT. ROGER DEAKINS`, em --gold-deep — o crédito que só um catálogo de cinemateca traz, aparecendo quando alguém demora sobre a obra.

### 15. Curtas não são "0h 14m"  ·  custo baixo
**Onde:** app/library/page.tsx:73-80, app/search/page.tsx:139-151 e app/page.tsx:106-110 (getRuntimeStr)
**Por quê:** 3.321 filmes (12,8%) têm menos de 45 minutos e saem como '0h 14m' — a hora zero é ruído puro. E os 85 filmes sem duração saem como '--h --m' na biblioteca e 'Duração desconhecida' na home: duas frases diferentes para a mesma ausência, nas duas telas que se veem em sequência. Um programa de cinemateca nomeia o formato.
**Como:** Uma função em lib/: <45min → `14 MIN · CURTA`; 45-70 → `62 MIN · MÉDIA`; ≥70 → `2H 07`; nulo → `DURAÇÃO NÃO REGISTRADA` em --m4. Igual nas três telas. O `·` fica em --m4 e o rótulo do formato em --m3, um degrau abaixo do número — hierarquia dentro da própria linha.

### 16. Chips de gênero: blocos creme sólidos  ·  custo baixo
**Onde:** clients/web/app/movie/[id]/MovieClient.tsx:307-317
**Por quê:** `backgroundColor: 'var(--film)'`, `color: 'var(--void)'`, `fontWeight: 'bold'` — blocos cor de papel, opacos, na segunda dobra da ficha. Sobre #080806 eles são o elemento de maior contraste da tela inteira, acima do próprio título do filme. No hover viram `var(--gold)` sólido com scale 1,1. E os gêneros são o metadado MENOS específico do acervo: 25 valores para 24.922 filmes, média de 1,96 por filme. O peso visual está invertido em relação ao peso informativo.
**Como:** Inverter: fundo transparente, borda 1px rgba(237,232,220,0.12), texto --m2 em DM Mono 10px / 0,16em, peso 400. No hover só a borda vai a --gold e o texto a --film, sem scale. E filtrar os seis valores de TV em inglês que existem no vocabulário — 'Sci-Fi & Fantasy' (13), 'War & Politics' (7), 'Action & Adventure' (6), 'Kids' (4), 'Soap' (2), 'Reality' (1) — ou eles aparecem em inglês no meio dos chips em português.

### 17. Estados vazios que não soam a erro  ·  custo baixo
**Onde:** clients/web/components/movie/MissingData.tsx, usado 4× na ficha (elenco, especificações, galeria, recomendações)
**Por quê:** Borda tracejada, ícone AlertCircle e `[ REGISTRO INCOMPLETO: "ELENCO" NÃO LOCALIZADO NO BANCO DE DADOS ]`. Para os 2.103 filmes sem elenco, e para a maioria sem captura óptica, a ficha exibe até quatro caixas de alerta empilhadas — o filme parece defeituoso, e o acervo parece quebrado. Numa cinemateca, 'não consta' é uma anotação a lápis na ficha, não um alarme.
**Como:** Sem caixa, sem borda tracejada, sem ícone: apenas o rótulo da seção seguido de uma linha em Cormorant itálico 1,25rem em --m3 — 'Elenco não registrado neste exemplar.' — e um filete de 1px em --m5 ocupando a largura, para a seção continuar existindo no ritmo vertical da página. O tom muda de 'falha de sistema' para 'lacuna do arquivo', que além de mais bonito é mais verdadeiro.

### 18. Uma escada de tratamento de imagem, não nove  ·  custo medio
**Onde:** Produto inteiro. Medido: grayscale em 9 intensidades — 100% (17×), 80%, 70%, 60% (6×), 50%, 35% (2×), 30% (2×), 25% (2×), 0% (2×)
**Por quê:** Cada superfície inventou a sua. O mesmo pôster é 35% na grade do acervo (FilmCards.tsx:163), 25% no hover da lista (FilmProgramme.tsx), 60% no eco de fundo (library/page.tsx e search/page.tsx), 100% no hero da ficha (MovieHero.tsx:24), 80% no SessionRow (Sections.tsx). O olho lê isso como descuido, não como intenção — e é o oposto da impressão de 'objeto caro', que vem de tudo obedecer a uma mesma regra.
**Como:** Três tokens em globals.css e nada mais: `--img-arquivo: grayscale(100%) contrast(1.1)` (fundos, ecos, planos de hover), `--img-consulta: grayscale(55%) saturate(0.9)` (pôster em repouso na grade), `--img-projecao: grayscale(0%) contrast(1.05)` (hover, foco, ficha aberta). Substituir os 33 filtros inline por `var()`. A regra fica dizível numa frase: quanto mais perto de projetar, mais cor.

### 19. Preto e branco vira dado, não estilo  ·  custo medio
**Onde:** Grade do acervo e da busca — clients/web/components/library/FilmCards.tsx:161-164; linha técnica do card, FilmCards.tsx:199-201
**Por quê:** 6.482 filmes (25,0%) têm `color = 'BW'` e 819 têm 'Col-BW'. Hoje a grade dessatura todos igualmente: um Bergman em P&B recebe grayscale(35%) como se houvesse cor a tirar, e no hover 'ganha cor' que não existe — o efeito não acontece, só o custo. O campo `color` está 100% preenchido (25.908/25.908) e JÁ chega ao cliente pelo MovieListSerializer (backend/apps/movies/serializers.py:87).
**Como:** Acrescentar `color` a FilmeDeCard (lib/filme-de-card.ts — arquivo único, o build acusa as três projeções que faltarem). No FilmGridCard, se `film.color === 'BW'`, pular grayscale e aplicar só `contrast(1.08)`; o hover muda apenas contraste. E imprimir P&B / COR / P&B + COR na linha técnica, em DM Mono 9px --m4 — é a informação que a ficha de qualquer cinemateca traz e que o acervo já tem de graça.

### 20. A mesma etiqueta de qualidade tem cinco desenhos  ·  custo medio
**Onde:** components/home/FilmProgramme.tsx (QualityDots, ~linha 95), components/library/FilmCards.tsx:184, components/home/HeroProgramme.tsx:162, components/ui/movie-card.tsx:22-43, components/ui/quality-badge.tsx
**Por quê:** '4K', 'REMUX' e 'HDR' aparecem em cinco tratamentos diferentes: (a) cores próprias #5E8872 / #9E6858 / #7E6E9A / #607898, que NÃO são as da paleta (--sage #6B9E84, --terra #B87B5E, --violet #8E7FA8, --steel #6B8EA8); (b) tudo dourado com borda dourada; (c) tudo --film com borda neutra; (d) Tailwind `bg-[#8B5CF6]/10` e `text-error`; (e) o único correto — quality-badge.tsx, que usa as classes .badge-* da paleta — tem ZERO consumidores e ainda pede `fontFamily: 'Inter'`, fonte que o projeto não carrega. As sete classes .badge-* de globals.css:296-303 são, portanto, código morto: todo o sistema de cor de qualidade da paleta está fora do ar.
**Como:** Eleger quality-badge.tsx como o único, trocar 'Inter' por `var(--font-data)` e peso 600 por 500 (DM Mono 600 não é carregado), e substituir os quatro outros pelos seus usos. Nenhum CSS novo: as .badge-* já existem e já estão certas.

### 21. Um piso tipográfico para os rótulos técnicos  ·  custo medio
**Onde:** Produto inteiro. Medido: 191 usos de fontSize 9px, 73 de 10px, 60 de 8px, 5 de 7px, 4 de 8.5px
**Por quê:** DM Mono a 8px com 0,2em de tracking, em --m3 (#565450) sobre #080806, é uma mancha e não um texto. Um catálogo de cinemateca imprime a ficha técnica pequena, mas legível: a elegância vem do espaçamento e do tom, não de encolher até sumir. Hoje há sete tamanhos convivendo sem papel definido — o mesmo rótulo de seção aparece a 9px numa tela e a 11px na outra.
**Como:** Três papéis, três tamanhos, nada fora disso: RÓTULO DE SEÇÃO 11px / 0,22em / --gold; DADO TÉCNICO 10px / 0,14em / --m2; NOTA DE RODAPÉ 9px / 0,1em / --m3. Nada abaixo de 9px — sobem os 7px do rótulo 'NOTA' na tabela de cópias (MovieClient.tsx) e os 8px do AdmitOne (Sections.tsx). Editar em ordem de visibilidade: MovieClient, FilmCards, Sections, HeroProgramme.

### 22. O ouro deixa de brilhar e vira pigmento  ·  custo medio
**Onde:** 17 box-shadows dourados — components/system/MotionShell.tsx (barra ativa da nav, marca, ponto do rodapé), components/profile/ProfileWidgets.tsx (barras dos gráficos, scanline do avatar), components/movie/MovieSidebar.tsx:62, components/player/PlayerUI.tsx:108, app/login/page.tsx
**Por quê:** `boxShadow: '0 0 12px rgba(191,143,60,0.6)'` é néon — a linguagem de HUD de ficção científica, que é a referência mais distante possível de Criterion. Um cartaz de festival e uma capa de coleção usam ouro como TINTA e como FOLHA: opaco, aresta dura, no máximo uma sombra de 1px sugerindo relevo. Nunca como fonte de luz. Some-se a isso a `.glow-gold` de globals.css:315 (text-shadow de 40px), que felizmente ninguém usa.
**Como:** Remover todos os `0 0 Npx rgba(191,143,60,*)`. Onde o brilho marcava destaque, usar filete de 1px em --gold puro a 100% (e não a 60%): num fundo #080806 o contraste resolve sozinho. Onde a intenção era relevo de folha metálica, trocar por `boxShadow: '0 1px 0 rgba(0,0,0,0.6)'` e texto em --gold-light.

### 23. Nada cresce no hover  ·  custo medio
**Onde:** 36 ocorrências de `whileHover={{ scale }}` em 4 valores (1.02 ×7, 1.05 ×15, 1.1 ×9, 1.15 ×4) — MovieClient.tsx, MovieSidebar.tsx, ProfileWidgets.tsx, PlayerUI.tsx, library/page.tsx
**Por quê:** O próprio sistema já escreveu a regra e não a segue: globals.css:523 diz, em comentário, 'Interactive card — no scale, just opacity + border shift'. Crescer no hover é o gesto de card de SaaS e faz a interface parecer macia. Uma cinemateca responde mudando a TINTA e a LUZ, não o tamanho do objeto.
**Como:** Substituir cada scale por um de três gestos: (a) a borda de 1px passa de rgba(237,232,220,0.06) para var(--gold) em 300ms; (b) a imagem sobe um degrau na escada do item das imagens; (c) um filete dourado de 1px que cresce da esquerda em 200ms com FINE_ART_EASE — que é exatamente o que `.hover-underline` (globals.css:351) já implementa e ninguém usa. Manter scale apenas nos quatro botões circulares de ícone, onde ele lê como botão físico.

### 24. Menos coisas piscando ao mesmo tempo  ·  custo medio
**Onde:** 44 `repeat: Infinity` no cliente. Só a nav tem 4 (components/system/MotionShell.tsx: marca 4s, filete viajante 15s, barra ativa 3s, ponto do rodapé 4s), mais o canvas de grão. app/session/page.tsx tem 9
**Por quê:** Em qualquer tela da home há hoje de 5 a 8 laços infinitos simultâneos, e nenhum deles comunica coisa alguma. O efeito não é 'vida ambiente' — é inquietação. Numa sala de projeção o que respira é a luz do projetor; o resto está absolutamente parado, e é essa imobilidade que dá a impressão de objeto caro.
**Como:** Regra de um laço ambiente por tela, e ele é o grão. Apagar as 4 pulsações da nav, a do rodapé da home (app/page.tsx:369), a da lâmpada do NowProjecting (Sections.tsx:114) e a scanline do avatar (ProfileWidgets.tsx). Manter o grão, o zoom de 20s do backdrop da ficha (MovieHero.tsx:19) e a marquise. E ligar `prefersReducedMotion()` — a função existe em lib/motion.ts:335 e não é chamada em lugar nenhum do produto.

### 25. Uma única margem óptica esquerda  ·  custo medio
**Onde:** Home — components/home/HeroProgramme.tsx:115 (padding '5vw 6vw') contra app/page.tsx:240 e :290 e components/home/FilmProgramme.tsx (padding '80px 72px')
**Por quê:** O texto do hero começa a 6vw da borda e o título 'Obras-Primas do Acervo', logo abaixo, começa a 72px fixos. A 1920px isso dá 115px contra 72px — 43px de desalinhamento na mesma rolagem; a 2560px, 82px. Pior dentro das linhas: o número fica em `left: 40` e o título em `left: 240` (FilmProgramme.tsx), somando 112px e 312px a partir da borda da seção. Nem o número nem o título se alinham ao cabeçalho da própria seção que os contém.
**Como:** Token `--gutter: clamp(40px, 5vw, 96px)` em globals.css; hero e seções passam a usá-lo. Dentro do FilmRow, trocar os `left` absolutos por `display: grid; grid-template-columns: 64px 150px 1fr auto` ancorada na mesma margem, para a coluna de números virar a mesma linha vertical do título da seção. É essa coincidência de eixos que faz uma página parecer diagramada e não montada.

### 26. A escala de espaços existe e ninguém usa  ·  custo medio
**Onde:** clients/web/app/globals.css:131-147 (--space-0 a --space-32) contra 18 valores distintos inline em app/ e components/
**Por quê:** Medido nos estilos inline: gaps e margens em 4, 5, 6, 8, 10, 12, 14, 16, 20, 24, 32, 40, 48, 56, 64, 80, 100 e 120. Seis desses (5, 6, 10, 14, 56, 100) não pertencem a escala nenhuma. O ritmo vertical de um livro de arte vem de todo espaço ser múltiplo de um mesmo módulo — quando ele não é, a página fica com a respiração irregular sem que se saiba dizer por quê.
**Como:** Adotar o módulo de 8 que a própria escala já implica: 8 / 16 / 24 / 32 / 48 / 64 / 96 / 128. Arredondar os seis valores fora da escala para o degrau mais próximo. Fazer tela a tela, começando pela ficha do filme, que tem os maiores saltos — marginBottom 120 convivendo com gap 16 na mesma coluna.

### 27. A tira de filme está escrita e não está na tela  ·  custo medio
**Onde:** clients/web/components/layout/FilmStripNav.tsx (359 linhas) — importado só por components/home/ScreenLayout.tsx, que não é importado por ninguém. A nav viva é NavStrip, em components/system/MotionShell.tsx:31-180
**Por quê:** O componente morto tem o conceito inteiro escrito: perfurações dos dois lados, filete dourado com gradiente vertical, rótulos rotacionados, 52px colapsado / 216px expandido. A nav que realmente aparece tem 4 perfurações no topo e 4 no rodapé de uma faixa de 42px, com o meio vazio. Oito furos agrupados nas pontas lêem como bolinhas decorativas; perfuração de 35mm é um ritmo CONTÍNUO — é o ritmo que faz a borda ser uma tira de filme e não uma barra lateral de vidro.
**Como:** No NavStrip, trocar os dois blocos de 4 por uma coluna única que percorre toda a altura: `repeating-linear-gradient` vertical de passo 14px (furo 8×5px em rgba(0,0,0,0.85) com a sombra interna que já existe, vão de 9px), encostado na borda esquerda, atrás dos links. E apagar FilmStripNav.tsx e ScreenLayout.tsx — senão o conceito continua existindo no arquivo errado e a próxima sessão o edita de novo.

### 28. Os gráficos do perfil são um painel de SaaS  ·  custo medio
**Onde:** clients/web/components/profile/ProfileWidgets.tsx, AnalyticsGrid (~linhas 120-230)
**Por quê:** Barras com topo arredondado (`borderTopLeftRadius: 4`, `borderTopRightRadius: 4`), trilho de 6px em rgba(237,232,220,0.1), preenchimento que vira --gold no hover com `boxShadow: '0 0 12px rgba(191,143,60,0.8)'` e `scaleX: 1.2`. É a referência proibida, literalmente — e numa tela que se apresenta como 'dossiê do operador'.
**Como:** Tirar a barra do papel de protagonista. Espectro de Gêneros vira tabela de duas colunas: gênero em Cormorant 1,5rem à esquerda, número em DM Mono à direita, e entre eles um filete pontilhado (leaders, como o sumário de um livro) cujo comprimento já codifica a proporção — nenhum retângulo preenchido. Dispersão Temporal vira uma régua horizontal com marcas de 1px por década, altura proporcional, sem raio e sem preenchimento: o desenho de um gráfico impresso, não renderizado. Zero cor além de --film e --gold.

### 29. O sistema de design está em CSS e não é consumido  ·  custo alto
**Onde:** clients/web/app/globals.css:227-560, contra 336 literais `'DM Mono', monospace` e 96 `'Cormorant Garamond', serif` escritos inline
**Por quê:** `.grain-soft`, `.vignette`, `.poster-card`, `.ticket-border`, `.img-cinema`, `.divider-film`, `.hover-underline`, `.card-interactive`, `.quality-ring`, `.progress-film`, `.section-heading`, `.index-number`, `.text-label` e `.text-display` têm ZERO usos fora do próprio arquivo. As variáveis de fonte aparecem 11 vezes; as strings literais, 432. Enquanto for assim, qualquer decisão estética nova exige achar e editar centenas de lugares — e é exatamente por isso que existem 9 grayscales, 5 etiquetas de qualidade e 18 valores de espaço.
**Como:** Não é reescrita de uma vez. Começar por três classes que já existem e cobrem muito: `.text-label` nos rótulos de seção (o padrão DM Mono 9px/0,2em/caixa alta/dourado aparece dezenas de vezes), `.divider-film` nas seis barras de seção com filete, `.vignette` nas caixas de imagem da ficha. Cada substituição apaga 4-6 propriedades inline e é mecânica. Depois disso, mudar o ar do produto inteiro passa a ser uma edição em globals.css.

---

## UI/UX

O contexto que muda tudo: 25.908 filmes e uma pessoa só usando. Descoberta importa mais que busca, e a tela precisa ter opinião — recomendar, provocar, lembrar — em vez de só listar.

### 1. Projeção às cegas: sorteio no acervo inteiro  ·  custo baixo
**Onde:** Home — clients/web/app/page.tsx (junto ao HeroProgramme) e/ou nav de MotionShell.tsx
**Por quê:** Hoje o único "acaso" da casa sorteia 10 de 20 filmes — 0,077% do acervo — e são sempre os mesmos 20 (ordering padrão ranking_current, PAGE_SIZE 20). Quem chega sem saber o que quer não tem nenhum botão que diga "escolha por mim". Com 25.908 filmes e uma pessoa só, o acaso é a ferramenta de descoberta mais barata que existe.
**Como:** Versão barata, sem backend: a listagem tem 1.296 páginas; `useMovies({ page: 1 + Math.floor(Math.random()*1296) })` e pegue um item ao acaso do resultado. Versão certa: uma action `@action(detail=False) def aleatorio` em backend/apps/movies/views.py usando `ORDER BY random() LIMIT 1` com filtros opcionais (não visto, duração máxima, década). O botão leva direto a /movie/<id> e mostra em uma linha por que aquele filme — posição TSPDT, ano, país. Trocar também o `sort(() => 0.5 - Math.random())` de page.tsx:72 por Fisher-Yates: o comparador aleatório enviesa (medido: rank 1 entra em 58,1% das cargas contra 44,5% do rank 13).

### 2. Em curso: mostrar todos, não só o primeiro  ·  custo baixo
**Onde:** Home — clients/web/app/page.tsx:65 (`continuar?.results?.[0]`) e components/library/FilmCards.tsx
**Por quê:** /api/movies/continue-watching/ devolve uma lista ordenada por -last_watched_at e a home joga fora tudo menos o índice 0. Quem começou três filmes vê um. E nas grades do acervo não há nenhum sinal de "parei em 47 min" — só o selo binário de assistido.
**Como:** Trocar NowProjecting por uma faixa que percorre `continuar.results` (o payload já traz progress_seconds, runtime_seconds e fraction). Nos cards, desenhar uma régua dourada de 2px na base do pôster com `width: fraction*100%` — `FilmeDeCard` em lib/filme-de-card.ts ganha um campo `fraction`, e MovieListSerializer já sabe responder por usuário (padrão de MarcaAssistidos em views.py:75).

### 3. Marcar como assistido à mão  ·  custo baixo
**Onde:** Ficha do filme — clients/web/components/movie/MovieSidebar.tsx; endpoint backend/apps/movies/views.py:300
**Por quê:** POST/DELETE /api/movies/{id}/watched/ existe, está testado e NÃO tem um único chamador no cliente (grep em todo clients/web: só a linha em types/api-generated.ts). Consequência medida: WatchHistory tem 4 linhas e 0 concluídas, UserTasteProfile tem 0 linhas, e por isso a faixa AfinidadeAferida retorna null e nunca apareceu na home. Numa cinemateca de 25.908 filmes onde a pessoa já viu centenas fora do Lumière, marcar à mão é o único caminho realista para o recomendador sair do zero.
**Como:** Um botão "[ JÁ PROJETADO ]" no MovieSidebar, ao lado de CATALOGAR, com useMutation em POST/DELETE `/api/movies/${id}/watched/` e invalidação de movieKeys.detail + das listas. O backend já chama `agenda_retreino_do_gosto` ao marcar. Vale um segundo ponto de entrada: marcar direto da grade (atalho no hover do card), porque só assim se marcam 50 filmes numa sentada.

### 4. A ficha lembra que você já viu  ·  custo baixo
**Onde:** Ficha do filme — clients/web/app/movie/[id]/MovieClient.tsx (faixa de metadados, perto de ano/duração/país)
**Por quê:** WatchHistory guarda first_watched_at, last_watched_at e times_watched, e a ficha não mostra nada disso. Abrir um filme e não saber se você o viu em 2019 ou nunca é o defeito central de um acervo pessoal grande — a memória é o que distingue uma cinemateca de um catálogo.
**Como:** Serializer de detalhe já entrega `watch_state`; renderizar uma linha monoespaçada "// VISTO EM 12.03.2024 · 2ª PROJEÇÃO" quando completed, e "// INTERROMPIDO AOS 47 MIN" quando progress_seconds > 0 e completed false. Zero backend novo.

### 5. "Tenho 90 minutos": filtrar por tempo  ·  custo baixo
**Onde:** Acervo — clients/web/components/library/LibraryFilters.tsx + backend/apps/movies/filters.py
**Por quê:** A decisão real de uma noite é "quanto tempo eu tenho", e o filtro só oferece Longas (≥60min) e Curtas (<60min). Medido: 10.602 filmes têm ≤90 min e 3.208 têm ≤40 min — dois recortes enormes e invisíveis. `length_minutes` está preenchido em 25.823 de 25.908.
**Como:** Em MovieFilter, `duracao_max = django_filters.NumberFilter(field_name='length_minutes', lookup_expr='lte')` e o mesmo para min. Na tela, um quarto grupo no painel de PARÂMETROS com opções fixas (ATÉ 40 MIN / ATÉ 90 MIN / ATÉ 2H / MAIS DE 3H) — mesmo componente FilterGroup, só um novo filterKey em FilterState. useMovies encaminha mais um parâmetro.

### 6. O acervo lê e escreve a URL  ·  custo baixo
**Onde:** Acervo — clients/web/app/library/page.tsx:23 (FilterState em useState, nunca lido da URL)
**Por quê:** Nenhum estado da tela vive na URL: voltar do filme perde tudo, não dá para marcar "Drama dos anos 70" nos favoritos do navegador, e o botão da home `href="/library?search=${topDirectorName}"` (page.tsx:328) leva a um acervo que ignora o parâmetro — o link está quebrado hoje. Botão Voltar do navegador também não desfaz filtro nenhum.
**Como:** `useSearchParams()` inicializa FilterState; cada mudança faz `router.replace('/library?' + new URLSearchParams(...), { scroll: false })`. Os nomes já existem: search, category, genres, decades, qualities, curations, viewMode. É o mesmo shape que useMovies já monta.

### 7. Mostrar o que está filtrado fora do painel  ·  custo baixo
**Onde:** Acervo — clients/web/components/library/LibraryFilters.tsx (barra superior, acima da grade)
**Por quê:** Os filtros marcados só são visíveis com o mega-menu aberto; fechado, a única pista é o botão PARÂMETROS mudar de cor. Com 25.908 filmes, chegar a uma grade de 12 resultados sem lembrar qual combinação causou isso é rotina — e o único remédio é reabrir o painel e reler quatro colunas de checkbox.
**Como:** Uma linha de chips monoespaçados abaixo da barra de comandos, um por valor ativo, cada um com ✕ que remove só aquele (já existe `toggleArrayFilter`). À direita, o resultado como frase: "312 de 25.908". O `data?.count` já vem na resposta.

### 8. Expor ordenação, inclusive "recém-chegados"  ·  custo baixo
**Onde:** Acervo — clients/web/components/library/LibraryFilters.tsx (ao lado de [GRADE]/[LISTA])
**Por quê:** O backend já aceita ordering em year, ranking_current, tmdb_rating e created_at (views.py:112), e a tela não oferece nenhum controle: tudo sai sempre por ranking TSPDT ascendente. Não há como perguntar "o que entrou no acervo esta semana" nem "o mais antigo que eu tenho" — e `created_at` é a única memória do próprio acervo.
**Como:** Um seletor de quatro opções que injeta `ordering` em UseMoviesParams e no `http.get`. Rótulos com opinião, não nomes de coluna: POSIÇÃO TSPDT / MAIS RECENTES NO ACERVO / MAIS ANTIGOS / MELHOR AVALIADOS. Um quinto item, ALEATÓRIO, precisa da action do item 1.

### 9. Cards viram links; morre o atraso de 800 ms  ·  custo baixo
**Onde:** clients/web/components/library/FilmCards.tsx:20 (FilmRow) e :136 (FilmGridCard) — usados por /library e /search
**Por quê:** Os cards são `motion.div` com onClick e `setTimeout(() => router.push(...), 800)`. Três consequências: não são focáveis nem acionáveis por teclado (Tab passa direto), não abrem em nova aba nem mostram o destino na barra de status, e todo clique custa 0,8 s de animação ANTES de a transição de página começar — somados aos 0,62 s de saída e 0,62 s de entrada do MotionShell, são mais de 2 s do clique até o conteúdo.
**Como:** Envolver o conteúdo do card num `<Link href={`/movie/${film.id}`}>` (display:block, textDecoration:none) e deixar a animação de expansão acontecer durante a navegação, não antes dela: o push sai no clique, o `exit` do AnimatePresence cuida do resto. Onde a expansão importar de fato, cortar o timeout para ~250 ms. Isso também dá foco de teclado de graça, que é a base do item de acessibilidade abaixo.

### 10. Pré-carregar a ficha no hover  ·  custo baixo
**Onde:** clients/web/components/library/FilmCards.tsx (handlers onMouseEnter já existem) e components/home/FilmProgramme.tsx
**Por quê:** Ambas as telas já detectam hover para desenhar o eco de fundo — a intenção de clicar é conhecida centenas de milissegundos antes do clique, e não é usada para nada. A ficha ainda faz o fetch do zero depois da transição.
**Como:** No mesmo onMouseEnter que seta `hoveredId`, chamar `router.prefetch('/movie/' + film.id)` e `queryClient.prefetchQuery({ queryKey: movieKeys.detail(id), queryFn: () => moviesApi.detail(id) })`. Uma linha em cada handler; movieKeys e moviesApi já estão importados no projeto.

### 11. Teclado no player  ·  custo baixo
**Onde:** Reprodução — clients/web/app/player/page.tsx e components/player/PlayerUI.tsx
**Por quê:** Medido: zero ocorrências de keydown/onKeyDown/KeyboardEvent nos dois arquivos. Não há espaço para pausar, seta para avançar, F para tela cheia, M para mudo, Esc para sair. O único jeito de sair é acertar o botão de 48px que só aparece quando os controles estão visíveis — num player que fica em tela cheia, no escuro, provavelmente longe do teclado.
**Como:** Um `useEffect` com listener em window: Space/K = togglePlay (já existe), ←/→ = `vaiPara(currentTime ∓ 10)` (já existe), Shift+←/→ = 60 s, ↑/↓ = volume, F = toggleFullscreen (já existe), M = toggleMute (já existe), C = cicla legenda (setLegendaAtiva já existe), Esc = handleBack. Todas as funções já estão escritas no arquivo; falta só o mapeamento. Guardar contra `e.target instanceof HTMLInputElement` e chamar `preventDefault` no Space.

### 12. Scroll infinito falha em silêncio  ·  custo baixo
**Onde:** Acervo e Busca — clients/web/app/library/page.tsx:105 e app/search/page.tsx:174 (IntersectionObserver)
**Por quê:** O observer só avança quando `data?.next` existe. Se a página 7 falhar por rede, a query fica sem data, `data?.next` vira undefined, `isFetching` volta a false — e a tela simplesmente para de carregar, sem spinner, sem mensagem, sem botão. O ramo de erro dessas telas só cobre a primeira página. A pessoa conclui que o acervo acabou nos 140 filmes que viu.
**Como:** Ler `isError` junto com `page > 1` no sentinela e desenhar ali uma linha "// FALHA AO CARREGAR A PÁGINA N" com um `[ TENTAR NOVAMENTE ]` que chama `refetch()`. Com useInfiniteQuery (item anterior) isso vem quase pronto via `isFetchingNextPage`/`isError`.

### 13. Foco visível, movimento reduzido, nav no teclado  ·  custo baixo
**Onde:** clients/web/app/globals.css; components/system/MotionShell.tsx (NavStrip); lib/motion.ts:335
**Por quê:** Três coisas medidas. (a) A nav só expande por onMouseEnter/onMouseLeave: quem navega por teclado nunca vê os rótulos, só os códigos 01..07. (b) `prefersReducedMotion()` está escrito em lib/motion.ts:335 e não tem um único consumidor, e globals.css não tem nenhuma regra `prefers-reduced-motion` — numa interface cujo clique custa 0,8 s de expansão, 1,2 s de fade e um canvas de grão redesenhado a 60 fps, isso importa. (c) Existe `.tv-focus:focus-visible` no CSS, mas o atributo usado nos componentes é `data-tv-focusable`, para o qual não há regra nenhuma: o foco é literalmente invisível fora dos três lugares que usam a classe certa.
**Como:** (a) Somar onFocus/onBlur com captura ao par de handlers do NavStrip, para que Tab abra a tira. (b) Um bloco `@media (prefers-reduced-motion: reduce)` em globals.css zerando durações, e um guard em MotionShell que não monta o GrainCanvas quando `prefersReducedMotion()` — a função já está pronta. (c) Uma regra global `:focus-visible { outline: 1px solid var(--gold); outline-offset: 2px }` e trocar `data-tv-focusable` por `className="tv-focus"` (ou acrescentar o seletor de atributo ao CSS). Junto com o item dos cards-como-link, isso torna a casa inteira percorrível sem mouse.

### 14. Home carrega em pedaços, não tudo ou nada  ·  custo baixo
**Onde:** Home — clients/web/app/page.tsx:131 (`if (isLoading || randomHeroMovies.length === 0)`)
**Por quê:** Uma única requisição lenta prende a tela inteira num "MONTANDO PROGRAMAÇÃO..." pulsante. Nada aparece — nem o cabeçalho, nem a nav de conteúdo, nem o que já veio do cache de continue-watching ou de archive-stats, que são chamadas independentes e costumam responder antes. E assim que a home passar a ter várias seções (itens 2 e 3), esse bloqueio total vira o gargalo de todas elas.
**Como:** Trocar o retorno antecipado por esqueletos por seção: o hero renderiza seu próprio estado de espera, cada faixa o seu, e as seções que já têm dado aparecem imediatamente. Os `viewport={{ once: true }}` do whileInView já fazem o resto entrar ao rolar. Enquanto o hero espera, ele pode mostrar o filme em curso, que vem de outra query.

### 15. Cada seção da home com pool próprio  ·  custo medio
**Onde:** Home — clients/web/app/page.tsx:67 (`useMovies({ page: 1 })`, única chamada de listagem da página)
**Por quê:** Hero, Obras-Primas, Próximas Projeções e Admit One são quatro recortes dos MESMOS 20 filmes. Em média 4 dos 8 cards de Obras-Primas também estão no hero. A home é literalmente idêntica a cada F5 — não há razão para voltar a ela.
**Como:** useMovies já aceita genres, decades, curations e category, e a queryKey já inclui todos: cada seção é uma chamada nova, sem hook novo. Concretamente: "Ganhadores de Festivais" (`category=Ganhadores de Festivais`, 3.575 filmes), "Um ano ao acaso" (`decades=1970s`, 3.169 filmes), "Os 100 mais bem ranqueados" via `useTopRatedMovies()` — que já existe em features/movies/hooks/useMovies.ts e não tem um único consumidor. Semeie as escolhas com a data (`new Date().toISOString().slice(0,10)`) para que a home mude de dia em dia e não a cada render.

### 16. Dar nota à obra  ·  custo medio
**Onde:** Ficha do filme — clients/web/app/movie/[id]/MovieClient.tsx (bloco da avaliação TMDB, hoje só leitura)
**Por quê:** WatchHistory.rating (FloatField) existe no modelo e nunca é escrito por nada. A ficha mostra a nota do TMDB com estrelas bonitas e não tem onde a dona do acervo registrar a dela — que é a única opinião que importa aqui, e o sinal mais forte que o perfil de gosto poderia receber.
**Como:** Ao lado de `renderStars(movie.tmdb_rating)`, uma segunda linha de estrelas editável rotulada // SUA AFERIÇÃO, gravando por PATCH numa action nova em MovieViewSet (mesma forma do `watched`: get_or_create do WatchHistory e `update_fields=['rating']`). O serializer da ficha já expõe `watch_state`; basta incluir rating. Depois, usar rating como peso no treino em apps/ml.

### 17. Facetas com contagem medida, não lista escrita à mão  ·  custo medio
**Onde:** Acervo — clients/web/components/library/LibraryFilters.tsx:32 e backend (action nova em MovieViewSet)
**Por quê:** Os oito gêneros do painel foram digitados à mão e dois não existem no banco: 'Ficção Científica' (o valor real é 'Ficção científica', 330 filmes como primary_genre) e 'Suspense' (o valor real é 'Thriller', 2.723 filmes) — clicar devolve zero. E os 25 gêneros que existem de verdade, como Documentário (3.990) e Faroeste, nem aparecem. Sem número ao lado, cada clique é uma aposta às cegas.
**Como:** Uma action `@action(detail=False, url_path='facetas')` que devolve `{genres: [{valor, n}], decades: [...], countries: [...]}` com um GROUP BY sobre os índices GIN que já existem em genres e keywords. O painel renderiza a resposta em vez do dicionário literal, e mostra "DRAMA · 13.854". Bônus honesto: esconder os 6 valores de TV em inglês que poluem a cauda ('Sci-Fi & Fantasy', 'Kids', 'Soap' — 33 filmes no total).

### 18. Paleta de comandos e folha de atalhos  ·  custo medio
**Onde:** clients/web/components/system/MotionShell.tsx (nível do layout); componentes órfãos ui/search-modal.tsx e ui/keyboard-shortcuts.tsx
**Por quê:** Existem dois componentes prontos que ninguém importa: keyboard-shortcuts.tsx lista ⌘K, ?, F, M e Space como se funcionassem — nenhum existe —, e search-modal.tsx tem uma lista de resultados inventada (L'Aventura, Solaris, Antonioni escritos à mão). Chegar à busca hoje exige mirar num item de 42px de uma nav que só abre no hover.
**Como:** Montar `<KeyboardShortcuts />` no MotionShell (ele já escuta '?' e Escape) depois de corrigir a lista para os atalhos que realmente passarem a existir. E trocar a lista falsa do search-modal por `useMovies({ search })` com debounce curto, montando-o no shell atrás de ⌘K / Ctrl+K e de '/' — a tela /search continua sendo o lugar de resultado longo, o modal é o salto rápido. Acrescentar G+A (acervo), G+H (home) se quiser ir além.

### 19. Voltar da ficha volta para onde você estava  ·  custo medio
**Onde:** Ficha — clients/web/app/movie/[id]/MovieClient.tsx (link "[ Retornar ao Acervo ]", hoje `href="/library"` fixo) e app/library/page.tsx
**Por quê:** O link é literal: vindo da home, da busca ou de uma faixa de recomendação, ele despeja a pessoa num acervo sem filtro nenhum. Pior, o acervo remonta do zero — `allMovies` e `page` são useState locais, então o scroll infinito volta à página 1. Quem tinha rolado até a página 7 de 1.296 perde tudo por abrir um filme.
**Como:** Duas partes. (a) Passar a origem na navegação (`/movie/123?de=/library?genres=Drama`) e usar esse valor no link de retorno, com /library como reserva; o player já provou o padrão ao ganhar `router.push(movieId ? \`/movie/${movieId}\` : '/')`. (b) Trocar o acumulador manual do acervo por `useInfiniteQuery` — o cache do React Query sobrevive à navegação, e aí voltar restaura as páginas já carregadas; guardar o scrollY em sessionStorage na saída e restaurá-lo na montagem.

### 20. "Nada encontrado" precisa de saída  ·  custo medio
**Onde:** Acervo — app/library/page.tsx:216; Busca — app/search/page.tsx:299
**Por quê:** As duas telas terminam em beco: "Nenhum registro encontrado para os parâmetros selecionados" e "Sinal não encontrado. Refine os parâmetros da busca". Nenhuma diz QUAL parâmetro zerou o resultado nem oferece um clique para afrouxá-lo — e com quatro grupos de filtro combináveis, chegar a zero é fácil (basta marcar 'Ficção Científica', que não existe no banco).
**Como:** No acervo: quando count for 0 e houver filtros, refazer a consulta sem cada grupo (são no máximo 4 chamadas paralelas, todas em índice) e mostrar "sem ESPECIFICAÇÕES seriam 1.204 obras — [ remover ]". Na busca: quando o motor híbrido devolver 0, oferecer os vizinhos por trigrama com limiar menor que o 0.12 atual (views.py:184) sob o rótulo "você quis dizer" — o `match_score` já está anotado no queryset.

### 21. Sugestões da busca viram atalhos clicáveis  ·  custo medio
**Onde:** Busca — clients/web/app/search/page.tsx:23 (SEARCH_SUGGESTIONS, 109 frases) 
**Por quê:** São 109 frases de curadoria — "Explore o 'Cinema Novo' brasileiro", "Trilhas de 'Ennio Morricone'" — e todas são pura decoração: giram a cada 4,5 s como placeholder fantasma e não há como clicar em nenhuma. É o melhor material de descoberta que a casa já escreveu, e ele expira antes de virar ação. Pior: várias prometem o que o motor não faz — 'Morricone' está em `composer` (107 filmes) e 'Deakins' em `cinematographer` (38), campos que a busca nem varre.
**Como:** Abaixo do input vazio, mostrar 6 sugestões estáticas como botões; clicar preenche a busca e dispara. Acrescentar o histórico das últimas 8 consultas com resultado (sessionStorage basta, é uma pessoa só). E fazer o motor varrer também `cinematographer`, `composer`, `writer` e `cast` (jsonb, 91,9% preenchido, buscável pelo operador de contenção) — sem isso metade das sugestões leva a zero resultados.

### 22. Página de diretor  ·  custo medio
**Onde:** Nova rota /director/[nome]; entradas em app/movie/[id]/MovieClient.tsx (o `<h3>` da DIREÇÃO) e nos cards
**Por quê:** 11.438 diretores distintos, 1.156 com 5 filmes ou mais e 389 com 10 ou mais (Brakhage 62, Godard 57, Ford 50, Hitchcock 43). O nome do diretor aparece em todas as telas — grade, lista, hero, ficha — e não é clicável em lugar nenhum. Explorar um acervo de cinemateca é, na prática, seguir autores.
**Como:** MovieFilter já expõe `director` em Meta.fields, então `/api/movies/?director=...` funciona hoje. A rota faz `useMovies({ director })`, ordena por ano e mostra a filmografia em linha do tempo, com contagem, décadas cobertas e quantos já foram vistos. Tornar o nome um Link em MovieClient.tsx e em FilmCards. Para a busca por nome parcial, replicar o GinIndex de trigrama que models.py:164 já declara sobre `title` no campo `director` — hoje ele não tem índice e a consulta faz Seq Scan de 290 ms.

### 23. Gêneros e palavras-chave clicáveis na ficha  ·  custo medio
**Onde:** Ficha — clients/web/app/movie/[id]/MovieClient.tsx (bloco `movie.genres.map`, com whileHover e nenhum link)
**Por quê:** As tags de gênero animam no hover e não levam a lugar nenhum — o gesto promete navegação e não entrega. E as keywords (19.298 filmes preenchidos, 21.439 valores distintos) não aparecem na ficha, apesar de serem onde mora o movimento artístico: 'film noir' 318 filmes, 'neo-noir' 191, 'japanese new wave' 24, 'german expressionism' 20, 'cinema novo' 8. É a dimensão mais interessante do acervo e ela está invisível.
**Como:** Cada gênero vira `<Link href={'/library?genres=' + encodeURIComponent(tag)}>` — depende do item 8 (acervo lendo a URL). Para keywords, acrescentar `keywords` como filtro em MovieFilter usando `keywords__overlap` (o índice GIN já existe) e renderizar na ficha as 8 mais raras do filme — raridade calculada pela contagem global, porque 'independent film' não diz nada e 'czech new wave' diz tudo.

### 24. País legível, e clicável  ·  custo medio
**Onde:** Ficha — app/movie/[id]/MovieClient.tsx (`movie.country?.toUpperCase()`); Home — app/page.tsx; backend/apps/movies/paises.py
**Por quê:** A ficha exibe o campo cru em caixa alta: "US", "FR", "XC". Medido: os dez valores mais comuns são US 8.346, FR 2.644, GB 2.106, JP 1.287 — e USA aparece separado com 558, o mesmo país contado duas vezes. Coproduções chegam como 'UK-Germany-Sweden-Belgium-USA'. Nenhum desses textos é legível nem navegável.
**Como:** paises.py já resolve isto: `para_codigo()` e `origens_distintas()` normalizam as 423 combinações cruas em 150 países, com apelidos para URSS, Tchecoslováquia e Alemanha Oriental — e já são usados em archive-stats (views.py:346). Expor um `country_label` no serializer usando a mesma função, mostrar "Estados Unidos · França" e transformar cada origem em link para o acervo filtrado. Uma seção "O acervo por geografia" na home nasce do mesmo dado.

### 25. Próximas Projeções ligada às sessões reais  ·  custo medio
**Onde:** Home — clients/web/app/page.tsx:192 (DYNAMIC_SESSIONS) e features/sessions/hooks/useSessoes.ts:26
**Por quê:** A seção não consulta nada: são duas linhas montadas no componente, e a segunda (S·002 "Descobertas Recentes", 4 filmes, 7h 10m, Sáb 20:00) é 100% literal — os mesmos números para sempre. A primeira sempre escolhe Orson Welles, porque os 20 filmes da página 1 têm 20 diretores distintos e o desempate cai no rank 1. Enquanto isso `useProximasSessoes()` (GET /api/sessions/upcoming/) existe, está tipado, e tem zero consumidores no projeto.
**Como:** Importar useProximasSessoes na home e renderizar as sessões de verdade. Quando a lista vier vazia — que é o caso hoje, CinemaSession não tem futuros —, o lugar não deve mentir: mostre "nenhuma sessão agendada" com um [ PROGRAMAR SESSÃO ] apontando para /session. CinemaSession já tem theme_genres, theme_countries, theme_decades, theme_directors e theme_keywords: é o dono legítimo desta seção.

### 26. Adicionar à sessão a partir da ficha  ·  custo medio
**Onde:** Ficha — clients/web/components/movie/MovieSidebar.tsx; modelos em backend/apps/user_sessions/models.py:133 (SessionMovie)
**Por quê:** Grep por "sess" em MovieClient.tsx e MovieSidebar.tsx: zero. A casa tem CinemaSession, SessionMovie, SessionParticipant, SessionInvite, SessionPoll — uma máquina de programar sessões inteira — e não há nenhum caminho do filme para a sessão. Montar uma mostra hoje exige sair do filme, ir a /session e procurar o título de novo.
**Como:** Um terceiro botão no MovieSidebar, "[ PROGRAMAR ]", que abre a lista de sessões em preparo (useSessaoRelevante já existe em features/sessions/hooks/useSessoes.ts) e faz POST para criar o SessionMovie, com a opção "nova sessão com este filme". O menu CATALOGAR, que já abre ali, é o lugar natural.

### 27. Preferências que sobrevivem à navegação  ·  custo medio
**Onde:** Acervo (viewMode), Configurações (aba ativa), Busca (viewMode); backend: User.preferences em apps/users
**Por quê:** Modo grade/lista, aba de configurações, filtros — tudo é useState e morre ao trocar de tela. O acervo abre sempre em GRADE, a busca sempre em LISTA, as configurações sempre em "Reprodução". Numa casa de um usuário só, que volta todo dia, não lembrar a preferência é gratuito e irritante. `User.preferences` é um JSONField já migrado (apps/users/migrations/0001_initial.py:121) que NUNCA foi lido nem escrito — 0 de 2 usuários com valor.
**Como:** Curto prazo, localStorage para o que é puramente visual (viewMode, aba) — uma linha por tela. Prazo certo, um par GET/PATCH `/api/users/preferences/` sobre o JSONField já existente, com um hook `usePreferencias()` no molde de useNotificacoes.ts. O mesmo campo é onde devem pousar os 13 controles de /settings que hoje não tocam o servidor (qualidade alvo, legendas, aparência), usando o vocabulário que release_search.py:41 já define: min_resolution, prefer_remux, require_advanced_audio, min_seeders.

### 28. Favoritos e Assistir Depois são botões mortos  ·  custo alto
**Onde:** Ficha — clients/web/components/movie/MovieSidebar.tsx, dropdown de CATALOGAR (os dois itens não têm onClick algum)
**Por quê:** O menu abre, os itens animam no hover e no tap, e clicar não faz absolutamente nada — não há handler nem modelo por trás (o backend tem WatchHistory e nada mais parecido com lista). Um controle que responde ao toque e não muda estado é pior que ausência: ensina que a interface mente. E "assistir depois" é exatamente a função que falta num acervo de 25.908 filmes, onde a maior parte da descoberta acontece longe da hora de assistir.
**Como:** Decidir uma das duas: remover os itens, ou implementá-los. Implementar é um modelo enxuto `MovieList(user, nome, slug)` + `MovieListItem(lista, movie, added_at)` em apps/movies, duas actions de add/remove, e uma entrada na nav ou no /profile para ver as listas. O botão "[ CATALOGAR ]" passa a mostrar quantas listas contêm o filme, e o estado atual vira ativo/inativo em vez de decorativo.
