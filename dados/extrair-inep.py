import os
import sys
import pandas as pd
import pydata_google_auth
from google.cloud import bigquery

def extrair_dados_inep():
    # Garante que o terminal do Windows suporte os emojis e acentos em PT-BR
    if sys.stdout.encoding.lower() != 'utf-8':
        sys.stdout.reconfigure(encoding='utf-8')

    print("Iniciando extração do IDEB (Nordeste)...")
    
    # ID de faturamento do Google Cloud (Necessário para o Base dos Dados)
    billing_id = "mineral-subject-436800-t1"
    
    print("\nVerificando permissões do Google Cloud...")
    print("Se uma janela do navegador não abrir automaticamente, clique no link que aparecerá abaixo.")
    
    try:
        # Pede autenticação interativa diretamente no Python, sem precisar do gcloud!
        credentials = pydata_google_auth.get_user_credentials(
            ['https://www.googleapis.com/auth/cloud-platform']
        )
        print("✅ Autenticação realizada com sucesso!\n")
    except Exception as e:
        print(f"\n❌ Erro durante a autenticação pelo navegador: {e}")
        sys.exit(1)

    # Query otimizada: Apenas 4 colunas vitais e 9 UFs do Nordeste
    query = """
    SELECT
        ano,
        sigla_uf,
        id_escola,
        ideb
    FROM `basedosdados.br_inep_ideb.escola`
    WHERE ano >= 2021
      AND sigla_uf IN ('AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE')
    """

    try:
        print("Executando query no BigQuery. Isso pode demorar um pouco (bases gigantes)...")
        # Utiliza o pandas_gbq diretamente e fixa a localização como US (onde fica a basedosdados)
        import pandas_gbq
        df = pandas_gbq.read_gbq(query, project_id=billing_id, credentials=credentials, location="US")
        
        if df.empty:
            print("Aviso: A query não retornou dados para os filtros informados.")
            return

        # Exporta como escolas_limpo.json formatado como array de objetos
        output_path = "dados/escolas_limpo.json"
        os.makedirs("dados", exist_ok=True)
        
        print("Convertendo dataframe para JSON otimizado...")
        df.to_json(output_path, orient="records", force_ascii=False, indent=2)
        
        print(f"🚀 Sucesso! {len(df)} registros extraídos.")
        print(f"📁 Arquivo finalizado em: {output_path}")

    except Exception as e:
        print(f"\n❌ Erro inesperado durante a extração: {e}")
        sys.exit(1)

if __name__ == "__main__":
    extrair_dados_inep()