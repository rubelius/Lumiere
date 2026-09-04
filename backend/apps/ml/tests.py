"""
Testes do contrato do modelo de embedding.

A troca de modelo já quebrou este projeto duas vezes em silêncio: uma vez pela
dimensão divergindo entre arquivos, outra por tasks carimbarem no banco o nome
de um modelo que não era mais o usado. Nenhuma das duas dá erro na hora — a
primeira só aparece quando o vetor chega ao Postgres, a segunda nunca aparece,
apenas apaga a única pista de quais linhas ainda estão no modelo antigo.
"""

import ast
from pathlib import Path

import pytest

from apps.ml.constants import EMBEDDING_DIMENSIONS, EMBEDDING_MODEL, aplica_prefixo

APPS = Path(__file__).resolve().parent.parent

# Onde nomes de modelo podem aparecer escritos por extenso: a fonte única, o
# benchmark (cujo trabalho é comparar modelos pelo nome) e este próprio teste.
LIVRES = {
    'apps/ml/constants.py',
    'apps/ml/management/commands/benchmark_embeddings.py',
    'apps/ml/tests.py',
}

CONHECIDOS = (
    'all-MiniLM-L6-v2', 'all-mpnet-base-v2', 'paraphrase-multilingual-mpnet-base-v2',
    'multilingual-e5-base', 'multilingual-e5-large', 'bge-m3', 'gte-multilingual-base',
)


def fontes():
    for caminho in APPS.rglob('*.py'):
        rel = caminho.relative_to(APPS.parent).as_posix()
        if '__pycache__' in rel or '/migrations/' in rel or rel in LIVRES:
            continue
        yield rel, caminho


def test_nenhum_nome_de_modelo_escrito_a_mao():
    """
    Um literal como 'all-MiniLM-L6-v2' no meio do código sobrevive à troca do
    modelo e passa a mentir. Foi o que aconteceu com o carimbo model_version
    das similaridades e com o embedding_model do perfil de gosto.
    """
    achados = []
    for rel, caminho in fontes():
        arvore = ast.parse(caminho.read_text())

        # Docstring que cita um modelo é história, não configuração: contar o
        # histórico da escolha como violação faria o teste proibir justamente
        # a explicação de por que ele existe.
        prosa = {
            id(no.body[0].value)
            for no in ast.walk(arvore)
            if isinstance(no, (ast.Module, ast.ClassDef,
                               ast.FunctionDef, ast.AsyncFunctionDef))
            and no.body and isinstance(no.body[0], ast.Expr)
            and isinstance(no.body[0].value, ast.Constant)
            and isinstance(no.body[0].value.value, str)
        }

        for no in ast.walk(arvore):
            if not (isinstance(no, ast.Constant) and isinstance(no.value, str)):
                continue
            if id(no) in prosa:
                continue
            if any(m in no.value for m in CONHECIDOS):
                achados.append(f'{rel}:{no.lineno} -> {no.value!r}')

    assert not achados, (
        'nome de modelo escrito à mão; use apps.ml.constants:\n  '
        + '\n  '.join(achados))


def test_geradores_relatam_o_modelo_da_fonte_unica():
    """
    Quem grava no banco carimba `generator.model_name`. Se esse atributo não
    existisse — o gerador de perfil não o tinha — a task quebraria com
    AttributeError em produção, não aqui.
    """
    from apps.ml.embedding import MovieEmbeddingGenerator, UserTasteEmbeddingGenerator

    assert MovieEmbeddingGenerator().model_name == EMBEDDING_MODEL
    assert UserTasteEmbeddingGenerator().model_name == EMBEDDING_MODEL


def dimensoes_nas_migracoes():
    """
    Última dimensão declarada para cada campo vetorial, lida das migrações.

    (app, modelo, campo) -> (arquivo, dimensões)
    """
    def dims_de(campo):
        if not (isinstance(campo, ast.Call)
                and getattr(campo.func, 'attr', '') == 'VectorField'):
            return None
        return next((k.value.value for k in campo.keywords
                     if k.arg == 'dimensions'), None)

    ultima = {}
    for migracoes in APPS.glob('*/migrations'):
        app = migracoes.parent.name
        for arquivo in sorted(migracoes.glob('[0-9]*.py')):
            for no in ast.walk(ast.parse(arquivo.read_text())):
                if not isinstance(no, ast.Call):
                    continue
                operacao = getattr(no.func, 'attr', '')
                kw = {k.arg: k.value for k in no.keywords}

                if operacao in ('AddField', 'AlterField'):
                    dims = dims_de(kw.get('field'))
                    if dims is not None:
                        chave = (app, ast.literal_eval(kw['model_name']),
                                 ast.literal_eval(kw['name']))
                        ultima[chave] = (arquivo.name, dims)

                # Um campo vetorial nascido junto com a tabela nunca passa por
                # AddField. Foi assim que taste_profile_embedding ficou em 384
                # enquanto o resto do projeto já estava em 1024.
                elif operacao == 'CreateModel' and 'fields' in kw:
                    modelo = ast.literal_eval(kw['name']).lower()
                    for par in kw['fields'].elts:
                        dims = dims_de(par.elts[1])
                        if dims is not None:
                            chave = (app, modelo, ast.literal_eval(par.elts[0]))
                            ultima[chave] = (arquivo.name, dims)
    return ultima


