"""
O programa do dia: estável dentro do dia, outro amanhã.

O DEFEITO QUE ISTO RESOLVE, medido: a home inteira vinha da primeira página de
`/api/movies/` — 20 filmes ordenados por `ranking_current`, preenchido em 100%
do acervo, logo sempre os mesmos 20. O hero sorteava 10 deles: 0,077% das
25.908 obras. Não parecia repetitivo; era.

E o que estes testes guardam não é "tem variedade" — é a INVARIANTE que torna a
estabilidade honesta: mesma data, mesmo programa. Sem ela a tela não pode
mostrar a data, e sem mostrar a data a estabilidade vira suspeita.
"""

from datetime import date

import pytest

from apps.movies.models import Movie
from apps.movies.programa import (POR_RECORTE, QUANTOS_RECORTES,
                                  TEMAS_PROGRAMAVEIS, _semente, monta_programa)


@pytest.fixture
def acervo(db):
    """
    Um acervo pequeno mas com material para vários recortes.

    Os `ranking_current` são baixos de propósito: os recortes sorteiam entre o
    topo do ranking, e um acervo de teste todo fora dele não exercitaria nada.
    """
    for i in range(60):
        Movie.objects.create(
            title=f'Filme {i:02d}', year=1940 + (i % 60), ranking_current=i + 1,
            director='Alfred Hitchcock' if i % 3 == 0 else f'Diretor {i}',
            cinematographer='Gregg Toland' if i % 4 == 0 else f'Fotógrafo {i}',
            composer='Bernard Herrmann' if i % 5 == 0 else f'Compositor {i}',
            color='BW' if i % 2 == 0 else 'Col',
            length_minutes=30 if i % 7 == 0 else 120,
            keywords=['murder'] if i % 2 == 0 else ['love'],
            festivals=[{'name': 'x', 'award': 'y', 'year': '1950 | Vencedor'}]
            if i % 6 == 0 else [])


# ── a invariante ──────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_mesma_data_mesmo_programa(acervo):
    """
    Sem isto a tela não pode mostrar a data — e é a data que explica por que a
    home é a mesma a manhã inteira.
    """
    um = monta_programa(date(2026, 9, 18))
    outro = monta_programa(date(2026, 9, 18))
    assert [s['chave'] for s in um['secoes']] == [s['chave'] for s in outro['secoes']]
    assert ([[f.id for f in s['filmes']] for s in um['secoes']]
            == [[f.id for f in s['filmes']] for s in outro['secoes']])


@pytest.mark.django_db
def test_dias_diferentes_programas_diferentes(acervo):
    """O outro lado da mesma invariante: amanhã tem que ser outro."""
    dias = [monta_programa(date(2026, 9, d)) for d in (18, 19, 20, 21, 22)]
    assinaturas = {tuple(str(f.id) for s in p['secoes'] for f in s['filmes']) for p in dias}
    assert len(assinaturas) == 5, 'cinco dias produziram programas repetidos'


def test_a_semente_nao_depende_do_processo():
    """
    `hash()` do Python é aleatorizado por processo desde o 3.3. Usá-lo aqui
    faria dois workers Django servirem programas diferentes no mesmo dia — e a
    home mudaria conforme quem atendesse a requisição.
    """
    import subprocess
    import sys
    codigo = (
        'import sys; sys.path.insert(0, ".");'
        'import os, django;'
        'os.environ.setdefault("DJANGO_SETTINGS_MODULE", "lumiere.settings");'
        'django.setup();'
        'from datetime import date;'
        'from apps.movies.programa import _semente;'
        'print(_semente(date(2026, 9, 18), "x").random())'
    )
    import os
    backend = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    # `PYTHONHASHSEED=random` é o padrão, mas explicitá-lo é o ponto do teste:
    # sem ele, três subprocessos poderiam calhar de usar a mesma semente de
    # hash e o teste passaria com o defeito presente.
    ambiente = {**os.environ, 'PYTHONHASHSEED': 'random'}
    corridas = [subprocess.run([sys.executable, '-c', codigo], capture_output=True,
                               text=True, cwd=backend, env=ambiente)
                for _ in range(3)]
    for c in corridas:
        assert c.returncode == 0, f'o subprocesso falhou: {c.stderr[-400:]}'
        assert c.stdout.strip(), 'o subprocesso não imprimiu nada — teste sem dentes'
    saidas = {c.stdout.strip() for c in corridas}
    assert len(saidas) == 1, f'a semente mudou entre processos: {saidas}'


