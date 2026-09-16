# Backlog do Lumière

O que está decidido e ainda não construído. Cada item diz o que é, por que
importa e o que já se sabe sobre a dificuldade — para quem pegar não precisar
redescobrir.

## A home está morta, e dá para medir o quanto

**Pedido em 2026-09-16.** "Parece que são sempre os mesmos filmes na hero
section, sempre os mesmos nas seções abaixo, inclusive em próximas projeções."

Não parece: são. **A home inteira se alimenta de UMA requisição** —
`useMovies({ page: 1 })` em `app/page.tsx:67`, 20 filmes. Hero, Obras-Primas,
Próximas Projeções e Admit One são recortes desses mesmos 20, e o backend
ordena por `ranking_current` ascendente (`views.py:113`), que está preenchido
em 100% do acervo. A página 1 é, byte a byte, sempre a mesma.

Medido:

| | |
|---|---|
| Pool do hero | 20 de 25.908 filmes — **0,077% do acervo** |
| Obras-Primas | itens 1 a 8 da mesma ordenação, constantes |
| Sobreposição hero × obras-primas | ~4 dos 8, por construção |
| Próximas Projeções S·002 | **literal escrito à mão** em `page.tsx:192-207` |
| Próximas Projeções S·001 | "Foco: Orson Welles" — os 20 têm 20 diretores distintos, e o desempate sempre pega o rank 1 |

O sorteio do hero também usa `sort(() => 0.5 - Math.random())`, que não é
embaralhamento uniforme: medido em 20.000 tiragens, o rank 1 entra em 58,1% das
cargas contra 44,5% do rank 13. É o menor dos problemas — trocar por
Fisher-Yates não resolve nada enquanto o balde tiver 20 filmes.

**Cache não é a causa** (staleTime só evita refetch na mesma visita; F5 traz os
mesmos 20). **O backend não tem ordenação aleatória nem endpoint de destaques**:
`ordering_fields` só aceita year, ranking_current, tmdb_rating, created_at.

**O que existe e a home ignora:** `useProximasSessoes()` → `/api/sessions/upcoming/`
(hoje devolveria vazio — 0 sessões no banco); `/api/movies/{id}/recommendations/`
com `diversifica()` pronto; 1.295.400 linhas de `MovieSimilarity` cobrindo o
acervo inteiro; embeddings em 100% dos filmes.

## A home precisa ser maior que uma lista

**Pedido em 2026-09-16.** "Ela está muito simplona para o que o Lumière se
propõe a ser."

Antes de desenhar seções, foi medido o que HÁ para sustentá-las — uma seção sem
dado é outra maquete:

| campo | preenchido | distintos | serve para |
|---|---|---|---|
| `keywords` | 74,5% (19.298) | 21.439 | 1.373 com ≥20 filmes — faixas temáticas de verdade |
| `festivals` | 22,0% (5.709) | 1.482 prêmios | retrospectivas de festival |
| `cinematographer` | 72,7% | 6.321 | 394 com ≥10 filmes (Renato Berta 48) |
| `composer` | 52,0% | 5.075 | 234 com ≥10 (Morricone 107) |
| `director` | 100% | 11.438 | 389 com ≥10 (Brakhage 62, Godard 57, Ford 50) |
| `color` | 100% | Col 17.722 / BW 6.482 | recorte "só preto e branco" |
| `spoken_languages` | 95,8% | 146 idiomas | |
| curtas (<40min) | — | 3.166 | uma seção inteira |

**E os que NÃO servem, para ninguém tentar:** `themes` e `moods` estão
**vazios em 100% do acervo**; `countries` (ArrayField) também — o país vive em
`country`, texto cru com 423 combinações que `apps/movies/paises.py` já sabe
normalizar para 150.

## Uma tela de administração, com observabilidade de tudo

**Pedido em 2026-09-16.** A conta do usuário é admin e ele quer ver o projeto
inteiro: estatísticas, usuários, e tudo o mais.

