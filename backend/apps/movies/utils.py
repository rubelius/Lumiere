# apps/movies/utils.py
"""
Algoritmo de qualidade de torrents - CRÍTICO
Baseado nas especificações exatas do projeto Lumière
"""
import re
from typing import Dict, Any

def parse_quality_from_title(title: str) -> Dict[str, Any]:
    """
    Extrai TODAS as informações de qualidade do título do release
    
    Returns:
        Dict com todos os campos de qualidade extraídos
    """
    title_upper = title.upper()
    result: Dict[str, Any] = {}
    
    # RESOLUTION (CRITICAL)
    if any(x in title_upper for x in ['2160P', 'UHD', '4K']):
        result['resolution'] = '2160p'
        result['is_4k'] = True
    elif '1080P' in title_upper:
        result['resolution'] = '1080p'
        result['is_4k'] = False
    elif '720P' in title_upper:
        result['resolution'] = '720p'
        result['is_4k'] = False
    else:
        result['resolution'] = '480p'
        result['is_4k'] = False
    
    # REMUX (HIGHEST PRIORITY)
    result['is_remux'] = 'REMUX' in title_upper
    
    # HDR (CRITICAL FOR SCORING)
    result['has_hdr'] = any(x in title_upper for x in ['HDR', 'HDR10'])
    result['has_hdr10_plus'] = 'HDR10+' in title_upper or 'HDR10PLUS' in title_upper
    result['has_dolby_vision'] = any(x in title_upper for x in [
        'DOLBY.VISION', 'DOLBYVISION', 'DV', 'DOVI'
    ])
    
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