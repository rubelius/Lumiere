from dataclasses import asdict

from django.http import HttpResponse, StreamingHttpResponse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework.decorators import api_view, permission_classes
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Count, Q, F, Sum, Value, FloatField, CharField
from django.db.models.functions import Coalesce, Greatest
from django.contrib.postgres.search import TrigramSimilarity
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
import logging

from django.utils import timezone
from asgiref.sync import async_to_sync, sync_to_async

from apps.core.core_cache import CacheManager
from apps.core.throttling import ExpensiveOperationThrottle
from apps.integrations.realdebrid import (RealDebridClient,
                                             chave_do_usuario)
from apps.movies.playback import resolve_playback
from apps.movies.subtitle_service import busca_legendas, obtem_vtt
from apps.ml.models import MovieSimilarity
from apps.ml.similarity import (agenda_retreino_do_gosto, diversifica,
                                 recomenda_para)

from .filters import MovieFilter
from .models import Movie, TorrentRelease, WatchHistory
from .realdebrid_sync import atualiza_resumo
from .realdebrid_estado import sincroniza_filme
from .como_tocar import como_tocar
from .transcode import (NADA, SO_AUDIO, abre_fluxo, o_que_transcodificar,
                        segundo_de_partida)
from .release_search import (estado_da_busca, libera, marca_enfileirada,
                             normaliza_filtros)
from apps.tasks.torrents import search_torrents_for_movie
from .paises import origens_distintas
from .serializers import (
    ArchiveStatsSerializer,
    campos_da_listagem,
    ids_assistidos,
    ProgressoSerializer,
    WatchHistorySerializer,
    MovieDetailSerializer, 
    MovieListSerializer,
    MovieSerializer,
    ComoTocarSerializer,
    PlaybackSourceSerializer,
    SubtitleSerializer,
    TorrentReleaseSerializer
)

logger = logging.getLogger(__name__)


class AsyncMovieViewSet(viewsets.ViewSet):
    async def list(self, request):
        movies = []
        async for movie in Movie.objects.all()[:20]:
            movies.append(movie)
        return Response({'count': len(movies), 'results': [movie.title for movie in movies]})

class MarcaAssistidos:
    """
    Põe no contexto do serializer o conjunto de filmes que este usuário já viu.

    Fica num mixin porque a resposta precisa ser a mesma em toda superfície —
    listagem, busca, detalhe, parecidos. Foi a regra de disponibilidade
    repetida em quatro telas que envelheceu nas quatro ao mesmo tempo, e o
    indicador de assistido tem exatamente a mesma forma de espalhar.

    Uma consulta por resposta, não por filme.
    """

    def get_serializer(self, *args, **kwargs):
        serializer = super().get_serializer(*args, **kwargs)

        instancia = args[0] if args else None
        if instancia is None:
            return serializer

        filmes = instancia if isinstance(instancia, (list, tuple)) else None
        if filmes is None:
            filmes = list(instancia) if kwargs.get('many') else [instancia]

        serializer.context['assistidos'] = ids_assistidos(
            getattr(self.request, 'user', None), filmes)
        return serializer


