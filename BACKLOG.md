# Backlog do Lumière

O que está decidido e ainda não construído. Cada item diz o que é, por que
importa e o que já se sabe sobre a dificuldade — para quem pegar não precisar
redescobrir.

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
