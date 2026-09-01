"""
Fonte única do modelo de embedding e da sua dimensão.

A escolha do modelo foi medida, não arbitrada. `manage.py benchmark_embeddings`
compara candidatos por recuperação no próprio acervo, usando como verdade-base
os filmes que pertencem à mesma coleção e os do mesmo diretor. Resultado num
conjunto de 10 mil filmes:

    modelo                                 dims  idioma        col@10   MRR   dir@10
    all-MiniLM-L6-v2 (anterior)             384  inglês         0.604  0.584   0.151
    all-mpnet-base-v2                       768  inglês         0.636  0.606   0.117
    paraphrase-multilingual-mpnet-base-v2   768  multilíngue    0.623  0.584   0.089
    intfloat/multilingual-e5-base           768  multilíngue    0.728  0.711   0.232

Duas conclusões contra a intuição comum: dobrar a dimensão sozinho não melhora
(o mpnet piorou o sinal de diretor), e nem todo modelo multilíngue ajuda. O que
decidiu foi a combinação de treino multilíngue e qualidade do modelo — os
overviews do acervo estão em português, e o modelo anterior era só de inglês.

O projeto já divergiu na dimensão entre arquivos, o que travou o pipeline
inteiro em silêncio. Trocar de modelo agora exige mexer só aqui, e gerar a
migração correspondente.
"""

EMBEDDING_MODEL = 'intfloat/multilingual-e5-base'
EMBEDDING_DIMENSIONS = 768

# Os modelos da família E5 são treinados com prefixo e perdem qualidade sem
# ele. Para similaridade simétrica — filme contra filme — a documentação
# recomenda 'query: ' nos dois lados, que foi como o benchmark mediu.
PREFIXO_E5 = 'query: '


def aplica_prefixo(texto: str, modelo: str = EMBEDDING_MODEL) -> str:
    return f'{PREFIXO_E5}{texto}' if 'e5' in modelo.lower() else texto
