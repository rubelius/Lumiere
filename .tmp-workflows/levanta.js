export const meta = {
  name: 'levanta-o-que-o-lumiere-ja-tem',
  description: 'Levanta o estado real de seis frentes do Lumière e propõe melhorias de estética e de UX',
  phases: [
    { title: 'Levantamento', detail: 'home, busca, configurações, admin, navegação, acervo' },
    { title: 'Sugestões', detail: 'estética e UI/UX, ancoradas no que existe' },
  ],
}

const REPO = '/Users/edwingodavid/Documents/personal_projects/lumiere'

const REGRA = `
REGRA ABSOLUTA: você é SOMENTE LEITURA. Não edite, crie nem apague arquivo
nenhum — nem de rascunho. Uma sessão anterior perdeu uma hora porque agentes
mutaram a árvore enquanto ela estava sendo testada ao vivo.

O PROJETO: Lumière, uma cinemateca pessoal em ${REPO}.
  backend/        Django 5 + DRF + Celery + Postgres/pgvector. apps/movies/ é o coração.
  clients/web/    Next.js 16 + React 19, App Router.
  clients/torrent/ serviço Node que serve torrent por HTTP.
Comentários e docstrings em PORTUGUÊS, explicando POR QUE e não O QUE.

A LINGUAGEM VISUAL é "Fine Art": fundo quase preto (--void), tipografia serifada
(Cormorant Garamond) para títulos e monoespaçada (DM Mono) para rótulos técnicos,
dourado (--gold) como único acento, muito respiro, animações lentas com easing
próprio (FINE_ART_EASE), rótulos em CAIXA ALTA com letter-spacing largo. Nada de
cores vivas, nada de sombras pesadas, nada de "dashboard de SaaS".

O ACERVO TEM 25.908 FILMES. O modelo Movie tem campos ricos e em grande parte
preenchidos: title, original_title, alternative_titles, year, length_minutes,
country, countries, spoken_languages, color, genres, primary_genre, themes,
moods, keywords, mpaa_rating, festivals, director, co_directors, cinematographer,
composer, writer, cast, crew, production_companies, tspdt_id.

MEÇA ANTES DE AFIRMAR. Você tem Bash: pode rodar
\`${REPO}/venv/bin/python\` com DJANGO_SETTINGS_MODULE=lumiere.settings a partir
de ${REPO}/backend para contar linhas, ver quantos filmes têm cada campo
preenchido, e conferir o que existe de verdade. Prefira um número medido a uma
impressão. Diga "não sei" quando não souber.
`

const LEVANTA = {
  type: 'object',
  properties: {
    achados: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          o_que: { type: 'string', description: 'O fato, em uma frase.' },
          detalhe: { type: 'string', description: 'Arquivo:linha, número medido, nome de campo — o concreto.' },
          medido: { type: 'boolean', description: 'true se você RODOU algo para confirmar; false se é leitura de código.' },
        },
        required: ['o_que', 'detalhe', 'medido'],
      },
    },
    o_que_ja_existe: {
      type: 'array',
      description: 'Peças prontas que a implementação pode aproveitar, em vez de recriar.',
      items: { type: 'string' },
    },
    o_que_falta: {
      type: 'array',
      description: 'O que precisa ser construído, do mais barato ao mais caro.',
      items: { type: 'string' },
    },
    nao_sei: { type: 'array', items: { type: 'string' } },
  },
  required: ['achados', 'o_que_ja_existe', 'o_que_falta', 'nao_sei'],
}

const SUGERE = {
  type: 'object',
  properties: {
    sugestoes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          titulo: { type: 'string', description: 'A ideia em até 8 palavras.' },
          onde: { type: 'string', description: 'Tela e arquivo concretos onde entraria.' },
          porque: { type: 'string', description: 'O que melhora para quem usa. Não "fica mais bonito".' },
          como: { type: 'string', description: 'O suficiente para alguém implementar sem redescobrir.' },
          custo: { type: 'string', enum: ['baixo', 'medio', 'alto'] },
        },
        required: ['titulo', 'onde', 'porque', 'como', 'custo'],
      },
    },
  },
  required: ['sugestoes'],
}

