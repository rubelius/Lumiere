import pandas as pd
import requests
from io import BytesIO
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.ingestion.models import RawIngestion
from tqdm import tqdm

class Command(BaseCommand):
    help = 'Faz o download e carrega a planilha StartingList (.xls) do TSPDT para a Raw Zone'

    def handle(self, *args, **kwargs):
        # Estamos baixando a lista ALL-TIME (Todos os Tempos), que possui ~26.551 filmes.
        tspdt_url = 'https://theyshootpictures.com/resources/StartingList.xls'
        
        # A Lista Branca de Colunas: Tudo que não estiver aqui será DESTRUÍDO.
        expected_columns = [
            'New', 'Director(s)', 'Title', 'Year', 'Country', 'Length', 
            'Colour', 'Genre', '2026', '2025', '2024', '2023', '2022', 
            '2021', '2020', '2019', '2018', '2017', '2016', '2015', 
            '2014', '2013', '2012', '2011', '2010', '2009', '2008', 
            'IMDb', 'idTSPDT'
        ]

        self.stdout.write(self.style.WARNING(f'Iniciando download da base histórica completa: {tspdt_url}'))
        
        try:
            response = requests.get(tspdt_url, timeout=30)
            response.raise_for_status()
            excel_data = BytesIO(response.content)
            
            self.stdout.write(self.style.SUCCESS('Download concluído. Analisando estrutura...'))
            
            # Lendo puramente como texto para não converter nomes de colunas em Datas
            df_raw = pd.read_excel(excel_data, sheet_name='StartingList', header=None, dtype=str)
            
            # Localiza a linha do cabeçalho
            header_index = None
            for idx, row in df_raw.iterrows():
                row_vals = [str(val).strip() for val in row.values]
                if 'idTSPDT' in row_vals and 'Title' in row_vals:
                    header_index = idx
                    break
            
            if header_index is None:
                raise ValueError("Cabeçalho 'idTSPDT' ou 'Title' não encontrados. Abortando.")

            raw_headers = [str(val).strip() for val in df_raw.iloc[header_index].values]

            df = df_raw.iloc[header_index + 1:].copy()
            df.columns = raw_headers

            # O FILTRO BLINDADO (Joga fora as datas 2006-03-01 e lixos do Excel)
            valid_cols = [c for c in expected_columns if c in df.columns]
            df = df[valid_cols]

            # Remove linhas inválidas ou com ID nulo
            for col in ['idTSPDT', 'Title']:
                df[col] = df[col].fillna('')
                df = df[df[col].astype(str).str.strip() != '']
                df = df[df[col].astype(str).str.lower() != 'nan']

            df = df.fillna('')
            records = df.to_dict('records')
            total_records = len(records)

            # VALIDAÇÃO DE VOLUME ATUALIZADA PARA A LISTA ALL-TIME
            if total_records < 25000 or total_records > 30000:
                raise ValueError(f"Volume suspeito: {total_records} filmes. A planilha All-Time tem ~26.551. Operação abortada.")

            self.stdout.write(self.style.SUCCESS(f'Validação perfeita: Exatamente {total_records} filmes encontrados e limpos.'))
            
            # OPERAÇÃO ATÔMICA
            confirm = input(f"\nDeseja DELETAR a base antiga (com defeito) e INSERIR os {total_records} filmes perfeitos? (y/n): ")
            if confirm.lower() != 'y':
                self.stdout.write(self.style.ERROR('Operação cancelada pelo usuário. O banco não foi alterado.'))
                return

            with transaction.atomic():
                deleted_count = RawIngestion.objects.filter(source_name='TSPDT').delete()[0]
                self.stdout.write(self.style.WARNING(f'Limpando banco: {deleted_count} registros antigos removidos e expurgados.'))

                for row_dict in tqdm(records, desc="Populando Raw Zone", unit="filme"):
                    tspdt_id = str(row_dict.get('idTSPDT', '')).split('.')[0].strip()

                    RawIngestion.objects.create(
                        source_name='TSPDT',
                        source_id=tspdt_id,
                        raw_data=row_dict,
                        status='PENDING'
                    )

            self.stdout.write(self.style.SUCCESS(f'\nSucesso absoluto! {total_records} filmes históricos inseridos na Raw Zone com JSON imaculado.'))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'\n[FALHA CRÍTICA]: {str(e)}'))
            self.stdout.write(self.style.ERROR('Nenhum dado foi alterado no banco de dados (Rollback efetuado).'))