"""
Os gráficos do painel, e a origem de cada um.

A REGRA, que é a mesma do resto do painel e aqui pesa mais: um gráfico é a forma
mais fácil de afirmar com autoridade. Uma linha subindo convence antes de ser
lida. Por isso toda série sai de dado MEDIDO e diz de onde veio — e as que ainda
não têm massa dizem isso em vez de desenhar uma linha sobre três pontos.

O benchmark de tarefas, em particular, nasceu com o modelo `ExecucaoDeTarefa`:
antes dele não havia duração registrada em lugar nenhum, e desenhar performance
seria inventar.
"""

from datetime import timedelta

from django.db.models import Avg, Count, Max, Min, Q
from django.db.models.functions import TruncDay
from django.utils import timezone

# Abaixo disto uma série não vira gráfico: duas medições não descrevem
# tendência nenhuma, e a linha entre elas convence sem ter o que dizer.
MINIMO_PARA_UMA_SERIE = 3


def _grafico(chave, titulo, tipo, dados, origem, ressalva=''):
    return {'chave': chave, 'titulo': titulo, 'tipo': tipo, 'dados': dados,
            'origem': origem, 'ressalva': ressalva}


def duracao_das_tarefas(dias: int = 14):
    """
    Quanto cada tarefa demora, por dia. É o benchmark que o painel pedia.
    """
    from apps.core.models import ExecucaoDeTarefa

    desde = timezone.now() - timedelta(days=dias)
    linhas = list(
        ExecucaoDeTarefa.objects
        .filter(iniciada_em__gte=desde, duracao_s__isnull=False)
        .annotate(dia=TruncDay('iniciada_em'))
        .values('tarefa', 'dia')
        .annotate(media=Avg('duracao_s'), pior=Max('duracao_s'),
                  melhor=Min('duracao_s'), n=Count('id'))
        .order_by('dia'))

    if len(linhas) < MINIMO_PARA_UMA_SERIE:
        return _grafico(
            'duracao-tarefas', 'Duração das tarefas', 'sem-dado', [],
            origem='execucoes_de_tarefa (sinais do Celery)',
            ressalva=(f'Só {len(linhas)} ponto(s) registrado(s). A medição começou '
                      'agora: o modelo é novo e só grava o que rodar daqui em '
                      'diante. Um gráfico sobre isto seria uma linha entre dois '
                      'pontos.'))

    por_tarefa = {}
    for l in linhas:
        por_tarefa.setdefault(l['tarefa'], []).append({
            'dia': l['dia'].date().isoformat(),
            'media': round(l['media'], 2),
            'pior': round(l['pior'], 2),
            'melhor': round(l['melhor'], 2),
            'n': l['n'],
        })

    return _grafico(
        'duracao-tarefas', 'Duração das tarefas', 'linhas',
        [{'nome': nome.rsplit('.', 1)[-1], 'pontos': pontos}
         for nome, pontos in sorted(por_tarefa.items())],
        origem='execucoes_de_tarefa, média por dia dos sinais do Celery',
        ressalva='Média do dia. Uma execução lenta isolada some na média — a '
                 'linha do pior caso está no mesmo gráfico por isso.')


def sucesso_das_tarefas(dias: int = 14):
    """Quantas rodaram e quantas falharam, por tarefa."""
    from apps.core.models import ExecucaoDeTarefa

    desde = timezone.now() - timedelta(days=dias)
    linhas = list(
        ExecucaoDeTarefa.objects.filter(iniciada_em__gte=desde)
        .values('tarefa')
        .annotate(total=Count('id'),
                  falhas=Count('id', filter=Q(sucesso=False)),
                  rodando=Count('id', filter=Q(sucesso__isnull=True)))
        .order_by('-total'))

    if not linhas:
        return _grafico(
            'sucesso-tarefas', 'Execuções e falhas', 'sem-dado', [],
            origem='execucoes_de_tarefa',
            ressalva='Nenhuma execução registrada nos últimos '
                     f'{dias} dias. A medição é nova.')

    return _grafico(
        'sucesso-tarefas', 'Execuções e falhas', 'barras',
        [{'nome': l['tarefa'].rsplit('.', 1)[-1], 'total': l['total'],
          'falhas': l['falhas'], 'rodando': l['rodando']} for l in linhas[:10]],
        origem='execucoes_de_tarefa, contagem por tarefa',
        ressalva='"Rodando" são execuções que começaram e não registraram fim — '
                 'tarefa em curso, ou worker que morreu no meio.')


def acervo_por_decada():
    """
    A forma do acervo no tempo. Sai do `year`, que está em 99,9% dos filmes.
    """
    from apps.movies.models import Movie

    linhas = list(
        Movie.objects.filter(year__isnull=False, year__gte=1880, year__lte=2030)
        .extra(select={'decada': '(year / 10) * 10'})
        .values('decada').annotate(n=Count('id')).order_by('decada'))
    return _grafico(
        'acervo-decada', 'O acervo por década', 'barras',
        [{'nome': f"{l['decada']}s", 'total': l['n'], 'falhas': 0, 'rodando': 0}
         for l in linhas],
        origem='movies_movie.year',
        ressalva='Filmes sem ano ficam de fora — são 0,1% do acervo.')


def cobertura_do_rastreio():
    """
    Quanto do acervo já foi varrido atrás de cópias, por dia de varredura.

    É a resposta visual para a pergunta que o painel de rastreio faz em número:
    está andando, e em que ritmo.
    """
    from apps.movies.models import Movie

    linhas = list(
        Movie.objects.filter(copias_buscadas_em__isnull=False)
        .annotate(dia=TruncDay('copias_buscadas_em'))
        .values('dia').annotate(n=Count('id')).order_by('dia'))

    if len(linhas) < MINIMO_PARA_UMA_SERIE:
        return _grafico(
            'cobertura-rastreio', 'Ritmo do rastreio', 'sem-dado', [],
            origem='movies_movie.copias_buscadas_em',
            ressalva=(f'Só {len(linhas)} dia(s) com varredura registrada. '
                      'O rastreador rodou pouco até agora.'))

    acumulado, serie = 0, []
    for l in linhas:
        acumulado += l['n']
        serie.append({'dia': l['dia'].date().isoformat(), 'media': l['n'],
                      'pior': acumulado, 'melhor': l['n'], 'n': l['n']})

    return _grafico(
        'cobertura-rastreio', 'Ritmo do rastreio', 'linhas',
        [{'nome': 'varridos no dia', 'pontos': serie}],
        origem='movies_movie.copias_buscadas_em, agrupado por dia',
        ressalva='O campo diz quando a busca RODOU, não se achou algo. E ele '
                 'guarda só a ÚLTIMA varredura de cada filme: um filme varrido '
                 'duas vezes aparece só no dia mais recente.')


GRAFICOS = [duracao_das_tarefas, sucesso_das_tarefas, cobertura_do_rastreio,
            acervo_por_decada]


def monta_graficos() -> list:
    montados = []
    for construtor in GRAFICOS:
        try:
            g = construtor()
        except Exception:  # noqa: BLE001
            import logging
            logging.getLogger(__name__).exception('gráfico %s falhou',
                                                  construtor.__name__)
            continue
        if g:
            montados.append(g)
    return montados
