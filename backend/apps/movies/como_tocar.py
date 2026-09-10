"""
O que acontece quando alguém aperta "iniciar projeção".

Existe porque a tela vinha respondendo essa pergunta sozinha, com uma conta de
uma linha só — `available_instantly || cached_in_realdebrid` —, e essa conta
não sabe o que o navegador aguenta. Um filme cuja única cópia imediata é um
REMUX com DTS aparecia com o botão pulsando, prometendo projeção; a projeção
vinha muda.

A regra, decidida com o usuário:

    entre as cópias com DISPONIBILIDADE IMEDIATA que o NAVEGADOR TOCA,
    a de MELHOR NOTA.

Compatibilidade é requisito, não desempate — e a diferença importa. Como
desempate, o botão poderia escolher uma cópia de nota alta que o navegador não
aceita, tendo uma aceitável ao lado; como requisito, ele só promete o que
cumpre. Quando esse conjunto é vazio mas existe algo imediato, a escolha volta
para quem está assistindo: esperar um download ou tocar agora com conversão são
custos diferentes, e quem paga decide.

MEDIDO NESTE ACERVO, e é o que dimensiona a tela: `toca` de fato — cópia que
declara codec de áudio que o navegador abre — são 4 em 63. Se compatibilidade
exigisse esse selo, quase todo filme cairia na pergunta. Mas a peneira aqui é
`o_que_transcodificar(r) == NADA`, que também deixa passar as `talvez` (31 de
63, cópias que simplesmente não declaram o áudio). Com isso a pergunta aparece
em 1 dos 5 filmes do acervo — uma escolha de verdade, e não um pedágio.
"""

import logging

from apps.movies.transcode import NADA, o_que_transcodificar

logger = logging.getLogger(__name__)

# O que a tela deve fazer.
TOCA_AGORA = 'toca_agora'      # há cópia imediata e otimizada: aperta e assiste
ESCOLHER = 'escolher'          # há cópia imediata, nenhuma otimizada: pergunta
NADA_IMEDIATO = 'nada'         # não há cópia imediata nenhuma

# Quantas cópias imediatas oferecer na escolha. Mostrar as trinta e duas de
# "2001" transformaria uma pergunta em um formulário.
QUANTAS_OFERECER = 5


def _toca_agora(release) -> bool:
    """
    Se esta cópia pode ir ao ar em segundos.

    `pronta` é link na conta; `instantanea` é o acervo do Real-Debrid ter o
    arquivo, e importar leva ~2s — medido. As duas servem para apertar play;
    `baixando` e `ausente` não.
    """
    return release.disponibilidade in (release.PRONTA, release.INSTANTANEA)


def _resumo(release) -> dict:
    """A cópia como a tela precisa vê-la para explicar a escolha."""
    return {
        'release_id': str(release.id),
        'title': release.title,
        'quality_score': release.quality_score or 0,
        'size_gb': release.size_gb,
        'resolution': release.resolution,
        'video_codec': release.video_codec,
        'audio_codec': release.audio_codec,
        'compatibilidade': release.compatibilidade,
        'disponibilidade': release.disponibilidade,
        'precisa_converter': o_que_transcodificar(release),
        'pode_importar': release.pode_importar,
    }


def como_tocar(movie) -> dict:
    """
    O que o botão de projeção vai fazer, e o que oferecer se não der.

    Devolve sempre a mesma forma, com todas as chaves — quem lê não precisa
    descobrir quais existem neste caso. `escolhida` é None só quando o filme
    não tem cópia nenhuma.
    """
    copias = list(movie.torrent_releases.all())
    if not copias:
        return {
            'decisao': NADA_IMEDIATO,
            'escolhida': None,
            'melhor_para_navegador': None,
            'imediatas': [],
        }

    copias.sort(key=lambda r: -(r.quality_score or 0))
    imediatas = [r for r in copias if _toca_agora(r)]

    # "O navegador dá conta desta?" é a MESMA pergunta que decide se o fluxo
    # passa pelo conversor — perguntá-la por aqui com outro critério criaria
    # duas respostas para uma coisa só, e elas divergiriam na primeira vez que
    # a tabela de codecs mudasse.
    #
    # Inclui `talvez` (cópia que não declara o codec de áudio), e são 31 das 63:
    # tratá-las como incompatíveis mandaria metade do acervo para o conversor
    # sem necessidade. O selo na tela continua distinguindo uma coisa da outra.
    imediatas_para_navegador = [r for r in imediatas
                                if o_que_transcodificar(r) == NADA]

    # A melhor cópia que o navegador toca sem conversão e que ainda precisa ser
    # baixada — é ela que "baixar e ser avisado" iria buscar.
    #
    # `pode_importar` sozinho responde as DUAS condições: ele exige magnet (sem
    # magnet não há o que enviar ao Real-Debrid, e as cópias vindas da
    # sincronização nascem sem) e exige `disponibilidade == AUSENTE`, que já
    # implica não estar disponível. Escrever "and not _toca_agora(r)" ao lado
    # parecia mais explícito e era código morto — a mutação que o desligava não
    # mudava nenhum resultado.
    candidatas = [r for r in copias
                  if o_que_transcodificar(r) == NADA
                  and r.pode_importar]

    if imediatas_para_navegador:
        # Imediata, otimizada, e a melhor nota entre essas.
        decisao, escolhida = TOCA_AGORA, imediatas_para_navegador[0]
    elif imediatas:
        # Há o que tocar agora, mas nada que o navegador aceite sem ajuda.
        # `escolhida` deixa de ser uma decisão e passa a ser a sugestão que a
        # tela mostra ao lado da pergunta.
        decisao, escolhida = ESCOLHER, imediatas[0]
    else:
        decisao, escolhida = NADA_IMEDIATO, copias[0]

    return {
        'decisao': decisao,
        'escolhida': _resumo(escolhida),
        'melhor_para_navegador': (_resumo(candidatas[0]) if candidatas else None),
        'imediatas': [_resumo(r) for r in imediatas[:QUANTAS_OFERECER]],
    }
