"""
Compara modelos de embedding no acervo real.

A pergunta "384 dimensões bastam?" não se responde por opinião. Aqui ela vira
medida de recuperação: dado um filme, o modelo traz de volta os filmes que
sabidamente pertencem ao mesmo conjunto?

Verdade-base, extraída do próprio acervo:
  · coleção  — filmes da mesma franquia/série devem ficar próximos. É o sinal
               mais forte que temos, ainda que enviesado pelo título comum.
  · diretor  — sinal mais fraco e mais honesto: nada no título denuncia que
               dois filmes são do mesmo diretor, então mede semântica de fato.
"""

import json
import time
from collections import defaultdict
from pathlib import Path

import numpy as np
from django.core.management.base import BaseCommand

from apps.movies.models import Movie

# Modelos candidatos. O primeiro é o que está em produção hoje.
CANDIDATOS = [
    ('all-MiniLM-L6-v2', 384, 'inglês'),
    ('all-mpnet-base-v2', 768, 'inglês'),
    ('paraphrase-multilingual-mpnet-base-v2', 768, 'multilíngue'),
    ('intfloat/multilingual-e5-base', 768, 'multilíngue'),
    ('intfloat/multilingual-e5-large', 1024, 'multilíngue'),
    ('intfloat/multilingual-e5-large-instruct', 1024, 'multilíngue'),
    ('BAAI/bge-m3', 1024, 'multilíngue'),
    ('Alibaba-NLP/gte-multilingual-base', 768, 'multilíngue'),
]

# Modelos que publicam a própria implementação e só carregam com ela.
EXIGEM_CODIGO_REMOTO = {'Alibaba-NLP/gte-multilingual-base'}


