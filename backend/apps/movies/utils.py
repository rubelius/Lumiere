# apps/movies/utils.py
"""
Algoritmo de qualidade de torrents - CRÍTICO
Baseado nas especificações exatas do projeto Lumière
"""
import re
from typing import Dict, Any

# Os tokens que dizem a resolução sem margem de dúvida, do maior para o menor.
RESOLUCOES_EXPLICITAS = (('2160P', '2160p'), ('1080P', '1080p'),
                         ('720P', '720p'), ('480P', '480p'))

# Palavras que sugerem 4K sem afirmar resolução nenhuma. "UHD" costuma
# descrever a FONTE do encode, não o arquivo: "1080p UHD BluRay" é um 1080p
# feito a partir do disco UHD.
PALAVRAS_DE_4K = ('UHD', '4K')


def resolucao_do_titulo(titulo_maiusculo: str) -> tuple:
    """
    A resolução que o nome da release declara, e se é 4K.

    Devolve (resolucao, is_4k).

    A ordem antiga testava ['2160P', 'UHD', '4K'] primeiro, então qualquer
    nome que mencionasse UHD virava 2160p — inclusive os que diziam 1080p com
    todas as letras. No acervo, 2 de 28 cópias estão gravadas assim, e o
    estrago não é só o rótulo: 2160p vale video_score 20 contra 15 do 1080p,
    então o arquivo menor sobe na lista à frente dos 2160p de verdade, e passa
    por um filtro de min_resolution que deveria barrá-lo.
    """
    explicitas = [nome for token, nome in RESOLUCOES_EXPLICITAS
                  if token in titulo_maiusculo]
    sugere_4k = any(palavra in titulo_maiusculo for palavra in PALAVRAS_DE_4K)

    # O token explícito sempre vence; UHD/4K só valem quando não há token
    # nenhum. "1080p UHD BluRay" é um 1080p feito a partir do disco UHD — a
    # palavra descreve a fonte do encode, não o arquivo. A ordem antiga
    # testava UHD primeiro e promovia esses arquivos a 2160p, o que lhes dava
    # video_score 20 em vez de 15: subiam à frente dos 2160p de verdade e
    # passavam por um min_resolution que deveria barrá-los.
    if explicitas:
        # RESOLUCOES_EXPLICITAS vem do maior para o menor, e o comprehension
        # preserva a ordem: um nome que cite duas resoluções (versão dupla no
        # mesmo torrent) fica com a maior, que é o que se pode assistir.
        resolucao = explicitas[0]
        return resolucao, resolucao == '2160p'

    if sugere_4k:
        return '2160p', True

    return '480p', False