def test_trocar_a_dimensao_exige_migracao():
    """
    As colunas vector() leem EMBEDDING_DIMENSIONS, então modelo e constante
    nunca divergem entre si — comparar um com o outro não testaria nada. O que
    diverge de verdade é a coluna no Postgres, e ela só muda por migração.

    Mexer na constante sem gerar a migração deixa o código dizendo 1024 e o
    banco guardando 768; o erro só aparece na primeira gravação, como
    DataError, depois de horas de backfill.
    """
    declaradas = dimensoes_nas_migracoes()
    assert declaradas, 'nenhuma migração de campo vetorial encontrada'

    divergentes = {
        chave: valor for chave, valor in declaradas.items()
        if valor[1] != EMBEDDING_DIMENSIONS
    }
    assert not divergentes, (
        f'constants.py diz {EMBEDDING_DIMENSIONS}, mas a última migração de '
        f'cada campo diz outra coisa — gere a migração:\n  '
        + '\n  '.join(f'{".".join(c)}: {v[1]} em {v[0]}'
                       for c, v in divergentes.items()))


@pytest.mark.parametrize('modelo, esperado', [
    ('intfloat/multilingual-e5-base', True),
    ('intfloat/multilingual-e5-large', True),
    ('BAAI/bge-m3', False),
    ('all-MiniLM-L6-v2', False),
])
def test_prefixo_so_para_a_familia_e5(modelo, esperado):
    """
    O E5 perde qualidade sem 'query: ' e o bge-m3 não usa prefixo nenhum. O
    benchmark mediu assim; se a produção divergisse, o modelo escolhido não
    seria o modelo medido.
    """
    assert aplica_prefixo('texto', modelo).startswith('query: ') is esperado


def test_receita_atual_e_a_que_o_acervo_tem_embeddada():
    """
    Mudar a receita 'atual' não quebra nada na hora: o backfill roda, os
    vetores gravam, a busca responde. Só que os filmes reembeddados passam a
    viver num espaço diferente dos que ficaram, e a vizinhança entre os dois
    grupos vira ruído — sem erro, sem log, sem pista.

    Este teste fixa o texto exato. Quem precisar mudá-lo tem de mudar aqui
    também, e nesse momento a decisão de reembeddar o acervo inteiro fica
    explícita em vez de acontecer por acidente.
    """
    from apps.ml.embedding import monta_texto

    filme = {
        'title': 'Alphaville',
        'overview': 'Um agente atravessa o espaço até uma cidade sem poesia.',
        'director': 'Jean-Luc Godard',
        'genres': ['Ficção científica', 'Noir'],
        'themes': [],
        'moods': [],
        'keywords': ['distopia', 'inteligência artificial'],
        # Campos de outras receitas: a 'atual' tem de ignorá-los.
        'year': 1965,
        'country': 'França',
        'cast': [{'name': 'Eddie Constantine'}, {'name': 'Anna Karina'}],
    }

    assert monta_texto(filme) == (
        'Title: Alphaville '
        'Overview: Um agente atravessa o espaço até uma cidade sem poesia. '
        'Director: Jean-Luc Godard '
        'Genres: Ficção científica, Noir '
        'Keywords: distopia, inteligência artificial'
    )


def test_receitas_novas_realmente_acrescentam_o_campo():
    """
    Uma receita que declara um campo mas não o coloca no texto mediria a
    ausência dele e concluiria que não ajuda.
    """
    from apps.ml.embedding import monta_texto

    filme = {
        'title': 'Alphaville', 'overview': 'Uma cidade sem poesia.',
        'director': 'Jean-Luc Godard', 'genres': ['Noir'], 'keywords': ['distopia'],
        'year': 1965, 'country': 'França',
        'cast': [{'name': 'Eddie Constantine'}, {'name': 'Anna Karina'}],
    }

    assert 'Year: 1965' in monta_texto(filme, 'com_ano_e_pais')
    assert 'Country: França' in monta_texto(filme, 'com_ano_e_pais')
    # O elenco chega como lista de dicts do TMDB; ao modelo interessa o nome.
    assert 'Cast: Eddie Constantine, Anna Karina' in monta_texto(filme, 'com_elenco')
    assert 'name' not in monta_texto(filme, 'com_elenco')
