"""
Reavalia o áudio das cópias já no banco.

O parser passou a reconhecer AC-3, Dolby Digital, PCM e companhia, mas o campo
só é escrito quando uma cópia é criada ou re-buscada. MEDIDO antes desta
migração: 200 das 1629 cópias declaravam AC3, DD ou DDP no nome e tinham
`audio_codec` vazio — o que a tela lê como "talvez" e o diálogo oferece em
dourado como "[ TOCAR SEM CONVERTER ]", sobre faixas que não emitem som.

Esperar o rastreio semanal consertar sozinho seria deixar duzentas promessas de
filme mudo de pé por até sete dias.

Só preenche o que está VAZIO: uma cópia cujo áudio já foi identificado — por
este parser ou pela sondagem do arquivo, que vê mais que o nome — não é
sobrescrita por um palpite de nome.
"""

from django.db import migrations


def reavalia(apps, schema_editor):
    from apps.movies.utils import parse_quality_from_title

    TorrentRelease = apps.get_model('movies', 'TorrentRelease')
    corrigidas = []
    for copia in TorrentRelease.objects.filter(audio_codec='').only('id', 'title'):
        novo = parse_quality_from_title(copia.title or '')['audio_codec']
        if novo:
            copia.audio_codec = novo
            corrigidas.append(copia)

    # Em lotes: o acervo tem milhares de linhas e um UPDATE por cópia levaria
    # minutos.
    TorrentRelease.objects.bulk_update(corrigidas, ['audio_codec'], batch_size=500)
    print(f'\n  {len(corrigidas)} cópias deixaram de dizer "talvez" sem motivo')


def desfaz(apps, schema_editor):
    """
    Sem volta atrás, de propósito.

    Reverter seria reescrever '' sobre campos corretos — e não há como
    distinguir os que esta migração preencheu dos que já vieram do parser.
    """


class Migration(migrations.Migration):

    dependencies = [('movies', '0020_torrentrelease_audio_tracks')]

    operations = [migrations.RunPython(reavalia, desfaz)]