def parse_quality_from_title(title: str) -> Dict[str, Any]:
    """
    Extrai TODAS as informações de qualidade do título do release
    
    Returns:
        Dict com todos os campos de qualidade extraídos
    """
    title_upper = title.upper()
    result: Dict[str, Any] = {}
    
    # RESOLUTION (CRITICAL)
    result['resolution'], result['is_4k'] = resolucao_do_titulo(title_upper)
    
    # REMUX (HIGHEST PRIORITY)
    result['is_remux'] = 'REMUX' in title_upper
    
    # HDR (CRITICAL FOR SCORING)
    result['has_hdr'] = any(x in title_upper for x in ['HDR', 'HDR10'])
    result['has_hdr10_plus'] = 'HDR10+' in title_upper or 'HDR10PLUS' in title_upper
    # `'DV' in titulo` casava como substring: DVDRip, DVD5 e até 4KDVS eram
    # gravados como Dolby Vision. Verificado no acervo — 3 de 28 cópias
    # marcadas assim sem que o nome dissesse nada disso. A borda de palavra é
    # o que separa a sigla do pedaço de outra palavra.
    result['has_dolby_vision'] = bool(re.search(
        r'DOLBY[. _-]?VISION|\bDOVI\b|(?<![A-Z0-9])DV(?![A-Z0-9])', title_upper))
    
    # VIDEO CODEC
    if any(x in title_upper for x in ['HEVC', 'H.265', 'X265']):
        result['video_codec'] = 'HEVC'
    elif any(x in title_upper for x in ['AVC', 'H.264', 'X264']):
        result['video_codec'] = 'AVC'
    elif 'AV1' in title_upper:
        result['video_codec'] = 'AV1'
    else:
        result['video_codec'] = ''
    
    # AUDIO - ADVANCED FORMATS (40 POINTS OF SCORE)
    result['has_atmos'] = 'ATMOS' in title_upper
    result['has_dtsx'] = any(x in title_upper for x in ['DTS:X', 'DTS-X', 'DTSX'])
    result['has_truehd'] = any(x in title_upper for x in ['TRUEHD', 'TRUE-HD'])
    result['has_dts_hd_ma'] = any(x in title_upper for x in [
        'DTS-HD.MA', 'DTS.HD.MA', 'DTSHD.MA', 'DTS-HD-MA'
    ])
    
    # AUDIO CODEC
    if result['has_atmos']:
        result['audio_codec'] = 'Dolby Atmos'
    elif result['has_dtsx']:
        result['audio_codec'] = 'DTS:X'
    elif result['has_truehd']:
        result['audio_codec'] = 'Dolby TrueHD'
    elif result['has_dts_hd_ma']:
        result['audio_codec'] = 'DTS-HD MA'
    elif 'DTS' in title_upper:
        result['audio_codec'] = 'DTS'
    elif 'DD+' in title_upper or 'EAC3' in title_upper:
        result['audio_codec'] = 'DD+'
    elif 'AAC' in title_upper:
        result['audio_codec'] = 'AAC'
    else:
        result['audio_codec'] = ''
    
    # AUDIO CHANNELS
    if '7.1' in title:
        result['audio_channels'] = '7.1'
    elif '5.1' in title:
        result['audio_channels'] = '5.1'
    elif '2.0' in title or 'STEREO' in title_upper:
        result['audio_channels'] = '2.0'
    else:
        result['audio_channels'] = ''
    
    # RELEASE GROUP (for trust scoring)
    group_match = re.search(r'-([A-Za-z0-9]+)(?:\[.*\])?$', title)
    if group_match:
        result['release_group'] = group_match.group(1)
    
    # HARDCODED SUBS (PENALTY)
    result['has_hardcoded_subs'] = any(x in title_upper for x in [
        'HC', 'HARDCODED', 'HARDSUB'
    ])
    
    # EDITION
    result['edition'] = ''
    for edition in ['EXTENDED', 'DIRECTOR', "DIRECTOR'S.CUT", 'THEATRICAL', 
                    'UNRATED', 'IMAX', 'CRITERION']:
        if edition in title_upper:
            result['edition'] = edition.replace('.', ' ').replace("'S", "'s").title()
            break
    
    return result