Há material medido para sustentá-la: os volumes das tabelas, a saúde do motor
(`apps/core/motor.py` já responde workers, beat e último pulso), o estado do
rastreador de cópias (`apps/tasks/precarga.py` — fila, vencidos, quando cada
filme foi varrido), as tasks periódicas, e as integrações.

**Cuidado que a tela precisa ter, e é o motivo de este item estar escrito com
cuidado:** uma tela de observabilidade é o lugar mais fácil do mundo para
repetir o defeito que este projeto mais comete — mostrar um número que parece
uma coisa e é outra. Cada painel precisa dizer DE ONDE o número vem e QUANDO
foi medido. Um "saudável" verde derivado de "o processo está de pé" já custou
caro aqui uma vez.

## Busca em tudo, e não só nos campos de texto simples

**Pedido em 2026-09-16, e parcialmente feito.** O defeito que impedia qualquer
busca por pessoa já foi corrigido (um filtro legado `title__icontains` que
zerava o queryset antes do motor). Hoje busca título, título original, diretor,
sinopse e país.

**Falta** o que o usuário pediu e ainda não existe: ator, gênero, movimento
artístico, fotografia, trilha, roteiro, produtora. Os tipos importam e estão
medidos — `cast` e `crew` são **jsonb** (91,9% e 98,0%), `genres` e `keywords`
são **ArrayField com índice GIN** (96,2% e 74,5%), enquanto `cinematographer`
(72,7%), `composer` (52,0%) e `writer` (83,9%) são texto simples e entram no Q
de força-bruta sem obra nenhuma.

**Custo escondido:** a consulta atual faz Seq Scan em 25.908 linhas — 290 ms
medidos, 25.662 linhas descartadas pelo filtro. Só o TÍTULO tem índice de
trigrama; diretor, título original e sinopse não têm nenhum. Acrescentar campos
sem acrescentar índice multiplica esse tempo.

**E existe uma peça pronta que ninguém usa para isto:** pgvector está de pé com
embedding em 100% do acervo (BAAI/bge-m3, 1024 dims), mas só serve para
filme→filme e perfil→filme. Busca semântica por TEXTO — "filmes sobre luto",
"western crepuscular" — exigiria só embeddar a consulta.

## Item 12: catalogar qualquer filme, e não só o que já está no acervo

**Pedido em 2026-09-16.** "É importante que a busca ache qualquer filme, senão o
botão de catalogar na tela do filme não faz muito sentido."