class MovieViewSet(MarcaAssistidos, viewsets.ReadOnlyModelViewSet):
    """
    ViewSet para filmes - MOTOR HÍBRIDO DEFINITIVO (Trigramas + Força-Bruta)
    """
    permission_classes = [IsAuthenticated]
    queryset = Movie.objects.all()
    
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_class = MovieFilter
    ordering_fields = ['year', 'ranking_current', 'tmdb_rating', 'created_at']
    ordering = ['ranking_current']
    
    def get_serializer_class(self): 
        if self.action == 'list':
            return MovieListSerializer
        if self.action == 'retrieve':
            return MovieDetailSerializer
        return MovieSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        search_term = self.request.query_params.get('search', None)
        
        if self.action == 'list' and not search_term:
            # A lista vem do próprio serializer, não escrita à mão. Cinco
            # campos que ele lê tinham ficado de fora, e cada um deles é uma
            # consulta extra POR FILME: 101 consultas para uma página de 20,
            # contra 1 sem o only(). A otimização estava custando cem vezes o
            # que economizava, e nada acusava — o resultado saía correto.
            queryset = queryset.only(*campos_da_listagem())
        elif self.action == 'retrieve':
            queryset = queryset.prefetch_related('torrent_releases')
            
        return queryset

    def list(self, request, *args, **kwargs):
        search_term = request.query_params.get('search', None)
        
        if search_term:
            search_term = search_term.strip()
            queryset = self.filter_queryset(self.get_queryset())
            
            print(f"\n[SONAR] Usuário buscou por: '{search_term}'")
            
            # --- 1. MOTOR DE TRIGRAMAS (Perfeito para erros de digitação como "Tarkovky") ---
            empty_char = Value('', output_field=CharField())
            
            # Avalia a similaridade do que foi digitado com Título e Diretor
            trigram_score = Greatest(
                TrigramSimilarity(Coalesce('title', empty_char), search_term),
                TrigramSimilarity(Coalesce('original_title', empty_char), search_term),
                TrigramSimilarity(Coalesce('director', empty_char), search_term),
                Value(0.0, output_field=FloatField())
            )
            
            # --- 2. MOTOR FORÇA-BRUTA (O nosso fiel escudeiro de fallback) ---
            final_q = Q()
            words = [w for w in search_term.split() if len(w) > 2]
            if not words:
                words = [search_term]

            for word in words:
                radical = word[:-2] if len(word) > 4 else word
                word_q = (
                    Q(title__icontains=radical) |
                    Q(original_title__icontains=radical) |
                    Q(director__icontains=radical) |
                    Q(overview__icontains=radical) |
                    Q(country__icontains=radical)
                )
                if word.isdigit() and len(word) == 4:
                    word_q |= Q(year=int(word))

                if not final_q:
                    final_q = word_q
                else:
                    final_q &= word_q

            # --- 3. EXECUÇÃO DA BUSCA ---
            # O filme passa de ano se tiver pelo menos 12% de similaridade OU se bater no força-bruta
            queryset = queryset.annotate(
                match_score=trigram_score
            ).filter(
                Q(match_score__gte=0.12) | final_q
            ).distinct()
            
            # --- 4. ORDENAÇÃO DE OURO ---
            # Primeiro quem tem a maior nota de semelhança gráfica, DEPOIS as maiores notas do TMDB!
            queryset = queryset.order_by(
                '-match_score', 
                F('tmdb_rating').desc(nulls_last=True), 
                'ranking_current'
            )
            
            print(f"[SONAR] Filmes encontrados: {queryset.count()}\n")
            
            page = self.paginate_queryset(queryset)
            if page is not None:
                serializer = self.get_serializer(page, many=True)
                return self.get_paginated_response(serializer.data)
                
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)

        return super().list(request, *args, **kwargs)
    
    def retrieve(self, request, *args, **kwargs):
        """
        A ficha do filme, com a parte estável vinda do cache.

        O cache guardava a ficha INTEIRA numa chave global `movie:<id>`, e a
        ficha traz campos que dependem de quem pediu: `watch_state` e a ordem
        de `similar_movies`, que despriorizada o que aquele usuário já viu.
        Quem chegasse depois recebia a resposta montada para o primeiro —
        verificado: a posição de 4242s de um usuário chegou ao player de outro,
        que nunca tinha assistido nada.

        Guardar só a parte estável, e recalcular a do usuário a cada pedido,
        resolve sem depender de invalidação por padrão de chave (que existe no
        CacheManager mas engole erro em silêncio). Medido nesta ficha: 45ms no
        total, dos quais 31ms são os dois campos por usuário — o cache cobre os
        14ms que sobram, e são justamente os que não mudam.
        """
        movie_id = str(kwargs.get('pk'))
        estavel = CacheManager.get_movie(movie_id)

        movie = self.get_object()
        serializer = self.get_serializer(movie)
        por_usuario = {campo: getattr(serializer, f'get_{campo}')(movie)
                       for campo in MovieDetailSerializer.CAMPOS_POR_USUARIO}

        if estavel is None:
            estavel = {k: v for k, v in serializer.data.items()
                       if k not in MovieDetailSerializer.CAMPOS_POR_USUARIO}
            CacheManager.set_movie(movie_id, estavel, timeout=3600)

        return Response({**estavel, **por_usuario})
    
    @extend_schema(
        responses={
            200: PlaybackSourceSerializer,
            404: OpenApiResponse(description='Nenhuma fonte tem este filme.'),
        },
        description=(
            'Resolve onde tocar o filme, na ordem Real-Debrid > Jellyfin > Plex. '
            'Devolve a primeira fonte que responder.'
        ),
    )
    @extend_schema(
        request=ProgressoSerializer,
        responses={200: WatchHistorySerializer},
        summary='Registra onde o usuário parou, e marca como visto ao chegar ao fim.',
        description=(
            'Chamado periodicamente pelo player. Grava a posição para permitir '
            'retomar, e ao cruzar o limite de conclusão marca o filme como '
            'assistido — o que o retira da frente nas sugestões e realimenta o '
            'perfil de gosto do usuário.'
        ),
    )
    @action(detail=True, methods=['post'])
    def progress(self, request, pk=None):
        entrada = ProgressoSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)

        movie = self.get_object()
        registro, _ = WatchHistory.objects.get_or_create(
            user=request.user, movie=movie,
            defaults={'source': 'player'},
        )

        # A duração do arquivo é a verdade; o metadado do acervo é aproximação
        # e diverge em minutos num REMUX. Só cai nele se o player não souber.
        duracao = entrada.validated_data.get('duration') or 0
        if not duracao and movie.length_minutes:
            duracao = movie.length_minutes * 60

        concluiu_agora = registro.registra_progresso(
            segundos=entrada.validated_data['position'], duracao=duracao)
        registro.save()

        if concluiu_agora:
            # Só na travessia. A cada ping de um filme já visto isto seria
            # trabalho repetido sem nenhuma informação nova para aprender.
            agenda_retreino_do_gosto(request.user)

        return Response(WatchHistorySerializer(registro).data)

    @extend_schema(
        request=None,
        responses={200: WatchHistorySerializer},
        summary='Marca ou desmarca o filme como assistido, à mão.',
        description=(
            'Para o que foi visto fora do Lumière. POST marca, DELETE desmarca. '
            'Desmarcar não apaga o histórico: zera a conclusão e devolve o filme '
            'às sugestões, preservando quantas vezes já foi visto.'
        ),
    )
    @action(detail=True, methods=['post', 'delete'], url_path='watched')
    def watched(self, request, pk=None):
        movie = self.get_object()
        registro, _ = WatchHistory.objects.get_or_create(
            user=request.user, movie=movie, defaults={'source': 'manual'})

        if request.method == 'DELETE':
            registro.completed = False
            registro.save(update_fields=['completed', 'last_watched_at'])
            return Response(WatchHistorySerializer(registro).data)

        if not registro.completed:
            registro.completed = True
            registro.times_watched += 1
            registro.save(update_fields=['completed', 'times_watched', 'last_watched_at'])
            agenda_retreino_do_gosto(request.user)

        return Response(WatchHistorySerializer(registro).data)

    @extend_schema(
        responses={200: ArchiveStatsSerializer},
        summary='Números do acervo: quantos filmes, quantas horas, quantos países.',
        description=(
            'A home exibia estes três como "métricas em tempo real". Dois eram '
            'inventados: as horas vinham de multiplicar a contagem de filmes '
            'por 1.8, e os países eram a constante 92 para qualquer acervo com '
            'ao menos um filme. Agora são agregações de verdade.'
        ),
    )
    @action(detail=False, url_path='archive-stats')
    def archive_stats(self, request):
        # Três agregações numa consulta cada, sobre colunas indexadas. A home
        # pede isto uma vez por carga.
        agregado = Movie.objects.aggregate(
            filmes=Count('id'), minutos=Sum('length_minutes'))
        # DISTINCT sobre a coluna crua conta COMBINAÇÕES de coprodução, não
        # países: 'UK-Germany-Sweden' é um valor só, e 'US' e 'USA' são dois
        # valores para o mesmo lugar. Bastava isso para publicar 423 países
        # num mundo que tem menos de 200.
        #
        # Traz só os valores distintos (algumas centenas), não uma linha por
        # filme: a normalização é em memória e não precisa do acervo inteiro.
        combinacoes = (
            Movie.objects.exclude(country='').exclude(country__isnull=True)
            .values_list('country', flat=True).distinct()
        )
        paises = len(origens_distintas(combinacoes))
        return Response({
            'movies': agregado['filmes'] or 0,
            'hours': round((agregado['minutos'] or 0) / 60),
            'countries': paises,
        })

    @extend_schema(
        responses={200: MovieListSerializer(many=True)},
        summary='Filmes começados e ainda não terminados, do mais recente ao mais antigo.',
        description=(
            'O "retomar" da home. Vem do servidor, não do navegador: uma '
            'posição guardada só no aparelho se perde ao trocar de máquina, '
            'que é justamente quando retomar importa.'
        ),
    )
    @action(detail=False, url_path='continue-watching')
    def continue_watching(self, request):
        # Progresso maior que zero: uma linha criada no primeiro ping, com o
        # filme ainda parado no segundo zero, não é algo "começado".
        registros = (
            WatchHistory.objects
            .filter(user=request.user, completed=False, progress_seconds__gt=0)
            .select_related('movie').order_by('-last_watched_at')[:12]
        )
        filmes = [r.movie for r in registros]
        contexto = {'assistidos': ids_assistidos(request.user, filmes),
                    'request': request}

        return Response({
            'count': len(filmes),
            'results': [
                {
                    'movie': MovieListSerializer(r.movie, context=contexto).data,
                    'progress_seconds': r.progress_seconds,
                    'runtime_seconds': r.runtime_seconds,
                    'fraction': round(r.fracao_assistida, 4),
                    'last_watched_at': r.last_watched_at,
                }
                for r in registros
            ],
        })

    @extend_schema(
        responses={200: MovieListSerializer(many=True)},
        summary='Filmes que combinam com o gosto do usuário e que ele ainda não viu.',
        description=(
            'Calculado na hora a partir do vetor do perfil de gosto, que é '
            'retreinado a cada filme concluído. Devolve lista vazia enquanto '
            'não houver perfil — mostrar popularidade e chamar de '
            'personalização seria pior que não mostrar nada.'
        ),
    )
    @action(detail=False, methods=['get'])
    def recommended(self, request):
        filmes = recomenda_para(request.user, limite=20)
        contexto = {'assistidos': ids_assistidos(request.user, filmes),
                    'request': request}
        return Response({
            'count': len(filmes),
            'has_profile': hasattr(request.user, 'taste_profile'),
            'results': MovieListSerializer(filmes, many=True, context=contexto).data,
        })

    @action(detail=True, methods=['get'])
    def playback(self, request, pk=None):
        # Ação síncrona de propósito: o dispatch desta ViewSet é síncrono
        # (list/retrieve são sync), então uma action `async def` devolveria a
        # corrotina sem ninguém aguardá-la.
        movie = self.get_object()
        # `release` deixa a tela pedir uma cópia específica — o selo de
        # disponibilidade imediata é um botão que toca AQUELA.
        fonte = async_to_sync(resolve_playback)(
            movie, request.user, release_id=request.query_params.get('release') or None)

        if not fonte:
            return Response(
                {'detail': 'Nenhuma fonte disponível para este filme.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(asdict(fonte))

    @extend_schema(
        responses=ComoTocarSerializer,
        description=(
            'O que o botão de projeção vai fazer com este filme, e o que '
            'oferecer quando não houver cópia que o navegador toque agora.'
        ),
    )
    @action(detail=True, methods=['get'], url_path='como-tocar')
    def como_tocar_action(self, request, pk=None):
        """
        A decisão do botão, calculada onde estão os dados que ela precisa.

        Antes a tela decidia sozinha, com `available_instantly ||
        cached_in_realdebrid` — uma conta que não sabe o que o navegador
        aguenta, e que por isso prometia projeção sobre REMUX com DTS.
        """
        return Response(como_tocar(self.get_object()))

    @extend_schema(
        parameters=[OpenApiParameter(
            name='languages', description='Idiomas separados por vírgula.',
            required=False, type=str,
        )],
        responses=SubtitleSerializer(many=True),
        description=(
            'Legendas externas disponíveis no OpenSubtitles. Lista vazia '
            'quando a chave de API não está configurada.'
        ),
    )
    @action(detail=True, methods=['get'])
    def subtitles(self, request, pk=None):
        movie = self.get_object()
        idiomas = request.query_params.get('languages', 'pt-BR,pt-PT,en')
        legendas = async_to_sync(busca_legendas)(movie, request.user, idiomas)
        return Response(SubtitleSerializer(legendas, many=True).data)

    @action(detail=False, methods=['get'])
    def top_rated(self, request):
        movies = self.queryset.filter(ranking_current__isnull=False).order_by('ranking_current')[:100]
        serializer = self.get_serializer(movies, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def available(self, request):
        movies = self.queryset.filter(Q(in_plex=True) | Q(available_instantly=True))
        page = self.paginate_queryset(movies)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(movies, many=True)
        return Response(serializer.data)
    
    @action(detail=False)
    def with_releases(self, request):
        movies = Movie.objects.prefetch_related('torrent_releases')[:20]
        serializer = self.get_serializer(movies, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def recommendations(self, request, pk=None):
        movie = self.get_object()
        # Diversifica antes de cortar: metade dos filmes de diretor canônico
        # recebia uma lista que era, em maioria, a própria filmografia.
        similarities = diversifica(
            MovieSimilarity.objects.filter(movie=movie)
            .select_related('similar_movie').order_by('-overall_similarity'),
            limite=20,
        )
        recommendations = [{
            'movie': MovieListSerializer(sim.similar_movie).data,
            'similarity_score': float(sim.overall_similarity),
            'similarity_type': sim.similarity_type,
            'reason': f"Similar {str(sim.similarity_type).replace('_', ' ')}"
        } for sim in similarities]
        return Response({'based_on': MovieListSerializer(movie).data, 'recommendations': recommendations})
    
    @extend_schema(
        responses=OpenApiTypes.OBJECT,
        description=(
            'Enfileira a busca de cópias e devolve o documento de estado. '
            'A busca leva de 40 a 100 segundos e não cabe numa requisição.'
        ),
    )
    @action(detail=True, methods=['post'], throttle_classes=[ExpensiveOperationThrottle])
    def search_torrents(self, request, pk=None):
        """
        Toca a campainha. Quem trabalha é o worker.

        Era síncrona e prendia a requisição de 40 a 100 segundos — medido
        contra o Prowlarr real. O gargalo é um indexador só, que agrega os
        indexadores do Jackett; os outros oito somados respondem em menos de
        dois segundos. Nenhum ajuste nosso encurta isso, então a busca sai do
        caminho do pedido.
        """
        movie = self.get_object()
        user = request.user

        if not user.prowlarr_url or not user.prowlarr_api_key:
            return Response(
                {'error': 'O Prowlarr não está configurado. Ajuste em Configurações.'},
                status=status.HTTP_400_BAD_REQUEST)

        filtros = normaliza_filtros(request.data)
        doc = marca_enfileirada(str(movie.id))

        if doc is None:
            # Já há busca em voo para este filme. Não enfileira outra: as duas
            # telas passam a acompanhar a mesma, e o Prowlarr é visitado uma
            # vez só.
            return Response(estado_da_busca(str(movie.id)),
                            status=status.HTTP_202_ACCEPTED)

        try:
            search_torrents_for_movie.delay(str(movie.id), str(user.id), filtros)
        except Exception as e:
            # Solta a reivindicação na hora: sem isto o botão ficaria travado
            # cinco minutos por causa de um broker fora do ar.
            libera(str(movie.id))
            logger.warning('A busca não foi enfileirada: %s', e)
            return Response(
                {'error': 'A fila de tarefas não respondeu; a busca não foi enfileirada.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE)

        return Response(doc, status=status.HTTP_202_ACCEPTED)

    @extend_schema(
        parameters=[
            OpenApiParameter(name='release', description='Qual cópia transcodificar.',
                             required=False, type=str),
            OpenApiParameter(name='inicio', description='Segundo em que começar.',
                             required=False, type=float),
        ],
        responses={(200, 'video/mp4'): OpenApiTypes.BINARY},
        description='O filme convertido para algo que o navegador toca.',
    )
    @action(detail=True, methods=['get'])
    def transcode(self, request, pk=None):
        """
        Serve a cópia convertida, enquanto ela é convertida.

        O `<video>` não decodifica DTS, TrueHD nem Dolby Digital, e são essas
        as faixas das cópias de maior nota. Aqui o fluxo de vídeo é COPIADO e
        só o áudio é convertido — medido contra um REMUX HEVC + DTS 5.1 do
        Real-Debrid: 4x a velocidade da reprodução, a 15% de CPU.

        A resposta não aceita requisição por faixa: é um fluxo sendo produzido
        agora, não um arquivo. Saltar é pedir de novo com `?inicio=`, e por
        isso o cabeçalho diz `Accept-Ranges: none` — sem ele o navegador tenta
        a faixa, recebe o começo, e conclui que o vídeo tem a duração errada.
        """
        movie = self.get_object()
        fonte = async_to_sync(resolve_playback)(
            movie, request.user, release_id=request.query_params.get('release') or None)

        if not fonte:
            return Response({'error': 'Nenhuma fonte disponível para este filme.'},
                            status=status.HTTP_404_NOT_FOUND)

        release = (TorrentRelease.objects.filter(pk=fonte.release_id).first()
                   if fonte.release_id else None)

        inicio = segundo_de_partida(
            request.query_params.get('inicio'),
            fonte.duracao_segundos or (release.duration_seconds if release else None))
        escopo = o_que_transcodificar(release) if release else SO_AUDIO
        if escopo == NADA:
            escopo = SO_AUDIO

        _, pedacos = abre_fluxo(fonte.stream_url, inicio, escopo)

        resposta = StreamingHttpResponse(pedacos, content_type='video/mp4')
        resposta['Accept-Ranges'] = 'none'
        resposta['Cache-Control'] = 'no-store'
        resposta['X-Lumiere-Transcode'] = escopo
        return resposta

    @extend_schema(
        responses=OpenApiTypes.OBJECT,
        description='Confere na conta do Real-Debrid o estado das cópias deste filme.',
    )
    @action(detail=True, methods=['post'])
    def realdebrid_state(self, request, pk=None):
        """
        Pergunta ao Real-Debrid o que ele já tem deste filme.

        Substitui a checagem de cache que o provedor desativou. A pergunta
        antiga — "este hash está no acervo do Real-Debrid?" — não tem mais
        resposta; esta — "está na MINHA conta, e em que pé?" — tem.

        A varredura da conta fica guardada por alguns minutos, então abrir o
        segundo filme não custa nada.
        """
        movie = self.get_object()

        # Só a leitura da conta, que é barata e vem guardada. A sondagem de
        # cache — "este magnet toca agora?" — NÃO entra aqui: cada uma adiciona
        # e remove um torrent na conta, o Real-Debrid limita a taxa, e as cinco
        # melhores levam ~10 segundos em fila. Ela roda no fim da busca, em
        # segundo plano, e a ficha lê o que ficou registrado.
        falhou = sincroniza_filme(movie, request.user)

        releases = (TorrentRelease.objects.filter(movie=movie)
                    .order_by('-quality_score', '-seeders'))
        return Response({
            'consulta_falhou': falhou,
            'releases': TorrentReleaseSerializer(releases, many=True).data,
        })

    @extend_schema(
        responses=OpenApiTypes.OBJECT,
        description='O que está acontecendo com a busca de cópias deste filme.',
    )
    @action(detail=True, methods=['get'])
    def search_status(self, request, pk=None):
        """
        O estado da busca, para o cliente perguntar enquanto espera.

        Action SEPARADA, e não `methods=['get', 'post']` na de cima: o
        `throttle_classes` do decorator vira atributo da instância e valeria
        para os dois verbos. Com o ExpensiveOperationThrottle a 10 por hora, a
        consulta de 2 em 2 segundos tomaria 429 em meio minuto — e um 429 no
        polling é o tipo de falha que não aparece na tela.
        """
        return Response(estado_da_busca(str(self.get_object().id)))


class TorrentReleaseViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = TorrentRelease.objects.all()
    serializer_class = TorrentReleaseSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['movie', 'resolution', 'is_remux', 'has_atmos', 'in_realdebrid']
    ordering_fields = ['quality_score', 'seeders', 'found_at']
    ordering = ['-quality_score', '-seeders']
    
    def get_queryset(self):
        queryset = super().get_queryset()
        movie_id = self.request.query_params.get('movie_id')
        if movie_id:
            queryset = queryset.filter(movie_id=movie_id)
        return queryset
    
    @action(detail=True, methods=['post'])
    def add_to_realdebrid(self, request, pk=None):
        # Ação síncrona: o dispatch desta ViewSet é síncrono (list/retrieve
        # são sync), então uma action `async def` devolveria a corrotina sem
        # ninguém aguardá-la e o DRF estoura com "Expected a Response".
        # O corpo segue assíncrono, executado por async_to_sync.

        async def _executar():
            release = await sync_to_async(self.get_object)()
            user = request.user
            if not chave_do_usuario(user):
                return Response({'error': 'O Real-Debrid não está configurado. Ajuste em Configurações.'}, status=status.HTTP_400_BAD_REQUEST)
            
            if release.in_realdebrid and release.realdebrid_id and release.realdebrid_status not in ('error', 'dead'):
                return Response({'message': 'Release is already active in Real-Debrid.', 'torrent_id': release.realdebrid_id, 'status': release.realdebrid_status})
        
            if not release.magnet_link:
                return Response(
                    {'error': 'Esta cópia não tem magnet link para enviar.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            client = RealDebridClient(chave_do_usuario(user))
            try:
                torrent_id = await client.add_magnet(release.magnet_link)

                # Sem escolher arquivo, o torrent fica preso em
                # 'waiting_files_selection' do lado do Real-Debrid e nunca
                # baixa. Antes o resultado de select_files era descartado e o
                # banco gravava 'downloading' mesmo assim: a tela dizia que
                # estava vindo algo que não estava.
                info = await client.get_torrent_info(torrent_id)
                arquivos = info.get('files') or []
                if not arquivos:
                    return Response(
                        {'error': 'O Real-Debrid aceitou o magnet mas não listou os arquivos.'},
                        status=status.HTTP_502_BAD_GATEWAY,
                    )
                maior = max(arquivos, key=lambda f: f.get('bytes', 0))
                if not await client.select_files(torrent_id, [maior['id']]):
                    return Response(
                        {'error': 'O Real-Debrid não aceitou a escolha do arquivo.'},
                        status=status.HTTP_502_BAD_GATEWAY,
                    )

                # Relê depois de escolher: o que já está no acervo do RD volta
                # 'downloaded' na hora, e gravar 'downloading' faria a tela
                # anunciar uma espera que não existe.
                depois = await client.get_torrent_info(torrent_id)
                estado = depois.get('status') or 'downloading'
            except Exception as e:
                logger.exception('Falha ao enviar release %s ao Real-Debrid', release.pk)
                return Response(
                    {'error': f'Não foi possível enviar ao Real-Debrid: {e}'},
                    status=status.HTTP_502_BAD_GATEWAY,
                )
            finally:
                await client.close()

            release.in_realdebrid = True
            release.realdebrid_id = torrent_id
            release.realdebrid_status = estado
            release.realdebrid_progress = int(depois.get('progress') or 0)
            release.realdebrid_added_at = timezone.now()
            if estado in TorrentRelease.ESTADOS_CONCLUIDOS:
                release.realdebrid_completed_at = timezone.now()
                release.realdebrid_links = depois.get('links') or []
            await sync_to_async(_grava_importacao)(release)
            return Response({
                'message': 'Enviado ao Real-Debrid.',
                'torrent_id': torrent_id,
                'realdebrid_status': estado,
                'disponibilidade': release.disponibilidade,
            })

        return async_to_sync(_executar)()


def _grava_importacao(release):
    """
    Grava a cópia e reflete a mudança em todo lugar que a mostra.

    São três passos porque são três lugares que guardam a resposta:
    a linha da cópia, o resumo do filme (que é o que o card do acervo lê)
    e o cache de uma hora da ficha do filme. Sem invalidar o último, a
    tela continuaria mostrando o estado anterior por até uma hora depois
    da importação — o botão pareceria não ter feito nada.
    """
    release.save()
    atualiza_resumo(release.movie)
    CacheManager.invalidate_movie(str(release.movie_id))


@extend_schema(
    responses={
        (200, 'text/vtt'): OpenApiTypes.STR,
        404: OpenApiResponse(description='Conta OpenSubtitles não conectada ou legenda indisponível.'),
    },
    description=(
        'Conteúdo da legenda já convertido para WebVTT, que é o único formato '
        'que a tag <track> do navegador entende.'
    ),
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def subtitle_vtt(request, file_id: int):
    vtt = async_to_sync(obtem_vtt)(request.user, file_id)
    if not vtt:
        return Response(
            {'detail': 'Legenda indisponível. Conecte sua conta OpenSubtitles.'},
            status=status.HTTP_404_NOT_FOUND,
        )
    # text/vtt para o navegador aceitar no <track>.
    return HttpResponse(vtt, content_type='text/vtt; charset=utf-8')