def calculate_quality_score(release_data: Dict[str, Any]) -> Dict[str, int]:
    """
    Calcula score de qualidade (0-100)
    
    Breakdown:
    - Video (30 pts): Remux=30, 4K=20, 1080p=15, 720p=8
    - Audio (40 pts): Atmos/DTS:X=30, TrueHD/DTS-HD MA=25, DTS=15, DD+=10. Canais: 7.1=+10, 5.1=+6
    - HDR (15 pts): DV=15, HDR10+=12, HDR10=10
    - Release (10 pts): Trusted group=10, P2P=5, Scene=3
    - Seeds (5 pts): 100+=5, 50+=4, 20+=3, 5+=2
    
    PENALTIES:
    - Hardcoded subs: -10
    
    Returns:
        Dict com quality_score, video_score, audio_score, hdr_score, release_score, seeds_score
    """
    scores = {
        'video_score': 0,
        'audio_score': 0,
        'hdr_score': 0,
        'release_score': 0,
        'seeds_score': 0,
    }
    
    # VIDEO (30)
    if release_data.get('is_remux'):
        scores['video_score'] = 30
    elif release_data.get('is_4k'):
        scores['video_score'] = 20
    elif release_data.get('resolution') == '1080p':
        scores['video_score'] = 15
    elif release_data.get('resolution') == '720p':
        scores['video_score'] = 8
    
    # AUDIO (40) - MOST IMPORTANT (ISSUE 4 CORRIGIDA)
    if release_data.get('has_atmos') or release_data.get('has_dtsx'):
        scores['audio_score'] = 30
    elif release_data.get('has_truehd') or release_data.get('has_dts_hd_ma'):
        scores['audio_score'] = 25
    elif 'DTS' in str(release_data.get('audio_codec', '')):
        scores['audio_score'] = 15
    elif 'DD+' in str(release_data.get('audio_codec', '')):
        scores['audio_score'] = 10
    elif 'AAC' in str(release_data.get('audio_codec', '')):
        scores['audio_score'] = 5
    
    # Audio channels bonus (Max 10)
    if release_data.get('audio_channels') == '7.1':
        scores['audio_score'] += 10
    elif release_data.get('audio_channels') == '5.1':
        scores['audio_score'] += 6
    elif release_data.get('audio_channels') == '2.0':
        scores['audio_score'] += 2
    
    # Cap audio at 40
    scores['audio_score'] = min(scores['audio_score'], 40)
    
    # HDR (15)
    if release_data.get('has_dolby_vision'):
        scores['hdr_score'] = 15
    elif release_data.get('has_hdr10_plus'):
        scores['hdr_score'] = 12
    elif release_data.get('has_hdr'):
        scores['hdr_score'] = 10
    
    # RELEASE (10)
    trusted_groups = ['FraMeSToR', 'EPSiLON', 'HiFi', 'CtrlHD', 'DON', 
                      'NAHOM', 'GECKOS', 'playBD', 'RIFT', 'DEFLATE']
    if release_data.get('release_group') in trusted_groups:
        scores['release_score'] = 10
    elif release_data.get('release_group'):
        scores['release_score'] = 5
    
    # SEEDS (5)
    seeders = release_data.get('seeders', 0)
    if seeders >= 100:
        scores['seeds_score'] = 5
    elif seeders >= 50:
        scores['seeds_score'] = 4
    elif seeders >= 20:
        scores['seeds_score'] = 3
    elif seeders >= 5:
        scores['seeds_score'] = 2
    
    # Calculate total
    total_score = sum(scores.values())
    
    # PENALTIES
    if release_data.get('has_hardcoded_subs'):
        total_score -= 10
    
    # Ensure 0-100 range
    total_score = max(0, min(100, total_score))
    
    scores['quality_score'] = total_score
    return scores

# Da melhor para a pior. O pedido diz o piso: nada abaixo dele entra.
RESOLUCOES = ['2160p', '1080p', '720p', '480p']


def passa_no_filtro(release: Dict[str, Any], filtros: Dict[str, Any]) -> bool:
    """
    Se este resultado de busca atende ao que foi pedido.

    Existe uma função só porque havia duas cópias do filtro: a da task, com
    todos os critérios, e a da view, que lia `min_resolution` do pedido e
    nunca o aplicava. Releases abaixo do piso eram gravadas e devolvidas ao
    usuário como se ele não tivesse pedido nada.
    """
    if release.get('seeders', 0) < int(filtros.get('min_seeders', 5)):
        return False

    if filtros.get('prefer_remux') and not release.get('is_remux'):
        return False

    if filtros.get('require_advanced_audio') and not (
        release.get('has_atmos') or release.get('has_dtsx') or release.get('has_truehd')
    ):
        return False

    piso = filtros.get('min_resolution', '1080p')
    # Resolução desconhecida — do pedido ou do resultado — vai para o fim da
    # ordem, então um resultado sem resolução legível só passa se o piso
    # também for desconhecido.
    indice_piso = RESOLUCOES.index(piso) if piso in RESOLUCOES else len(RESOLUCOES)
    resolucao = release.get('resolution')
    indice_res = RESOLUCOES.index(resolucao) if resolucao in RESOLUCOES else len(RESOLUCOES)

    return indice_res <= indice_piso