class Command(BaseCommand):
    help = 'Compara modelos de embedding por recuperação no acervo.'

    def add_arguments(self, parser):
        parser.add_argument('--pool', type=int, default=10000,
                            help='Tamanho do conjunto de busca (padrão: 10000).')
        parser.add_argument('--k', type=int, default=10,
                            help='Quantos vizinhos considerar (padrão: 10).')
        parser.add_argument('--models', type=str, default='',
                            help='Lista separada por vírgula; vazio = todos.')
        parser.add_argument('--resultados', type=str, default='/tmp/lumiere_benchmark.json',
                            help='Arquivo onde os resultados são acumulados. '
                                 'Modelos já medidos são pulados.')
        parser.add_argument('--refazer', action='store_true',
                            help='Ignora o que já foi medido e refaz tudo.')
        parser.add_argument('--batch', type=int, default=64,
                            help='Lote de codificação. Reduza em máquina com '
                                 'pouca RAM: os modelos grandes paginam.')

    def handle(self, *args, **opts):
        from apps.ml.embedding import monta_texto

        filmes = self._monta_pool(opts['pool'])
        textos = [monta_texto(self._dados(f)) for f in filmes]
        colecoes, diretores = self._verdade_base(filmes)

        self.stdout.write(
            f'Pool: {len(filmes)} filmes | '
            f'{sum(len(v) for v in colecoes.values())} em coleções com par | '
            f'{sum(len(v) for v in diretores.values())} com diretor repetido\n'
        )

        self._lote = opts['batch']
        # Guarda em disco a cada modelo. Uma rodada destas leva dezenas de
        # minutos e já foi perdida por suspensão da máquina (tampa fechada);
        # sem persistir, todo o trabalho concluído ia junto.
        arquivo = Path(opts['resultados'])
        anteriores = {}
        if arquivo.exists() and not opts['refazer']:
            try:
                anteriores = {r['nome']: r for r in json.loads(arquivo.read_text())}
                if anteriores:
                    self.stdout.write(
                        f'{len(anteriores)} resultado(s) recuperado(s) de {arquivo}\n')
            except (ValueError, OSError):
                anteriores = {}

        escolhidos = opts['models'].split(',') if opts['models'] else None
        linhas = []
        for nome, dims, idioma in CANDIDATOS:
            if escolhidos and nome not in escolhidos:
                continue
            if nome in anteriores:
                linhas.append(anteriores[nome])
                self.stdout.write(f'  {nome}: já medido, pulando')
                continue
            try:
                linha = self._avalia(nome, dims, idioma, textos, colecoes, diretores, opts['k'])
            except Exception as e:
                # Um modelo indisponível não pode custar o resultado dos outros.
                self.stderr.write(self.style.WARNING(
                    f'  {nome}: FALHOU ({type(e).__name__}: {str(e)[:90]})'))
                continue
            linhas.append(linha)
            anteriores[nome] = linha
            arquivo.write_text(json.dumps(list(anteriores.values()), indent=2, ensure_ascii=False))
            # Imprime já: um comando destes leva dezenas de minutos, e guardar
            # tudo para o fim perde todo o trabalho se o último modelo quebrar.
            self.stdout.write(self.style.SUCCESS(
                f'    col@{opts["k"]}={linha["recall_col"]:.3f}  '
                f'MRR={linha["mrr_col"]:.3f}  '
                f'dir@{opts["k"]}={linha["recall_dir"]:.3f}  '
                f'({linha["segundos"]:.0f}s)'))

        self._tabela(linhas, opts['k'])

    # ── dados ────────────────────────────────────────────────────────────
    def _monta_pool(self, tamanho):
        """Todos os filmes com par conhecido, mais distratores aleatórios."""
        com_colecao = list(
            Movie.objects.exclude(collection_name='').exclude(collection_name=None)
        )
        ids = {f.id for f in com_colecao}
        faltam = max(0, tamanho - len(com_colecao))
        distratores = list(Movie.objects.exclude(id__in=ids).order_by('ranking_current')[:faltam])
        return com_colecao + distratores

    @staticmethod
    def _dados(f):
        return {
            'title': f.title, 'overview': f.overview or '', 'director': f.director or '',
            'genres': f.genres or [], 'themes': f.themes or [],
            'moods': f.moods or [], 'keywords': f.keywords or [],
        }

    @staticmethod
    def _verdade_base(filmes):
        colecoes, diretores = defaultdict(list), defaultdict(list)
        for i, f in enumerate(filmes):
            if f.collection_name:
                colecoes[f.collection_name].append(i)
            if f.director:
                diretores[f.director].append(i)
        # Só grupos com par: um filme sozinho não tem o que recuperar.
        return ({k: v for k, v in colecoes.items() if len(v) >= 2},
                {k: v for k, v in diretores.items() if len(v) >= 2})

    # ── avaliação ────────────────────────────────────────────────────────
    def _avalia(self, nome, dims, idioma, textos, colecoes, diretores, k):
        from sentence_transformers import SentenceTransformer

        self.stdout.write(f'  {nome} ...')
        inicio = time.time()
        modelo = SentenceTransformer(
            nome, trust_remote_code=nome in EXIGEM_CODIGO_REMOTO
        )

        # Os modelos E5 são treinados com prefixo; sem ele a qualidade cai.
        entradas = [f'query: {t}' for t in textos] if 'e5' in nome.lower() else textos

        vetores = modelo.encode(
            entradas, batch_size=self._lote, convert_to_numpy=True,
            show_progress_bar=False, normalize_embeddings=True,
        ).astype(np.float32)
        segundos = time.time() - inicio

        recall_col, mrr_col = self._recupera(vetores, colecoes, k)
        recall_dir, _ = self._recupera(vetores, diretores, k)

        # Sem isto o modelo anterior continua na memória enquanto o próximo
        # carrega, o que numa máquina apertada leva a paginação.
        del modelo
        import gc
        gc.collect()
        return {
            'nome': nome, 'dims': vetores.shape[1], 'idioma': idioma,
            'recall_col': recall_col, 'mrr_col': mrr_col,
            'recall_dir': recall_dir, 'segundos': segundos,
        }

    @staticmethod
    def _recupera(vetores, grupos, k):
        """Recall@k e MRR dos pares conhecidos, em blocos para caber na memória."""
        alvos = {i: set(g) - {i} for g in grupos.values() for i in g}
        indices = np.array(sorted(alvos))
        if len(indices) == 0:
            return 0.0, 0.0

        acertos, recip, total = 0.0, 0.0, 0
        for ini in range(0, len(indices), 512):
            bloco = indices[ini:ini + 512]
            sims = vetores[bloco] @ vetores.T
            sims[np.arange(len(bloco)), bloco] = -np.inf  # nunca a si mesmo
            topo = np.argpartition(-sims, k, axis=1)[:, :k]
            for linha, idx in enumerate(bloco):
                esperados = alvos[idx]
                ordenado = topo[linha][np.argsort(-sims[linha, topo[linha]])]
                encontrados = [p for p, c in enumerate(ordenado) if c in esperados]
                acertos += len(encontrados) / min(len(esperados), k)
                recip += 1.0 / (encontrados[0] + 1) if encontrados else 0.0
                total += 1
        return acertos / total, recip / total

    def _tabela(self, linhas, k):
        self.stdout.write('\n' + '─' * 92)
        self.stdout.write(
            f'{"modelo":<42}{"dims":>6}{"idioma":>14}'
            f'{f"  col@{k}":>9}{"  MRR":>8}{f"  dir@{k}":>9}{"  seg":>7}'
        )
        self.stdout.write('─' * 92)
        melhor = max(linhas, key=lambda l: l['recall_col']) if linhas else None
        for l in linhas:
            marca = ' ←' if l is melhor else ''
            self.stdout.write(
                f'{l["nome"]:<42}{l["dims"]:>6}{l["idioma"]:>14}'
                f'{l["recall_col"]:>9.3f}{l["mrr_col"]:>8.3f}'
                f'{l["recall_dir"]:>9.3f}{l["segundos"]:>7.0f}{marca}'
            )
        self.stdout.write('─' * 92)
