import pandas as pd
import json
import os

# 1. Configuração dos Caminhos dos Ficheiros (Baseado na sua estrutura de pastas)
BASE_DIR = 'src/dados'
PATH_ESCOLAS_2024 = os.path.join(BASE_DIR, 'Tabelas Escolas', 'Escolas-nordeste_2024.csv')
PATH_ESCOLAS_2025 = os.path.join(BASE_DIR, 'Tabelas Escolas', 'Escolas-nordeste_2025.csv')
PATH_SAEB_ESCOLA = os.path.join(BASE_DIR, 'Tabelas SAEB', 'TS_ESCOLA.csv')
PATH_SAIDA_JSON = os.path.join(BASE_DIR, 'escolas_saeb_historico.json')

def ler_csv_seguro(caminho):
    """Lê os arquivos CSV tratando problemas de acentuação e separadores do INEP."""
    if not os.path.exists(caminho):
        print(f"❌ Erro: Arquivo não encontrado - {caminho}")
        return pd.DataFrame()

    print(f"⏳ Lendo arquivo: {os.path.basename(caminho)}...")
    try:
        # Tenta ler no padrão mais comum do INEP
        return pd.read_csv(caminho, sep=';', encoding='latin1', low_memory=False)
    except:
        try:
            # Fallback para padrão UTF-8 com vírgula
            return pd.read_csv(caminho, sep=',', encoding='utf-8', low_memory=False)
        except Exception as e:
            print(f"❌ Erro crítico ao ler {caminho}: {e}")
            return pd.DataFrame()

def formatar_codigo_inep(valor):
    """Garante que o código INEP seja uma string limpa sem truncar os zeros."""
    if pd.isna(valor) or str(valor).strip() in ['', '-', 'NaN']:
        return None
    try:
        return str(int(float(valor))).strip()
    except:
        return str(valor).strip()

def converter_coordenada(valor_cru):
    """Limpa e converte a coordenada (vírgula brasileira para ponto flutuante)."""
    if pd.notna(valor_cru) and str(valor_cru).strip() not in ['', '-', 'NaN', 'null']:
        try:
            return float(str(valor_cru).replace(',', '.'))
        except ValueError:
            return None
    return None

print("🚀 Iniciando o Cruzamento Triplo (Censo 24 + Censo 25 + SAEB 23)...")

# 2. Carregar os DataFrames
df_escolas_2024 = ler_csv_seguro(PATH_ESCOLAS_2024)
df_escolas_2025 = ler_csv_seguro(PATH_ESCOLAS_2025)
df_saeb = ler_csv_seguro(PATH_SAEB_ESCOLA)

if df_escolas_2024.empty or df_escolas_2025.empty or df_saeb.empty:
    print("🛑 Processo interrompido. Verifique se os 3 arquivos existem nas pastas.")
    exit()

# 3. Identificar e limpar a coluna de ID do SAEB
coluna_id_saeb = 'ID_ESCOLA' if 'ID_ESCOLA' in df_saeb.columns else df_saeb.columns[0]

print("🔗 Normalizando todos os códigos INEP para o cruzamento...")
df_escolas_2024['CO_ENTIDADE_LIMPO'] = df_escolas_2024['CO_ENTIDADE'].apply(formatar_codigo_inep)
df_escolas_2025['CO_ENTIDADE_LIMPO'] = df_escolas_2025['CO_ENTIDADE'].apply(formatar_codigo_inep)
df_saeb['ID_ESCOLA_LIMPO'] = df_saeb[coluna_id_saeb].apply(formatar_codigo_inep)

# 4. Criar um mapa de coordenadas de 2024 (Para usar como backup)
print("📍 Extraindo banco de coordenadas de 2024...")
coordenadas_2024 = {}
for _, row in df_escolas_2024.iterrows():
    cod_inep = row['CO_ENTIDADE_LIMPO']
    if cod_inep:
        lat = converter_coordenada(row.get('LATITUDE', None))
        lon = converter_coordenada(row.get('LONGITUDE', None))
        coordenadas_2024[cod_inep] = {"latitude": lat, "longitude": lon}

# 5. Estruturar o dicionário baseando-se em 2025 e mesclando coordenadas
print("🏗️ Estruturando dados principais (Censo 2025) e combinando coordenadas...")
escolas_dict = {}

for _, row in df_escolas_2025.iterrows():
    cod_inep = row['CO_ENTIDADE_LIMPO']
    if not cod_inep:
        continue
        
    nome = row.get('NO_ENTIDADE', 'Nome Indisponível')
    municipio = row.get('NO_MUNICIPIO', '')
    uf = row.get('SG_UF', '')
    
    # Tenta pegar as coordenadas de 2025 primeiro
    lat = converter_coordenada(row.get('LATITUDE', None))
    lon = converter_coordenada(row.get('LONGITUDE', None))
    
    # Se 2025 estiver vazio, faz o resgate (backup) dos dados de 2024
    if lat is None or lon is None:
        coords_backup = coordenadas_2024.get(cod_inep, {})
        lat = coords_backup.get("latitude", lat)
        lon = coords_backup.get("longitude", lon)

    escolas_dict[cod_inep] = {
        "id_escola": cod_inep,
        "nome": str(nome).strip(),
        "cidade": str(municipio).strip(),
        "uf": str(uf).strip(),
        "nota_infraestrutura": None,
        "latitude": lat,
        "longitude": lon,
        "historico_saeb": None
    }

# 6. Vincular os Indicadores de Desempenho do SAEB
print("📊 Cruzando as notas e proficiências do SAEB (TS_ESCOLA)...")
colunas_para_ignorar = [coluna_id_saeb, 'ID_ESCOLA_LIMPO', 'ID_MUNICIPIO', 'ID_UF', 'ID_REGIAO', 'ID_DEPENDENCIA_ADM', 'ID_LOCALIZACAO']

for _, row in df_saeb.iterrows():
    cod_inep = row['ID_ESCOLA_LIMPO']
    
    if cod_inep in escolas_dict:
        dados_avaliacao = {}
        for col in df_saeb.columns:
            valor = row[col]
            if col not in colunas_para_ignorar and pd.notna(valor):
                if isinstance(valor, float):
                    dados_avaliacao[col] = round(valor, 2)
                else:
                    dados_avaliacao[col] = valor
                    
        escolas_dict[cod_inep]["historico_saeb"] = dados_avaliacao

# 7. Relatório e Exportação do JSON
lista_final_escolas = list(escolas_dict.values())

total_com_coordenadas = sum(1 for e in lista_final_escolas if e["latitude"] is not None)
print(f"✅ Relatório: {total_com_coordenadas} de {len(lista_final_escolas)} escolas foram mapeadas com coordenadas geográficas com sucesso.")

print(f"💾 Gravando o arquivo JSON final...")
with open(PATH_SAIDA_JSON, 'w', encoding='utf-8') as f:
    json.dump(lista_final_escolas, f, ensure_ascii=False, indent=2)

print(f"🎉 SUCESSO! O arquivo foi gerado em: {PATH_SAIDA_JSON} e está pronto para o Back4App!")