"""
Perguntar ao servidor, em vez de olhar para o campo.

O DEFEITO: `jellyfin_connected` era `bool(url and token)` — um predicado que
responde "os dois campos têm texto" e estava respondendo "o servidor
respondeu". O PATCH que grava as credenciais só valida o FORMATO da URL; nada
naquele caminho chega a falar com o Jellyfin. Uma URL certa com token vencido,
um servidor desligado, um endereço com um dígito errado: tudo isso mostrava ✓
[CONECTADO] em dourado.

É o formato de defeito que este projeto mais repete — um predicado mais estreito
que a pergunta que ele responde.

A cura não é um predicado melhor: é PERGUNTAR. E como a resposta envelhece
(servidor desliga, token expira), o que se guarda é QUANDO ele respondeu, não
um "sim" eterno.
"""

import logging

from asgiref.sync import async_to_sync
from django.utils import timezone

logger = logging.getLogger(__name__)

# Quanto esperar o servidor de casa responder.
#
# É a rede local: se não respondeu em três segundos, a tela de configurações
# não vai ficar mais honesta esperando dez. E ela não pode travar o salvamento
# — gravar a credencial e verificar são duas coisas, e só a segunda pode
# falhar sem estragar nada.
SEGUNDOS_PARA_RESPONDER = 3.0

# Depois de quanto tempo uma resposta deixa de significar alguma coisa.
#
# Não é uma verdade permanente: o servidor de casa desliga à noite, o token
# expira. Passado esse prazo a tela volta a dizer apenas "gravado", que é o que
# de fato se sabe.
HORAS_ATE_A_RESPOSTA_ENVELHECER = 24

NAO_CONFIGURADO = 'nao_configurado'
GRAVADO = 'gravado'          # há credencial, e ninguém confirmou que funciona
RESPONDEU = 'respondeu'      # o servidor respondeu, e faz pouco tempo


async def _pergunta_ao_jellyfin(url: str, token: str, user_id: str) -> bool:
    from apps.integrations.jellyfin import JellyfinClient
    cliente = JellyfinClient(url, token, user_id)
    try:
        cliente.client.timeout = SEGUNDOS_PARA_RESPONDER
        return bool(await cliente.get_libraries())
    finally:
        await cliente.close()


async def _pergunta_ao_plex(url: str, token: str) -> bool:
    from apps.integrations.plex import PlexClient
    cliente = PlexClient(url, token)
    try:
        cliente.client.timeout = SEGUNDOS_PARA_RESPONDER
        return bool(await cliente.get_libraries())
    finally:
        await cliente.close()


def verifica(usuario) -> dict:
    """
    Pergunta aos servidores configurados e carimba quem respondeu.

    Devolve o que mudou, para quem chama poder gravar só isso. Nunca lança: uma
    verificação que falha é informação ("não respondeu"), não um erro — gravar
    a credencial precisa funcionar mesmo com o servidor desligado.
    """
    mudou = {}

    if usuario.jellyfin_server_url and usuario.jellyfin_token:
        if _tenta(_pergunta_ao_jellyfin, usuario.jellyfin_server_url,
                  usuario.jellyfin_token, usuario.jellyfin_user_id or ''):
            mudou['jellyfin_verificado_em'] = timezone.now()
        else:
            # Limpa o carimbo antigo: uma resposta de ontem não prova nada
            # sobre a credencial que acabou de ser gravada.
            mudou['jellyfin_verificado_em'] = None

    if usuario.plex_server_url and usuario.plex_token:
        if _tenta(_pergunta_ao_plex, usuario.plex_server_url, usuario.plex_token):
            mudou['plex_verificado_em'] = timezone.now()
        else:
            mudou['plex_verificado_em'] = None

    return mudou


def _tenta(coroutine, *args) -> bool:
    try:
        return async_to_sync(coroutine)(*args)
    except Exception as erro:
        logger.info('servidor de biblioteca não respondeu: %s', erro)
        return False


def estado(tem_credencial: bool, verificado_em) -> str:
    """O que a tela deve dizer sobre esta integração."""
    if not tem_credencial:
        return NAO_CONFIGURADO
    if not verificado_em:
        return GRAVADO
    idade = timezone.now() - verificado_em
    if idade.total_seconds() > HORAS_ATE_A_RESPOSTA_ENVELHECER * 3600:
        # A resposta envelheceu. Voltar para "gravado" é dizer o que se sabe.
        return GRAVADO
    return RESPONDEU