# ── o que o programa promete ──────────────────────────────────────────────

@pytest.mark.django_db
def test_nunca_mais_que_o_teto_de_secoes(acervo):
    assert len(monta_programa(date(2026, 9, 18))['secoes']) <= QUANTOS_RECORTES


@pytest.mark.django_db
def test_nenhuma_secao_vazia(acervo):
    """
    Um recorte sem filme é pior que um recorte a menos — é a tela abrindo um
    título e não entregando nada, que é o defeito que esta casa mais persegue.
    """
    for s in monta_programa(date(2026, 9, 18))['secoes']:
        assert s['filmes'], f'seção vazia: {s["titulo"]}'
        assert len(s['filmes']) <= POR_RECORTE


@pytest.mark.django_db
def test_toda_secao_tem_titulo_e_subtitulo(acervo):
    for s in monta_programa(date(2026, 9, 18))['secoes']:
        assert s['titulo'].strip()
        assert s['subtitulo'].strip()


@pytest.mark.django_db
def test_as_obras_primas_abrem_sempre(acervo):
    """A âncora do programa: sem ela a home não teria começo fixo."""
    for d in (18, 19, 20, 21):
        p = monta_programa(date(2026, 9, d))
        assert p['secoes'][0]['chave'] == 'obras-primas'


@pytest.mark.django_db
def test_nao_repete_secao_no_mesmo_dia(acervo):
    chaves = [s['chave'] for s in monta_programa(date(2026, 9, 18))['secoes']]
    assert len(chaves) == len(set(chaves))


@pytest.mark.django_db
def test_acervo_vazio_nao_quebra(db):
    """Instalação nova: a home tem que abrir, mesmo sem nada dentro."""
    p = monta_programa(date(2026, 9, 18))
    assert p['secoes'] == []
    assert p['dia'] == '2026-09-18'


@pytest.mark.django_db
def test_um_recorte_quebrado_nao_derruba_o_programa(acervo, monkeypatch):
    """
    A home é a primeira tela. Um recorte com defeito pode sumir; ela não pode.
    """
    import apps.movies.programa as prog

    def explode(_):
        raise ValueError('recorte com defeito')

    monkeypatch.setattr(prog, 'RECORTES', [prog.SEMPRE, explode, prog._curtas])
    p = prog.monta_programa(date(2026, 9, 18))
    assert p['secoes'], 'o programa inteiro caiu por causa de um recorte'


def test_todo_tema_curado_tem_nome_em_portugues():
    """
    A lista é curada, e o valor é o que vai para a tela. Uma chave sem nome
    mostraria a keyword crua do TMDB como título de seção.
    """
    for chave, nome in TEMAS_PROGRAMAVEIS.items():
        assert nome and nome != chave, f'{chave!r} sem nome de tela'
        assert nome[0].isupper(), f'{nome!r} não parece título'


# ── os buracos que a mutação revelou ──────────────────────────────────────
# As quatro primeiras mutações contra este arquivo passaram. Cada uma apontava
# uma invariante que eu tinha escrito em prosa e não em teste.

