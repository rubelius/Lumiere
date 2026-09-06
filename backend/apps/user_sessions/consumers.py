"""
Canal ao vivo de uma sessão.

Antes só transmitia o progresso da preparação, e apenas para o dono. Agora
carrega também a projeção coletiva: quem está assistindo, onde cada um está
no filme, e a conversa.

Envelope único em todas as mensagens — {'type': ..., 'payload': ...}. O
`session_state` saía com a chave 'data' e os outros com 'payload'; nada
consumia este canal ainda, então a hora de uniformizar era agora.
"""

import json
import logging
import time

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

logger = logging.getLogger(__name__)


class SessionConsumer(AsyncWebsocketConsumer):
    """Estado da sessão, presença e chat, em tempo real."""

    # A posição vai ao ar a cada envio, mas ao banco só de tempos em tempos.
    # O cliente reporta de poucos em poucos segundos; gravar todos seria uma
    # escrita por espectador por segundo para guardar um número que só
    # importa se a pessoa voltar depois.
    SEGUNDOS_ENTRE_GRAVACOES = 10

    # Uma fala maior que isto não é conversa, é despejo. O modelo já corta em
    # 2000; recusar antes evita gravar lixo e devolver sucesso.
    LIMITE_DA_FALA = 2000

    async def connect(self):
        self.user = self.scope.get('user')
        self.ultima_gravacao = 0.0
        self.participacao_id = None

        if not self.user or not getattr(self.user, 'is_authenticated', False):
            await self.close()
            return

        self.session_id = self.scope['url_route']['kwargs']['session_id']  # type: ignore

        # Dono OU participante convidado. Antes era só o dono, o que tornava
        # a projeção coletiva impossível: o convidado não conectava.
        acesso = await self.autoriza()
        if not acesso:
            await self.close()
            return

        estado, self.participacao_id = acesso
        self.room_group_name = f'session_{self.session_id}'

        await self.channel_layer.group_add(  # type: ignore
            self.room_group_name, self.channel_name)
        await self.accept()

        await self._send('session_state', estado)
        await self._anuncia_presenca()

    async def disconnect(self, code):
        if hasattr(self, 'room_group_name'):
            # Avisa antes de sair do grupo, senão a própria saída não é
            # transmitida e a pessoa fica na tela dos outros para sempre.
            await self._anuncia_presenca()
            await self.channel_layer.group_discard(  # type: ignore
                self.room_group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        if not text_data:
            return

        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            logger.warning('JSON inválido em SessionConsumer')
            return

        try:
            tipo = data.get('type')
            if tipo == 'ping':
                await self._send('pong', {})
            elif tipo == 'sync':
                await self._trata_sync(data)
            elif tipo == 'chat':
                await self._trata_chat(data)
        except Exception as e:
            # Uma mensagem malformada de um espectador não pode derrubar a
            # conexão dos outros.
            logger.error('Erro ao processar %s: %s', data.get('type'), e)

    # ── entrada ──────────────────────────────────────────────────────────

    async def _trata_sync(self, data):
        """Recebe a posição de quem está assistindo e repassa aos demais."""
        posicao = max(0, int(data.get('position') or 0))
        estado = data.get('state') or 'paused'

        agora = time.monotonic()
        if agora - self.ultima_gravacao >= self.SEGUNDOS_ENTRE_GRAVACOES:
            self.ultima_gravacao = agora
            await self.grava_posicao(posicao, estado)

        # Ao ar sempre: a tela dos outros precisa acompanhar em tempo real,
        # mesmo nos ciclos em que não se grava.
        await self.channel_layer.group_send(self.room_group_name, {  # type: ignore
            'type': 'participant_sync',
            'data': {
                'participant_id': str(self.participacao_id),
                'position': posicao,
                'state': estado,
            },
        })

    async def _trata_chat(self, data):
        texto = (data.get('text') or '').strip()[:self.LIMITE_DA_FALA]
        if not texto:
            return

        fala = await self.grava_fala(texto, max(0, int(data.get('position') or 0)))
        await self.channel_layer.group_send(self.room_group_name, {  # type: ignore
            'type': 'chat_message', 'data': fala})

    # ── saída para o grupo ───────────────────────────────────────────────

    async def participant_sync(self, event):
        await self._send('sync', event.get('data', {}))

    async def chat_message(self, event):
        await self._send('chat', event.get('data', {}))

    async def presence(self, event):
        await self._send('participants', {'participants': event.get('data', [])})

    async def session_update(self, event):
        raw = event.get('data', {})
        await self._send('session_updated', {
            'status': raw.get('status', ''),
            'download_progress': raw.get('download_progress', 0),
            'preparation_progress': raw.get('preparation_progress', 0),
        })

    async def download_progress(self, event):
        raw = event.get('data', {})
        await self._send('download_progress', {
            'movie_id': str(raw.get('movie_id', '')),
            'progress': int(raw.get('progress', 0)),
        })

    # ── banco ────────────────────────────────────────────────────────────

    @database_sync_to_async
    def autoriza(self):
        """
        Devolve (estado da sessão, id da participação) ou None.

        A participação do dono é criada na primeira conexão: ele é o
        anfitrião e precisa aparecer na lista de quem está assistindo como
        qualquer outro.
        """
        from apps.user_sessions.models import CinemaSession, SessionParticipant
        # CinemaSessionDetailSerializer nunca existiu. O consumer antigo a
        # importava fora do try, então TODA conexão estourava ImportError
        # antes de chegar ao banco — o canal nunca funcionou, e como nada o
        # consumia, ninguém notou.
        from apps.user_sessions.serializers import CinemaSessionSerializer

        sessao = CinemaSession.objects.filter(id=self.session_id).first()
        if not sessao:
            return None

        if sessao.user_id == self.user.id:  # type: ignore
            participacao, _ = SessionParticipant.objects.get_or_create(
                session=sessao, user=self.user,
                defaults={'role': SessionParticipant.PAPEL_ANFITRIAO})
        else:
            participacao = SessionParticipant.objects.filter(
                session=sessao, user=self.user).first()
            if not participacao:
                return None

        # `detail` popula session_movies: quem abre a projeção precisa da fila.
        return (CinemaSessionSerializer(sessao, context={'detail': True}).data,
                participacao.id)

    @database_sync_to_async
    def grava_posicao(self, posicao, estado):
        from apps.user_sessions.models import SessionParticipant
        SessionParticipant.objects.filter(id=self.participacao_id).update(
            playback_position_seconds=posicao, playback_state=estado)

    @database_sync_to_async
    def grava_fala(self, texto, posicao):
        from apps.user_sessions.models import SessionMessage, SessionParticipant
        from apps.user_sessions.serializers import SessionMessageSerializer

        participacao = SessionParticipant.objects.select_related('user').get(
            id=self.participacao_id)
        fala = SessionMessage.objects.create(
            session_id=self.session_id, participant=participacao,
            text=texto, playback_position_seconds=posicao)
        return SessionMessageSerializer(fala).data

    @database_sync_to_async
    def lista_participantes(self):
        from apps.user_sessions.models import SessionParticipant
        from apps.user_sessions.serializers import SessionParticipantSerializer

        pessoas = SessionParticipant.objects.filter(
            session_id=self.session_id).select_related('user')
        return SessionParticipantSerializer(pessoas, many=True).data

    # ── auxiliares ───────────────────────────────────────────────────────

    async def _anuncia_presenca(self):
        await self.channel_layer.group_send(self.room_group_name, {  # type: ignore
            'type': 'presence', 'data': await self.lista_participantes()})

    async def _send(self, msg_type: str, payload):
        await self.send(text_data=json.dumps({'type': msg_type, 'payload': payload}))
