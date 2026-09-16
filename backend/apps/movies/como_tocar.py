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

# O piso de semeadores para SEQUER tentar tocar direto.
#
# Um só já basta para o torrent existir; zero é a única afirmação que o
# indexador faz e que não vale tentar, porque nem ele acha que há alguém.
SEMEADORES_MINIMOS = 1

# Quantas cópias tentar antes de desistir. Cada tentativa frustrada custa os 30
# segundos que o motor espera por metadados, e três minutos de "procurando
# semeadores" não é paciência, é uma tela travada.
QUANTAS_TENTAR = 3


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
        'seeders': release.seeders or 0,
        'compatibilidade': release.compatibilidade,
        'disponibilidade': release.disponibilidade,
        'precisa_converter': o_que_transcodificar(release),
        'pode_importar': release.pode_importar,
    }


def _por_que_nao_torrent(copias, para_torrent) -> str:
    """
    Por que não dá para tocar direto, nas palavras que a tela vai usar.

    O DEFEITO: a tela dizia sempre "NENHUMA CÓPIA COM MAGNET PARA ENVIAR AO
    MOTOR" — que é UMA das razões e quase nunca a verdadeira. `para_torrent`
    exige três coisas (magnet, semeadores, e que o navegador toque a cópia), e
    ficar sem candidata pela terceira é o caso comum. Mandar procurar magnet,
    quando magnet existe aos montes, é mandar fazer o que não resolve.

    Cada razão aponta para uma AÇÃO diferente, e é isso que justifica
    distingui-las. Quem responde é aqui, e não a tela, porque a tela só recebe
    as cópias imediatas — perguntar a ela sobre o acervo do filme seria
    responder com a lista errada.
    """
    if para_torrent:
        return ''

    com_magnet = [r for r in copias if r.magnet_link]
    if not com_magnet:
        # A razão original, e ela existe: as cópias vindas da sincronização com
        # o Real-Debrid nascem sem magnet.
        return ('NENHUMA CÓPIA TEM MAGNET — TODAS VIERAM DA SINCRONIZAÇÃO COM '
                'O REAL-DEBRID, E NÃO DE UM INDEXADOR.')

    tocaveis = [r for r in com_magnet if r.compatibilidade == TOCA]
    if not tocaveis:
        # O caso comum, e o que a mensagem antiga escondia. Tocar do torrent
        # serve o arquivo COMO ESTÁ — não há conversor neste caminho —, então
        # uma cópia com DTS viria muda.
        return ('NENHUMA CÓPIA DESTE FILME TOCA NO NAVEGADOR SEM CONVERSÃO, E '
                'TOCAR DO TORRENT SERVE O ARQUIVO COMO ESTÁ — VIRIA SEM SOM. '
                'MANDE BAIXAR NO REAL-DEBRID E CONVERTA.')

    return ('AS CÓPIAS QUE O NAVEGADOR TOCA ESTÃO SEM SEMEADOR NENHUM — NÃO HÁ '
            'DE QUEM BAIXAR AGORA.')


def _por_que_nao_baixar(copias, candidatas) -> str:
    """
    Por que não há o que mandar baixar no Real-Debrid.

    O DEFEITO: a tela enumerava exatamente duas causas — "ou já estão todas
    disponíveis, ou as que faltam vieram sem magnet" — e a causa real é uma
    TERCEIRA que ela não menciona. `melhor_para_navegador` exige
    `compatibilidade == TOCA` além de `pode_importar`: existindo vinte cópias
    ausentes com magnet, todas sem áudio declarado no nome, as duas frases
    ficam falsas ao mesmo tempo — e a tabela logo abaixo, na mesma página,
    oferece [ IMPORTAR ] em cada uma delas.
    """
    if candidatas:
        return ''

    importaveis = [r for r in copias if r.pode_importar]
    if not importaveis:
        pendentes = [r for r in copias if r.disponibilidade == r.AUSENTE]
        if not pendentes:
            return 'TODAS AS CÓPIAS DESTE FILME JÁ ESTÃO NA SUA CONTA.'
        return ('AS CÓPIAS QUE FALTAM VIERAM SEM MAGNET — DA SINCRONIZAÇÃO COM '
                'O REAL-DEBRID, E NÃO DE UM INDEXADOR. NÃO HÁ O QUE ENVIAR.')

    # A terceira causa, e a comum. Há o que baixar; o que não há é uma cópia
    # que o navegador toque SEM conversão, que é o que este botão prometia.
    return (f'HÁ {len(importaveis)} CÓPIA(S) PARA BAIXAR, MAS NENHUMA DECLARA '
            'ÁUDIO QUE O NAVEGADOR TOQUE — ELAS PRECISARIAM DE CONVERSÃO. '
            'IMPORTE UMA PELA LISTA DE CÓPIAS ABAIXO.')


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
            'para_torrent': [],
            'por_que_nao_torrent': ('ESTE FILME NÃO TEM CÓPIA NENHUMA NO ACERVO '
                                    '— BUSQUE CÓPIAS PRIMEIRO.'),
            'por_que_nao_baixar': ('ESTE FILME NÃO TEM CÓPIA NENHUMA NO ACERVO '
                                   '— BUSQUE CÓPIAS PRIMEIRO.'),
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

    # As cópias que valem TENTAR tocar direto — e não são as mesmas de cima.
    #
    # "Baixar no Real-Debrid" e "tocar direto" parecem a mesma pergunta e não
    # são: no primeiro caso quem procura o enxame é o Real-Debrid, com a rede e
    # o cache dele; no segundo é ESTA máquina, agora. Uma cópia sem ninguém
    # semeando é uma escolha perfeitamente boa para o primeiro e inútil para o
    # segundo, e o diálogo oferecia a mesma para os dois.
    #
    # MEDIDO em Pulp Fiction: a de melhor nota (6,2 GB, 104 semeadores segundo
    # o indexador) ficou 30 segundos sem UM par; outra do mesmo filme, de nota
    # menor, trouxe metadados em 8,5 segundos. O número do indexador é uma
    # AFIRMAÇÃO, não uma medida — só entrar no enxame mede, e isso custa os 30
    # segundos que estamos tentando não gastar.
    #
    # Por isso aqui vai uma LISTA, e não uma escolha: o piso descarta o
    # obviamente morto, a ordem por nota decide entre os vivos, e quem chama
    # tenta a seguinte quando o motor responde que não achou ninguém. Confiar
    # numa cópia só é confiar num número que já mentiu.
    para_torrent = [r for r in candidatas if (r.seeders or 0) >= SEMEADORES_MINIMOS]
    razao_do_torrent = _por_que_nao_torrent(copias, para_torrent)
    razao_do_download = _por_que_nao_baixar(copias, candidatas)

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
        'para_torrent': [_resumo(r) for r in para_torrent[:QUANTAS_TENTAR]],
        'por_que_nao_torrent': razao_do_torrent,
        'por_que_nao_baixar': razao_do_download,
        'imediatas': [_resumo(r) for r in imediatas[:QUANTAS_OFERECER]],
    }
