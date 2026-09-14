"""
Conversa com o motor de torrent, que roda como serviço à parte.

Ele mora em clients/torrent/ e fala HTTP. A separação não é capricho: o
BitTorrent é um laço de eventos ocupado — dezenas de conexões, verificação de
hash, escrita em disco — e nada disso pode dividir processo com quem responde
requisições de tela.

*** O QUE O USUÁRIO PRECISA TER LIDO ANTES DE USAR ISTO ***
Tocar direto do torrent põe o IP da máquina no enxame, visível a qualquer
outro par. O Real-Debrid não faz isso: ele baixa em nome do usuário e entrega
por HTTP, e o enxame nunca vê a casa dele. Por isso
`user.torrent_direto_permitido` nasce desligado — ligar por padrão seria tomar
essa decisão por quem não leu o aviso.
"""

import logging

import httpx
from django.conf import settings

logger = logging.getLogger(__name__)

URL_PADRAO = 'http://127.0.0.1:8001'

# Quanto esperar para o motor achar os metadados do torrent.
#
# Não é o tempo do download: o motor responde quando sabe quais arquivos
# existem, o que num torrent saudável leva segundos. O teto dele é 30s, e este
# precisa ser maior, senão desistimos antes de ele nos contar POR QUE falhou —
# e "nenhum semeador respondeu" é uma frase que a tela precisa mostrar.
SEGUNDOS_PARA_METADADOS = 40

# Perguntas de estado são baratas e frequentes.
SEGUNDOS_PARA_ESTADO = 5


class MotorDeTorrentIndisponivel(Exception):
    """O serviço não respondeu. Diferente de 'o torrent não tem semeadores'."""


class TorrentRecusado(Exception):
    """
    O motor recusou este torrent, e sabe dizer por quê.

    A mensagem vem pronta para a tela: cópia grande demais para o disco, ou
    nenhum semeador. As duas são acionáveis por quem está olhando.
    """


def _base() -> str:
    return getattr(settings, 'TORRENT_SERVICE_URL', URL_PADRAO).rstrip('/')


async def poe_no_ar(magnet: str, cota_bytes: int = 0) -> dict:
    """
    Pede ao motor que comece a servir este magnet.

    Devolve quando os METADADOS chegam, não quando o arquivo termina — é essa
    diferença que faz o recurso existir. `cota_bytes` zero é ilimitado.
    """
    async with httpx.AsyncClient(timeout=SEGUNDOS_PARA_METADADOS) as cliente:
        try:
            resposta = await cliente.post(f'{_base()}/torrent',
                                          json={'magnet': magnet, 'cota': cota_bytes})
        except httpx.HTTPError as erro:
            raise MotorDeTorrentIndisponivel(
                f'O motor de torrent não respondeu: {erro}') from erro

    if resposta.status_code == 200:
        return resposta.json()

    # O motor devolve 502 com a razão escrita quando recusa — e a razão é para
    # a tela, não para o log.
    detalhe = ''
    try:
        detalhe = (resposta.json() or {}).get('erro') or ''
    except ValueError:
        detalhe = resposta.text[:200]
    raise TorrentRecusado(detalhe or 'O motor de torrent recusou esta cópia.')


async def estado(info_hash: str) -> dict | None:
    """Como vai o download. None quando o motor não conhece este torrent."""
    async with httpx.AsyncClient(timeout=SEGUNDOS_PARA_ESTADO) as cliente:
        try:
            resposta = await cliente.get(f'{_base()}/torrent/{info_hash}/estado')
        except httpx.HTTPError as erro:
            raise MotorDeTorrentIndisponivel(
                f'O motor de torrent não respondeu: {erro}') from erro

    return resposta.json() if resposta.status_code == 200 else None


async def tira_do_ar(info_hash: str) -> bool:
    """Para o torrent e apaga as peças. Falha aqui não é motivo para derrubar nada."""
    async with httpx.AsyncClient(timeout=SEGUNDOS_PARA_ESTADO) as cliente:
        try:
            resposta = await cliente.delete(f'{_base()}/torrent/{info_hash}')
            return resposta.status_code == 200
        except httpx.HTTPError as erro:
            logger.warning('Não foi possível parar o torrent %s: %s', info_hash, erro)
            return False


async def esta_no_ar() -> bool:
    """Se o motor está de pé. A tela usa para não oferecer o que não funciona."""
    async with httpx.AsyncClient(timeout=2.0) as cliente:
        try:
            return (await cliente.get(f'{_base()}/saude')).status_code == 200
        except httpx.HTTPError:
            return False