const FRENTES = [
  {
    chave: 'home',
    prompt: `${REGRA}

FRENTE: a home. O usuário diz que "parece que são sempre os mesmos filmes na
hero section, sempre os mesmos nas seções abaixo, inclusive em próximas
projeções".

Descubra e MEÇA:
1. De onde vem cada seção da home (${REPO}/clients/web/app/page.tsx e os hooks
   que ela usa). Que endpoint, que ordenação, que limite.
2. A causa concreta da repetição: ordenação fixa? sem embaralhar? cache? O
   mesmo queryset para todas as seções? Rode uma consulta e mostre que os
   primeiros N são sempre os mesmos.
3. "Próximas projeções" — de onde sai, e por que repete.
4. Que MATERIAL existe no acervo para seções novas e vivas: quantos filmes têm
   \`festivals\`, \`themes\`, \`moods\`, \`keywords\`, \`cinematographer\`,
   \`composer\`? quantos distintos? Conte de verdade. Uma seção só vale se
   houver dado para ela.`,
  },
  {
    chave: 'busca',
    prompt: `${REGRA}

FRENTE: a tela de busca. O usuário digita "tarantino" e não volta nada.

JÁ MEDIDO POR MIM: a consulta em backend/apps/movies/views.py:165-171 já inclui
\`director__icontains\`, e rodando ela direto no banco "tarantino" devolve 14
filmes. Ou seja, o defeito NÃO está nessa consulta.

Descubra:
1. Que endpoint a tela de busca (${REPO}/clients/web/app/search/ ou equivalente)
   realmente chama, e com que parâmetros. Siga o hook.
2. Por que o resultado não aparece: outro endpoint? filtro adicional?
   debounce? um \`search\` do DRF com \`search_fields\` diferente? mínimo de
   caracteres? Prove com o caminho do código.
3. Que campos SERIA possível buscar e não são: \`cast\`, \`crew\`, \`genres\`,
   \`themes\`, \`keywords\`, \`movimento artístico\`, \`cinematographer\`,
   \`composer\`, \`production_companies\`. Diga o TIPO de cada um no banco
   (texto? JSON? array?) — isso muda completamente como se busca.
4. Existe índice? pgvector está em uso para busca semântica? O que já existe
   de infraestrutura de busca.`,
  },
  {
    chave: 'admin',
    prompt: `${REGRA}

FRENTE: uma tela de administração com observabilidade de TUDO. Ela ainda não
existe; o usuário quer a mais completa possível, e a conta dele é admin.

Levante o que HÁ PARA MOSTRAR, medindo:
1. Modelos e volumes: quantos filmes, cópias, usuários, sessões, notificações,
   histórico. Rode e conte.
2. Saúde do sistema: o que \`apps/core/motor.py\` e \`apps/tasks/pulso.py\` já
   sabem responder (workers, beat, último pulso). O que mais dá para saber.
3. Celery: que tasks existem, quais são periódicas, onde está o resultado
   (django-celery-results?), dá para listar falhas recentes?
4. O rastreador de cópias (\`apps/tasks/precarga.py\`): que estado ele expõe —
   fila, quantos por rodada, quantos vencidos, quando cada filme foi varrido.
5. Integrações: Real-Debrid (cota da conta? limite de taxa?), Prowlarr,
   OpenSubtitles, o motor de torrent.
6. Que endpoints de estatística JÁ existem no backend e ninguém usa.
7. Como se sabe que um usuário é admin (is_staff? is_superuser?) e como o
   frontend descobriria isso — o serializer devolve?`,
  },
  {
    chave: 'acervo-rico',
    prompt: `${REGRA}

FRENTE: três telas novas que o usuário pediu — festivais, gêneros e o ranking
TSPDT. Antes de desenhar, é preciso saber se HÁ DADO.

MEÇA, com consultas de verdade:
1. \`festivals\`: qual o tipo da coluna, que forma tem o conteúdo (mostre 3
   exemplos crus), quantos filmes têm algo ali, quantos festivais DISTINTOS dá
   para extrair, e quantos filmes por festival nos 10 maiores. Cannes e Oscar
   aparecem? Com que grafia exata?
2. \`genres\` e \`primary_genre\`: tipo, forma, quantos distintos, os 15 maiores
   com contagem.
3. \`tspdt_id\`: quantos filmes têm, qual a forma (é a POSIÇÃO no ranking ou um
   id?). Existe outro campo com a posição? Procure por 'tspdt' em todo o
   backend. Dá para montar uma lista ordenada 1..N?
4. \`themes\`, \`moods\`, \`keywords\`: mesma coisa — tipo, quantos preenchidos,
   quantos distintos.
5. Onde na tela do filme aparecem hoje o gênero e a posição TSPDT (arquivo e
   linha), para saber o que precisaria virar link.`,
  },
  {
    chave: 'navegacao',
    prompt: `${REGRA}

FRENTE: navegação e transição entre telas.

Dois pedidos do usuário:
(a) o botão de voltar do player leva à HOME, e deveria levar à tela do filme;
(b) quando ele passa o mouse num título da lista de obras-primas da home (ou no
    arquivo), aparece uma imagem de fundo do filme; ele quer que, ao clicar,
    essa imagem faça uma transição CONTÍNUA até virar a imagem de fundo da tela
    do filme — em vez do que acontece hoje (ela expande um pouco, a tela fica
    preta, e a próxima aparece).

Descubra:
1. \`handleBack\` em ${REPO}/clients/web/app/player/page.tsx: para onde vai
   hoje, e que informação existe para saber de onde veio (searchParams,
   history, referrer?).
2. Onde está o efeito de imagem de fundo no hover: arquivo, componente,
   propriedade animada. Como a imagem é escolhida (backdrop? poster?).
3. Como é a imagem de fundo da tela do filme: mesmo arquivo de imagem? mesma
   URL? tamanho e posicionamento (object-fit, escala, opacidade)?
4. O projeto já usa framer-motion — verifique se \`layoutId\` / \`AnimatePresence\`
   com \`mode="wait"\` estão disponíveis na versão instalada, e se o App Router
   do Next 16 permite animar entre ROTAS (template.tsx? view transitions?).
   Diga o que a versão instalada realmente suporta — leia o package.json e o
   node_modules, não vá pela memória.
5. A API de View Transitions do navegador é uma alternativa? O Next 16 tem
   suporte? Meça: o que há no node_modules/next.`,
  },
  {
    chave: 'configuracoes',
    prompt: `${REGRA}

FRENTE: a tela de configurações (${REPO}/clients/web/app/settings/page.tsx). O
usuário diz que "tem muita coisa mockada lá".

CONTEXTO: uma varredura recente já consertou alguns casos — o bloco do Trakt
(removido, não havia integração), as chaves de API inventadas na aba
Autenticação, os interruptores de notificação (agora ligados ao backend), e os
selos de conexão. Leia o arquivo COMO ELE ESTÁ AGORA.

Encontre o que AINDA é maquete, aba por aba:
1. Percorra cada aba e liste todo controle cujo valor não vem do servidor nem
   vai para ele. Procure \`useState\` com valor inicial que vira rótulo.
2. Para cada um: existe campo no backend que daria para ligar (procure em
   apps/users/models.py, apps/notifications/models.py e nos serializers)? Ou é
   uma funcionalidade que não existe?
3. Liste também o oposto: preferências que EXISTEM no backend e não têm
   controle na tela.`,
  },
]

