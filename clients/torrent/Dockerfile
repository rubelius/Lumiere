# O motor de torrent, para rodar atrás do gluetun.
#
# POR QUE DEBIAN E NÃO ALPINE, que seria um terço do tamanho: o `utp-native` é
# dependência OPCIONAL do webtorrent e precisa compilar. Em alpine (musl) ele
# costuma falhar, e o webtorrent segue em frente sem uTP — sem erro nenhum,
# porque "opcional" é exatamente isso. O que se perde não é visível no log: uTP
# é o transporte que muitos clientes preferem, e perdê-lo é achar menos pares
# num acervo que já tem torrents magros.
#
# Ou seja, a imagem menor sairia mais cara no único lugar que importa aqui.
FROM node:22-bookworm-slim

# Para o utp-native compilar. Ficam só nesta camada de instalação.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# O manifesto antes do código: assim uma mudança em servidor.js não refaz o
# `npm ci`, que é o passo caro por causa da compilação acima.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY *.js ./

# Onde o cache deslizante grava. Vira volume no compose — sem isso as peças
# ficam na camada de escrita do container, que é lenta e some no `down`.
ENV PASTA_TORRENT=/pecas

# Dentro do container, `127.0.0.1` não atende ninguém de fora. Quem tranca aqui
# é a rede do Docker e o firewall do gluetun, não o bind.
ENV INTERFACE_TORRENT=0.0.0.0
ENV PORTA_TORRENT=8001

# Não roda como root: este processo aceita conexões de estranhos o dia todo.
# A pasta de peças precisa ser dele.
RUN mkdir -p /pecas && chown -R node:node /pecas /app
USER node

EXPOSE 8001
EXPOSE 51413/tcp
EXPOSE 51413/udp
EXPOSE 51414/udp

CMD ["node", "servidor.js"]
