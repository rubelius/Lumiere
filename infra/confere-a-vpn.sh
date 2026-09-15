#!/usr/bin/env bash
#
# Confere se o motor de torrent está mesmo saindo pela VPN.
#
# O QUE ESTE SCRIPT PROVA: que o IP de saída do container é diferente do IP
# desta casa, e que sem o túnel ele não alcança a internet.
#
# O QUE ELE NÃO PROVA: que o enxame vê esse mesmo IP. O BitTorrent anuncia ao
# tracker o endereço que o par enxerga da conexão, e conferir isso exige entrar
# num enxame e perguntar — coisa que nenhum comando local faz. Para essa prova
# existem os "torrent IP leak test" (o ipleak.net tem um magnet de teste): você
# abre a página, manda o Lumière tocar aquele magnet e a página mostra o IP que
# o enxame viu. É a única verificação de verdade, e é manual.
#
# Ou seja: o que está aqui pega o vazamento grosseiro — o container sem VPN, o
# túnel que não subiu, o kill switch desligado. O resto é teatro se eu fingir
# que prova mais do que prova.

set -uo pipefail

COMPOSE="${COMPOSE:-docker-compose.torrent.yml}"
GLUETUN="${GLUETUN:-lumiere-gluetun}"
MOTOR="${MOTOR:-lumiere-motor-torrent}"

ok()    { printf '  \033[32m✓\033[0m %s\n' "$1"; }
falha() { printf '  \033[31m✗\033[0m %s\n' "$1"; FALHOU=1; }
aviso() { printf '  \033[33m!\033[0m %s\n' "$1"; }
FALHOU=0

echo
echo "── 1. os containers estão de pé?"
for c in "$GLUETUN" "$MOTOR"; do
  estado=$(docker inspect -f '{{.State.Status}}' "$c" 2>/dev/null) || estado=ausente
  case "$estado" in
    running) ok "$c está rodando" ;;
    ausente) falha "$c não existe — suba com: docker compose -f $COMPOSE up -d" ;;
    restarting)
      # O caso de longe mais comum, e o genérico "suba de novo" manda a pessoa
      # repetir o que já falhou. A razão está sempre na última linha ERROR.
      razao=$(docker logs "$c" 2>&1 | grep -E "ERROR" | tail -1 | sed 's/.*ERROR //')
      falha "$c está reiniciando em laço: ${razao:-veja docker logs $c}"
      [ "$c" = "$GLUETUN" ] && aviso "quase sempre é credencial faltando ou errada em infra/torrent.env"
      ;;
    created)
      falha "$c foi criado e nunca iniciou — o gluetun não ficou saudável, e o motor só sobe depois dele"
      aviso "isto é o kill switch funcionando: sem túnel, o motor não roda"
      ;;
    *) falha "$c: $estado" ;;
  esac
done
[ "$FALHOU" = 1 ] && { echo; echo "Nada a conferir sem os containers de pé."; exit 1; }

echo
echo "── 2. o motor tem pilha de rede própria? (ele NÃO pode ter)"
modo=$(docker inspect -f '{{.HostConfig.NetworkMode}}' "$MOTOR" 2>/dev/null)
case "$modo" in
  container:*|service:*)
    # Confere que é o gluetun mesmo, e não outro container qualquer.
    alvo=$(docker inspect -f '{{.Id}}' "$GLUETUN" 2>/dev/null)
    if [ "$modo" = "container:$alvo" ] || [[ "$modo" == *"$GLUETUN"* ]]; then
      ok "o motor usa a rede do gluetun — não existe rota por fora"
    else
      falha "o motor está preso à rede de OUTRO container: $modo"
    fi ;;
  *)
    falha "o motor tem rede própria ($modo). O torrent está saindo pelo IP desta casa." ;;
esac

echo
echo "── 3. o IP de saída do motor é diferente do desta casa?"
ip_casa=$(curl -s -m 10 https://api.ipify.org 2>/dev/null)
ip_motor=$(docker exec "$MOTOR" node -e \
  "fetch('https://api.ipify.org').then(r=>r.text()).then(t=>console.log(t.trim())).catch(()=>process.exit(1))" 2>/dev/null)

if [ -z "$ip_casa" ]; then
  aviso "não consegui descobrir o IP desta casa (sem internet?) — pulando"
elif [ -z "$ip_motor" ]; then
  falha "o motor não alcançou a internet. Se o túnel caiu, isto é o kill switch funcionando."
elif [ "$ip_casa" = "$ip_motor" ]; then
  falha "MESMO IP ($ip_casa). O tráfego NÃO está passando pela VPN."
else
  ok "casa=$ip_casa  motor=$ip_motor — são diferentes"
fi

echo
echo "── 4. o gluetun se considera saudável?"
saude=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}sem healthcheck{{end}}' "$GLUETUN" 2>/dev/null)
[ "$saude" = healthy ] && ok "gluetun: healthy" || falha "gluetun: $saude"

echo
echo "── 5. o firewall está ligado?"
if docker logs "$GLUETUN" 2>&1 | grep -q "firewall.*enabled successfully"; then
  ok "o firewall subiu — sem ele não há kill switch"
else
  aviso "não achei a linha do firewall no log (pode ter rolado para fora)"
fi

echo
echo "── 6. a porta do motor está publicada só no loopback?"
publicado=$(docker inspect -f '{{json .HostConfig.PortBindings}}' "$GLUETUN" 2>/dev/null)
if echo "$publicado" | grep -q '"HostIp":"127.0.0.1"'; then
  ok "8001 publicada em 127.0.0.1 — a rede local não alcança"
elif echo "$publicado" | grep -q '8001'; then
  falha "8001 publicada em TODAS as interfaces. A API do motor não autentica ninguém: qualquer máquina da rede pode mandar baixar o que quiser."
else
  aviso "não achei a publicação da 8001"
fi

echo
echo "── 7. o Lumière alcança o motor?"
if curl -s -m 5 http://127.0.0.1:8001/saude | grep -q '"ok":true'; then
  ok "/saude responde"
else
  falha "/saude não respondeu em 127.0.0.1:8001"
fi

echo
if [ "$FALHOU" = 1 ]; then
  echo "Algo acima está errado. NÃO toque direto do torrent até resolver."
  exit 1
fi
cat <<'FIM'
Tudo o que dá para conferir daqui está certo.

Falta a prova que nenhum comando local dá: o que o ENXAME vê. Para isso,
abra https://ipleak.net, role até "Torrent Address detection", copie o
magnet de teste e mande o Lumière tocá-lo. O IP que aparecer na página é o
que os outros pares enxergam — é ele que precisa ser o da VPN.
FIM
