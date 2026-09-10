"""
O que acontece quando alguém aperta "iniciar projeção".

Existe porque a tela vinha respondendo essa pergunta sozinha, com uma conta de
uma linha só — `available_instantly || cached_in_realdebrid` —, e essa conta
não sabe o que o navegador aguenta. Um filme cuja única cópia imediata é um
REMUX com DTS aparecia com o botão pulsando, prometendo projeção; a projeção
vinha muda.

A regra, decidida com o usuário:

    entre as cópias com DISPONIBILIDADE IMEDIATA que o navegador
    COMPROVADAMENTE toca, a de MELHOR NOTA.

Duas coisas nessa frase são escolhas, e as duas custam:

COMPATIBILIDADE É REQUISITO, não desempate. Como desempate, o botão poderia
escolher uma cópia de nota alta que o navegador recusa tendo uma aceitável ao
lado.

E COMPROVADAMENTE quer dizer o selo `toca` — cópia que DECLARA um codec de
áudio que o navegador abre. As `talvez`, que simplesmente não declaram nada,
ficam de fora. Medido: `toca` são 4 cópias em 63, `talvez` são 31. Com esse
rigor, quase todo filme cai na pergunta em vez de projetar direto.

É deliberado. A alternativa é o botão prometer projeção sobre uma cópia que
pode vir muda — o Lumière não sabe, e afirmaria que sabe. A pergunta é honesta,
e a primeira opção dela toca a cópia na hora.
"""

import logging

from apps.movies.compatibilidade import TOCA
from apps.movies.transcode import o_que_transcodificar

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

    # Só o selo `toca` vale, e a escolha é do usuário.
    #
    # A alternativa era aceitar também as `talvez` — cópias que simplesmente
    # não declaram o codec de áudio, e são 31 das 63 do acervo. Aceitá-las faz
    # o botão prometer projeção sobre uma cópia que PODE vir muda: o Lumière
    # não sabe, e afirmaria que sabe.
    #
    # O preço desta escolha está medido: `toca` de fato são 4 cópias em 63, e
    # com esse rigor quase todo filme cai na pergunta. Mas a pergunta é honesta
    # e barata de responder — a primeira opção dela toca a cópia na hora — e um
    # botão que mente não é barato nenhum.
    imediatas_para_navegador = [r for r in imediatas if r.compatibilidade == TOCA]

    # A melhor cópia com o selo `toca` que ainda precisa ser baixada — é ela
    # que "baixar e ser avisado" iria buscar. Mesmo critério de cima: oferecer
    # esperar um download por uma cópia que talvez toque seria vender a espera
    # por uma promessa que não se pode fazer.
    #
    # `pode_importar` sozinho responde as DUAS condições: ele exige magnet (sem
    # magnet não há o que enviar ao Real-Debrid, e as cópias vindas da
    # sincronização nascem sem) e exige `disponibilidade == AUSENTE`, que já
    # implica não estar disponível. Escrever "and not _toca_agora(r)" ao lado
    # parecia mais explícito e era código morto — a mutação que o desligava não
    # mudava nenhum resultado.
    candidatas = [r for r in copias
                  if r.compatibilidade == TOCA
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
