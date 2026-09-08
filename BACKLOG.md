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

**Decisões pendentes, e as três mudam o produto:**

1. Transcodificar sob demanda com ffmpeg — resolve tudo, custa CPU e alguns
   segundos de latência no play, e exige gerenciar processos.
2. Preferir cópias compatíveis na hora de tocar — instantâneo e sem
   infraestrutura, mas escolhe H.264/AAC em vez do REMUX que a nota elogia.
3. Delegar a um player externo (VLC, Infuse) por link — toca tudo, mas o
   Lumière deixa de ser onde se assiste.

Os controles que não funcionam (faixas de áudio, legendas, volume) são um
segundo problema, e em parte consequência do primeiro: sem faixa de áudio
decodificável não há o que selecionar.

## O Real-Debrid não diz mais o que está em cache

`/torrents/instantAvailability` responde 403 com `error_code 37` para qualquer
chave válida. Contornado por sondagem em `apps/movies/realdebrid_cache.py` —
adiciona o magnet, observa se os metadados vêm na hora, desfaz o que criou.
Custa ~2s por cópia e o provedor limita a taxa (429 com cinco em paralelo).

Se o Real-Debrid publicar um substituto, a sondagem inteira pode sair.