Isto é diferente do item acima: não é buscar melhor DENTRO das 25.908 linhas, é
buscar FORA — no TMDB — e trazer para o acervo. Pede uma segunda origem de
resultados na tela de busca, visivelmente separada ("no seu acervo" × "no
TMDB"), e um caminho de importação.

## Tela de festivais

**Pedido em 2026-09-16.** Abas por festival — Cannes, Oscar e os outros — com
estética própria, não a do arquivo.

**A forma do dado é a parte difícil, e está medida.** `festivals` é jsonb, uma
lista de `{name, award, year}`, com 21.269 entradas em 5.709 filmes. E:

- **`name` não identifica o festival**: só tem 2 valores no acervo inteiro
  ("International Recognition" 21.207, "Registro OMDb" 62). O festival está
  dentro de `award`, que tem 1.482 strings distintas.
- **`year` carrega ano E status juntos**: `"2004 | Indicado"`. São 19.275
  entradas nesse formato, mais 1.511 só "Vencedor", 421 só "Indicado", e ~30
  com lixo do OMDb ("3 wins & 1 nomination"). Total: 13.091 indicações e 6.184
  vitórias; 3.575 filmes com ao menos uma vitória.
- **Cannes quase nunca diz "Cannes"**: o literal aparece em 92 filmes. As
  grafias reais são "Palme d'Or", "Short Film Palme d'Or", "Cannes Film
  Festival Grand Prix", "FIPRESCI Prize"... Berlim e Veneza idem: vêm como
  "Golden Bear" (75) e "Golden Lion" (73).

Agrupando por padrões curados dá para extrair 17 festivais com massa real —
Oscar 3.225 filmes (864 vitórias), National Board of Review 775, European Film
Awards 682, Sundance 244, César 238, BAFTA 233, Globo de Ouro 232. **Essa
curadoria de padrões é o trabalho do item**, e ela merece ficar no backend, num
módulo testado, e não espalhada na tela.

## Tela de gêneros

**Pedido em 2026-09-16,** com os chips de gênero da ficha levando até ela.

`genres` é ArrayField com índice GIN, 96,2% preenchido, **25 valores distintos**
e média de 1,96 por filme — um vocabulário pequeno o bastante para uma tela
inteira caber sem paginação. Os maiores: Drama 13.854, Comédia 5.823,
Documentário 3.990, Romance 3.928, Thriller 2.723, Crime 2.608, Ação 2.074,
Terror 1.944.

**Armadilha medida:** a cauda tem 6 valores de TV em inglês — "Sci-Fi &
Fantasy" 13, "War & Politics" 7, "Action & Adventure" 6, "Kids" 4, "Soap" 2,
"Reality" 1. Uma tela que liste tudo vai mostrar esses seis ao lado de Drama.

## O ranking TSPDT precisa de uma tela

**Pedido em 2026-09-16.** A ficha mostra a posição e o clique não faz nada — o
selo em `MovieClient.tsx:230` já tem hover e `cursor: crosshair`, prometendo
uma interação que não existe.

## A transição entre a lista e a ficha do filme

**Pedido em 2026-09-16,** e é o item mais bem descrito dos catorze: a imagem de
fundo que aparece no hover deve viajar continuamente até virar a imagem de
fundo da ficha, em vez de expandir, apagar para preto e cortar.

**O que foi medido, e complica:**

- O efeito de hover é **duplo**: um plano por linha (`FilmProgramme.tsx:143-168`,
  `width 0%→60%`, `opacity 0→0.35`, `grayscale(100%)`) e outro por seção.
- **A home usa o BACKDROP e o arquivo usa o PÔSTER**: `app/page.tsx:175` monta
  `background_url || poster_url`, enquanto `FilmCards.tsx` (FilmRow) usa
  `movie.poster_url`. São imagens diferentes — uma transição contínua precisa
  que a imagem de origem e a de destino sejam a MESMA.
- Há três `setTimeout(..., 800)` atrasando o `router.push`
  (`FilmProgramme.tsx:139`, `FilmCards.tsx:25` e `:136`). Eles atrasam a
  navegação em 0,8 s e ainda cortam a própria expansão, que dura 0,85 s.

## Revisar a tela de configurações

**Pedido em 2026-09-16.** Uma varredura recente já removeu o bloco do Trakt, as
chaves de API inventadas e ligou os interruptores de notificação. **O que
sobrou, medido aba por aba:**

- **Reprodução:** QUALIDADE ALVO, PRIORIDADE DE ÁUDIO e LIMITE DE AQUISIÇÃO são
  `useState` local — o valor morre ao trocar de aba. E o rótulo anuncia "4K HDR
  REMUX" enquanto toda busca real roda com `min_resolution: '1080p'` e
  `prefer_remux: False`.
- **Reprodução:** "REPRODUÇÃO AUTOMÁTICA (próximo episódio)" e "PULAR ABERTURAS"
  prometem funcionalidade sobre séries — não há uma classe Series/Episode em
  todo o backend, nem campo de marcador de abertura.
- **Aparência:** os três seletores de cor **não têm `onClick` nenhum**, e "OURO
  CINEMA" está marcado como ativo por um literal. O toggle "Efeitos
  Cinematográficos" nasce em ON e não controla o grão — o overlay é
  incondicional (`page.tsx:94`).
- **Legendas:** escala, opacidade e cor só afetam o `<p>` de preview da própria
  tela. Zero ocorrências de `::cue` no cliente inteiro.
- **Privacidade:** "Telemetria Anônima" não tem nada para ligar —
  `sentry-sdk` está no requirements e nunca é inicializado.
- **Notificações:** os três interruptores agora gravam, mas **nenhum dos três
  campos é lido por código nenhum**. `notify_download_complete` passa
  `send_email=False, send_push=False` fixos.
- **Código morto** da varredura anterior: `copiedKey`, `setCopiedKey`,
  `copyToClipboard` e o import `Copy` continuam lá, nunca chamados.

**O lugar barato para pousar o que sobreviver:** `User.preferences` é um
JSONField já migrado e **nunca lido nem escrito por nada** — 0 de 2 usuários com
valor.

## ✅ Tocar direto do torrent, como o Stremio

**Pedido em 2026-09-08. Fechado em 2026-09-14.** `clients/torrent/` é um
serviço Node com webtorrent 3, servindo o arquivo por HTTP com `Range` enquanto
baixa. Medido: os últimos 64 KB de um arquivo com 0% baixado chegaram em 1,2s.

**Cache deslizante** (`cacheDeslizante.js`), como o Stremio na TV: cota que o
usuário escolhe na tela, e as peças já assistidas saem do disco. Um arquivo por
peça porque o Node não expõe `FALLOC_FL_PUNCH_HOLE`. A parte não óbvia, medida:
apagar a peça NÃO BASTA — o torrent segue achando que a tem, e um salto para
trás termina com zero bytes e sem erro. A cura é `torrent._markUnverified`.

**O que só apareceu ao ligar tudo ao vivo:** nenhum dos 1629 magnets do acervo
traz `&tr=`. Sem tracker sobra a DHT, e os semeadores que o indexador anuncia se
anunciam ao tracker. Medido no mesmo magnet: 30s sem um par, 2,3s com anúncio.

**E a escolha da cópia era uma só para duas perguntas diferentes.** "Baixar no
Real-Debrid" e "tocar direto" só parecem a mesma: numa quem procura o enxame é
o Real-Debrid, na outra é esta máquina, agora. O número de semeadores do
indexador é uma afirmação, não uma medida — em Pulp Fiction, a cópia com 104
anunciados ficou 30s sem um par e outra respondeu em 8,5s. Hoje vai uma lista
de até três, e a view tenta a seguinte quando o motor diz que não achou ninguém.

## ✅ Rodar o motor de torrent atrás de uma VPN

**Fechado em 2026-09-15.** `docker-compose.torrent.yml` roteia só o motor por um
container gluetun; o resto do Lumière continua na máquina. Os 22 provedores do
`infra/torrent.env.exemplo` foram lidos do binário do gluetun, não da
documentação.

A garantia é estrutural: o container do motor não tem pilha de rede própria.
Medido com um túnel apontado para o nada — `NetworkMode=container:<gluetun>`,
internet bloqueada (`EAI_AGAIN`), e sem túnel o motor nem chega a iniciar.

**Aberto:** nenhum comando local prova o que o ENXAME vê. `infra/confere-a-vpn.sh`
termina mandando conferir no ipleak.net com o magnet de teste, manualmente.
Automatizar isso exigiria o Lumière entrar num enxame de diagnóstico e ler o IP
de volta — dá para fazer, e ainda não foi feito.

## O player precisa deixar de ser maquete

**Relatado em 2026-09-08.** A tela do player tem controles que não fazem nada, e
a reprodução trava e sai sem áudio.

**Medido no navegador do usuário, com `canPlayType`:**

| formato                    | resposta   |
|----------------------------|------------|
| H.264 + AAC em MP4         | probably   |
| HEVC em MP4                | probably   |
| **HEVC em Matroska (.mkv)**| **não**    |
| H.264 em Matroska          | probably   |
| **DTS**                    | **não**    |
| AC-3 / E-AC-3              | não        |
| FLAC, AAC                  | probably   |

A cópia que travou sem áudio é `2001...BDRemux Ita Eng x265-NAHOM`: .mkv com
vídeo HEVC e áudio DTS. O vídeo engasga porque a combinação container+codec não
é suportada; o áudio some porque DTS não é suportado de forma alguma.

Não é defeito de código — é limite do formato. E é perverso: as cópias de MAIOR
nota são justamente REMUX em .mkv com faixa sem perdas, ou seja, exatamente as
que o navegador não toca. O algoritmo de qualidade e o player estão otimizando
para coisas opostas.

**As três saídas foram construídas, e elas se completam:**

1. ✅ Transcodificar sob demanda (`apps/movies/transcode.py`). Quase nunca é
   preciso recodificar VÍDEO — o que falha é o áudio —, então o normal é
   `-c:v copy` com só a faixa de som virando AAC. Medido: 4x a velocidade da
   reprodução a 15% de CPU, e 0 quadros perdidos num REMUX 2160p HEVC.
2. ✅ Preferir cópias compatíveis (`_por_utilidade` em `playback.py`): toca >
   talvez > não toca, e dentro de cada grupo a maior nota.
3. ✅ Player externo (`features/movies/playerExterno.ts`), com a legenda junto
   no Infuse.

**Ligado em 2026-09-10:** a escolha quando nada toca sozinho — converter o
áudio, reproduzir cru, ou mandar baixar no Real-Debrid e ser avisado. O aviso
usa a infra de notificação que já existia inteira e desligada (`ws/notifications/`,
grupo por usuário): faltava alguém do lado do cliente ouvindo, e o monitor de
download só acompanhava cópias dentro de uma sessão de cinema.

**Fechado em 2026-09-11:** faixa de áudio e volume. O ffprobe que já media a
duração passou a listar também as faixas — mesma sondagem, porque cada ida ao
Real-Debrid custa ~4,6s — e trocar de faixa religa o ffmpeg com outro
`-map 0:a:N` a partir da posição atual, como o salto. As faixas de comentário
são marcadas: em "Mártires", duas das quatro são especialistas falando sobre o
filme, e cair numa delas troca o filme por uma aula.

**Fechado em 2026-09-15:** Jellyfin e Plex passam pela mesma pergunta. Os dois
servidores já devolviam os codecs do arquivo — o Plex em `Media@audioCodec`, o
Jellyfin em `MediaSources[].MediaStreams[]` — e os dois eram descartados.
`o_que_converter_de_codecs` julga em vocabulário de ffmpeg (`dts`, `truehd`,
`eac3`), que é outro dialeto do parser de nome de release (`DTS-HD MA`,
`Dolby TrueHD`): os dois precisam existir, porque cada um sabe algo que o outro
não sabe.

O rótulo passou a dizer as duas coisas — `JELLYFIN — ÁUDIO CONVERTIDO` — porque
só a origem escondia o tratamento, e só o tratamento escondia a origem. O
endpoint de conversão já funcionava para qualquer fonte; faltava só o
julgamento.

**Não verificado ao vivo:** esta instalação não tem Jellyfin nem Plex
configurados. Os testes exercitam as formas reais das duas APIs, e oito mutações
foram pegas, mas ninguém apontou isto para um servidor de verdade ainda.

## O Real-Debrid não diz mais o que está em cache

`/torrents/instantAvailability` responde 403 com `error_code 37` para qualquer
chave válida. Contornado por sondagem em `apps/movies/realdebrid_cache.py` —
adiciona o magnet, observa se os metadados vêm na hora, desfaz o que criou.
Custa ~2s por cópia e o provedor limita a taxa (429 com cinco em paralelo).

Se o Real-Debrid publicar um substituto, a sondagem inteira pode sair.