@pytest.mark.django_db
def test_quais_secoes_aparecem_tambem_muda_por_dia(acervo):
    """
    `test_dias_diferentes_programas_diferentes` comparava só os FILMES, e cada
    recorte tem semente própria — então fixar a semente que escolhe QUAIS
    recortes entram não mudava aquele teste. O programa continuaria com as
    mesmas seis seções para sempre, em ordem idêntica.
    """
    # A chave carrega o sorteio de DENTRO do recorte — `tema-film noir`,
    # `decada-1980` —, e comparar chaves cruas deixa o teste passar só
    # porque o tema mudou. O que precisa variar é QUAL RECORTE entra.
    def familia(chave):
        return chave.split('-')[0]

    conjuntos = {tuple(familia(s['chave'])
                       for s in monta_programa(date(2026, 9, d))['secoes'])
                 for d in range(18, 27)}
    assert len(conjuntos) > 1, 'nove dias com exatamente os mesmos recortes'

    # E a raiz disso, testada direto: a ORDEM em que os recortes são
    # tentados. O teste acima sozinho não a alcança — com a ordem fixa, o
    # conjunto ainda varia, porque um recorte que não acha material é
    # pulado e isso depende da semente de dentro dele.
    from apps.movies.programa import ordem_dos_recortes
    ordens = {tuple(r.__name__ for r in ordem_dos_recortes(date(2026, 9, d)))
              for d in range(18, 27)}
    assert len(ordens) > 1, 'a ordem dos recortes é a mesma todo dia'


@pytest.mark.django_db
def test_secao_que_volta_vazia_e_descartada(acervo, monkeypatch):
    """
    Os recortes de verdade já devolvem None quando não há material, então o
    acervo de teste nunca produzia uma seção vazia — e a guarda passava
    despercebida. Aqui ela é forçada.
    """
    import apps.movies.programa as prog

    def vazio(_):
        return {'chave': 'vazio', 'titulo': 'Nada', 'subtitulo': 'X', 'filmes': []}

    monkeypatch.setattr(prog, 'RECORTES', [prog.SEMPRE, vazio])
    chaves = [s['chave'] for s in prog.monta_programa(date(2026, 9, 18))['secoes']]
    assert 'vazio' not in chaves, 'uma seção sem filme nenhum chegou à tela'


@pytest.mark.django_db
def test_a_ordem_dentro_da_secao_vem_do_sorteio_e_nao_do_banco(acervo):
    """
    `_sorteia` embaralha os IDs e depois busca por `id__in`, que devolve na
    ordem que o Postgres quiser. Reordenar em memória é o que preserva o
    sorteio — sem isso, dois dias que escolhem os MESMOS oito filmes os
    mostram na mesma ordem, e a seção parece congelada.
    """
    from apps.movies.programa import _sorteia, _semente

    # Pool do tamanho exato do recorte: os oito escolhidos são sempre os
    # mesmos, então só a ORDEM pode variar.
    pool = Movie.objects.filter(ranking_current__lte=8).order_by('ranking_current')
    assert pool.count() == 8

    ordens = {tuple(str(f.id) for f in _sorteia(pool, _semente(date(2026, 9, d), 'x')))
              for d in range(1, 12)}
    assert len(ordens) > 1, 'a ordem não mudou em onze sementes diferentes'


@pytest.mark.django_db
def test_o_recorte_sorteia_entre_os_MELHORES_dele(db):
    """
    A banda estreita não é otimização: é o que faz o sorteio produzir uma
    programação em vez de uma amostra. Sorteando entre os 4.000, "Os anos 1980"
    abria com um filme que ninguém conhece; com 120, o que entra é defensável.

    Aqui há 400 filmes em preto e branco e a seção pega oito. Nenhum pode vir de
    fora dos 120 melhores — existem 120 melhores de sobra.
    """
    from apps.movies.programa import _preto_e_branco, _semente

    for i in range(400):
        Movie.objects.create(title=f'PB {i:03d}', year=1950, color='BW',
                             ranking_current=i + 1)

    vistos = set()
    for d in range(1, 30):
        secao = _preto_e_branco(_semente(date(2026, 9, d), 'pb'))
        vistos.update(f.ranking_current for f in secao['filmes'])

    # O NÚMERO ESCRITO, e não `BANDA_DO_RECORTE`: comparar com a própria
    # constante sob teste move a trave junto com o defeito — mudá-la para
    # 4.000 fazia o teste passar sobre a regressão inteira. Se a banda
    # mudar de propósito, que este número mude junto, à mão.
    assert max(vistos) <= 120, (
        f'o sorteio alcançou o ranking {max(vistos)}, fora da banda de 120 '
        f'— a seção vira amostra estatística')
    # E ainda assim varia: 29 dias × 8 filmes de uma banda de 120.
    assert len(vistos) > 40, f'só {len(vistos)} filmes distintos em 29 dias'
