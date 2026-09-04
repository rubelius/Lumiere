"""
Fonte única do modelo de embedding e da sua dimensão.

A escolha do modelo foi medida, não arbitrada. `manage.py benchmark_embeddings`
compara candidatos por recuperação no próprio acervo, usando como verdade-base
os filmes que pertencem à mesma coleção e os do mesmo diretor. Resultado num
conjunto de 10 mil filmes:

Primeira rodada, conjunto de 10 mil filmes:

    modelo                                 dims  idioma        col@10   MRR   dir@10
    all-MiniLM-L6-v2                        384  inglês         0.604  0.584   0.151
    all-mpnet-base-v2                       768  inglês         0.636  0.606   0.117
    paraphrase-multilingual-mpnet-base-v2   768  multilíngue    0.623  0.584   0.089
    intfloat/multilingual-e5-base           768  multilíngue    0.728  0.711   0.232

Segunda rodada entre os multilíngues grandes, conjunto de 2.500 (menor porque
a máquina não segurava os modelos de 1024 dimensões em memória; os números
absolutos sobem com menos distratores, mas os modelos seguem comparáveis):

    intfloat/multilingual-e5-base           768  multilíngue    0.777  0.768   0.515
    intfloat/multilingual-e5-large         1024  multilíngue    0.792  0.788   0.529
    intfloat/multilingual-e5-large-instruct 1024 multilíngue    0.794  0.769   0.497
    BAAI/bge-m3                            1024  multilíngue    0.834  0.819   0.543

Conclusão que se repetiu nas duas rodadas: o tamanho sozinho não decide. O
mpnet dobrou a dimensão e PIOROU o sinal de diretor; entre os três de 1024
dimensões a distância é grande. O que pesa é a qualidade do modelo somada a
treino multilíngue — os overviews do acervo estão em português.

O projeto já divergiu na dimensão entre arquivos, o que travou o pipeline
inteiro em silêncio. Trocar de modelo agora exige mexer só aqui, e gerar a
migração correspondente.
"""

EMBEDDING_MODEL = 'BAAI/bge-m3'
EMBEDDING_DIMENSIONS = 1024

# Só a família E5 usa prefixo, e perde qualidade sem ele. O bge-m3 não usa —
# e foi assim que o benchmark o mediu, então a produção precisa coincidir.
PREFIXO_E5 = 'query: '


def aplica_prefixo(texto: str, modelo: str = EMBEDDING_MODEL) -> str:
    return f'{PREFIXO_E5}{texto}' if 'e5' in modelo.lower() else texto
