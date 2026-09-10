# Backlog do Lumière

O que está decidido e ainda não construído. Cada item diz o que é, por que
importa e o que já se sabe sobre a dificuldade — para quem pegar não precisar
redescobrir.

## Tocar direto do torrent, como o Stremio

**Pedido em 2026-09-08.** Quando nenhuma cópia tem disponibilidade imediata no
Real-Debrid, oferecer a reprodução direta do torrent, avisando que com poucos
semeadores a reprodução pode travar.

Hoje a tela mostra a opção desabilitada, dizendo que não existe. É honesto, mas
é uma lacuna real: sem isso, filme sem cache no Real-Debrid não tem como ser
visto no mesmo instante.

**O que falta:** um motor de torrent que sirva o arquivo por HTTP enquanto
baixa — download sequencial mais suporte a *range requests*, que é o que a tag
`<video>` precisa para buscar posição. Nada no stack atual faz isso: o
`rdtclient` gerencia o Real-Debrid e não transmite; o qBittorrent não transmite.

**Candidatos:** `webtorrent-hybrid` (Node, mesmo runtime do cliente) ou
`libtorrent` via Python. Os dois exigem serviço próprio, porta, ciclo de vida e
um caminho de erro específico — "o torrent não tem semeadores" precisa chegar à
tela como frase, não como vídeo travado.

**Onde encaixa:** `components/movie/MovieSidebar.tsx`, no bloco de escolha que
aparece quando `tocaAgora` é falso; e um resolvedor novo em
`apps/movies/playback.py`, depois do Real-Debrid na cadeia.

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

**O que continua aberto:** os controles de faixa de áudio e de volume. A
conversão entrega uma faixa AAC estéreo só, então "escolher faixa de áudio"
hoje não tem o que escolher — para o usuário trocar de idioma seria preciso
mapear as faixas do arquivo (`-map 0:a:N`) e reabrir o fluxo, como o salto já
faz.

**Limite conhecido:** Jellyfin e Plex nunca passam por essa pergunta —
`precisa_converter` só é calculado no caminho do Real-Debrid, onde existe uma
cópia com codecs declarados. Um DTS vindo da biblioteca local ainda toca mudo,
sob o rótulo 'JELLYFIN DIRECT'.

## O Real-Debrid não diz mais o que está em cache

`/torrents/instantAvailability` responde 403 com `error_code 37` para qualquer
chave válida. Contornado por sondagem em `apps/movies/realdebrid_cache.py` —
adiciona o magnet, observa se os metadados vêm na hora, desfaz o que criou.
Custa ~2s por cópia e o provedor limita a taxa (429 com cinco em paralelo).

Se o Real-Debrid publicar um substituto, a sondagem inteira pode sair.