phase('Levantamento')
log(`Levantando ${FRENTES.length} frentes`)

const levantado = await parallel(FRENTES.map((f) => () =>
  agent(f.prompt, { label: `levanta:${f.chave}`, phase: 'Levantamento', schema: LEVANTA })
    .then((r) => (r ? { ...r, frente: f.chave } : null))))

const vivos = levantado.filter(Boolean)
log(`${vivos.length}/${FRENTES.length} frentes responderam`)

// As sugestões precisam nascer do que existe, e não de um catálogo genérico de
// boas práticas. Por isso vêm DEPOIS e recebem o levantamento inteiro.
const RESUMO = vivos.map((r) => `## ${r.frente}\n`
  + r.achados.slice(0, 14).map((a) => `- ${a.o_que} — ${a.detalhe.slice(0, 220)}`).join('\n')
  + `\nJÁ EXISTE: ${r.o_que_ja_existe.slice(0, 8).join('; ')}`).join('\n\n')

phase('Sugestões')

const OLHARES = [
  {
    chave: 'estetica',
    prompt: `Proponha PELO MENOS 22 melhorias de ESTÉTICA para o Lumière.

O que conta como estética aqui: tipografia, ritmo vertical, densidade, uso da
cor dourada, tratamento de imagem (pôsteres, backdrops, grão, vinheta),
animação e timing, hierarquia visual, estados vazios, texturas, impressão de
"objeto caro". NÃO conte usabilidade — isso é a outra lista.

A régua: o Lumière quer parecer uma cinemateca, não um catálogo de streaming.
Referências mentais válidas: Criterion, MUBI, a diagramação de um livro de arte,
cartazes de festival, a ficha técnica de uma cinemateca. Referências PROIBIDAS:
Netflix, dashboards, cards com sombra, gradientes coloridos.

Seja ESPECÍFICO e implementável: "usar mais respiro" não serve; "a lista de
obras-primas ganha um filete dourado de 1px que cresce da esquerda no hover,
200ms, e o ano sobe de --m3 para --film" serve.

Aponte telas e arquivos reais. Diga o que é barato e o que é caro.`,
  },
  {
    chave: 'ux',
    prompt: `Proponha PELO MENOS 22 melhorias de UI/UX para o Lumière.

O que conta: navegação, descoberta, o que a tela informa e quando, atalhos,
estados de carregamento e erro, quantidade de cliques, memória do que a pessoa
estava fazendo, acessibilidade, teclado, o caminho de quem chega sem saber o
que quer.

O Lumière tem 25.908 filmes e uma pessoa só usando. Isso muda tudo: descoberta
importa mais que busca, e a tela precisa ter opinião — recomendar, provocar,
lembrar — em vez de só listar.

NÃO repita o que já existe. NÃO proponha estética (é a outra lista).

Seja específico e implementável, apontando telas e arquivos reais. Diga o que é
barato e o que é caro.`,
  },
]

const sugerido = await parallel(OLHARES.map((o) => () =>
  agent(`${REGRA}

${o.prompt}

── O QUE O LEVANTAMENTO DESCOBRIU (use isto; não proponha o que já existe) ──
${RESUMO}

Antes de propor, ABRA as telas de que for falar. Uma sugestão que descreve algo
que já está lá é pior que nenhuma sugestão.`,
    { label: `sugere:${o.chave}`, phase: 'Sugestões', schema: SUGERE })
    .then((r) => (r ? { olhar: o.chave, sugestoes: r.sugestoes } : null))))

return {
  levantamento: vivos,
  sugestoes: sugerido.filter(Boolean),
  nao_sei: vivos.flatMap((r) => r.nao_sei.map((q) => `[${r.frente}] ${q}`)),
}
