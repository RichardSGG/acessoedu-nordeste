import pandas as pd
import numpy as np

arquivo_entrada = 'Escolas-nordeste.csv' 
arquivo_saida = 'escolas_pronto_b4app_v2.csv'

print("Carregando base do INEP...")
try:
    df = pd.read_csv(arquivo_entrada, sep=';', encoding='utf-8', low_memory=False)
except UnicodeDecodeError:
    df = pd.read_csv(arquivo_entrada, sep=';', encoding='latin1', low_memory=False)

# Mapeamento com os nomes EXATOS do arquivo bruto do INEP
mapeamento_colunas = {
    'CO_ENTIDADE': 'cod_inep',
    'NO_ENTIDADE': 'nome_escola',
    'CO_CEP': 'cep',
    'DS_ENDERECO': 'logradouro',
    'NO_BAIRRO': 'bairro',
    'NO_MUNICIPIO': 'cidade',
    'SG_UF': 'estado',
    'TP_SITUACAO_FUNCIONAMENTO': 'status_funcionamento',
    'TP_DEPENDENCIA': 'id_dependencia',
    
    # Contato
    'NU_DDD': 'ddd',
    'NU_TELEFONE': 'telefone',
    
    # Coordenadas
    'LATITUDE': 'latitude',
    'LONGITUDE': 'longitude',
    
    # Acessibilidade
    'IN_ACESSIBILIDADE_RAMPAS': 'possui_rampas',
    'IN_ACESSIBILIDADE_ELEVADOR': 'possui_elevador',
    'IN_ACESSIBILIDADE_PISOS_TATEIS': 'possui_piso_tatil',
    'IN_ACESSIBILIDADE_VAO_LIVRE': 'possui_vao_livre',
    'IN_ACESSIBILIDADE_CORRIMAO': 'possui_corremao',
    
    'IN_BANHEIRO_PNE': 'banheiro_acessivel',
    'IN_SALA_ATENDIMENTO_ESPECIAL': 'possui_sala_atendimento_especial',
    'QT_SALAS_UTILIZADAS_ACESSIVEIS': 'qtd_salas_acessiveis',
    
    'IN_ACESSIBILIDADE_SINAL_SONORO': 'sinalizacao_sonora',
    'IN_ACESSIBILIDADE_SINAL_TATIL': 'sinalizacao_tatil',
    'IN_ACESSIBILIDADE_SINAL_VISUAL': 'sinalizacao_visual',
    
    'IN_MATERIAL_PED_EDU_ESP': 'material_edu_especial',
    'IN_MATERIAL_PED_BIL_SURDOS': 'material_bilingue_surdos',
    'IN_ESPECIAL_EXCLUSIVA': 'educacao_especial_exclusiva'
}

# Tratamento para TX_EMAIL que pode não estar presente na base local
colunas_para_filtrar = []
for col_original in mapeamento_colunas.keys():
    if col_original in df.columns:
        colunas_para_filtrar.append(col_original)
    else:
        print(f"[AVISO] Coluna original '{col_original}' nao encontrada no CSV do INEP. Sera gerada manualmente.")

df_filtrado = df[colunas_para_filtrar].copy()

# Renomeia as colunas encontradas
rename_dict = {k: v for k, v in mapeamento_colunas.items() if k in colunas_para_filtrar}
df_filtrado = df_filtrado.rename(columns=rename_dict)

# Gerar coluna 'email' se 'TX_EMAIL' não existir na base de dados do INEP
if 'TX_EMAIL' not in df.columns:
    # Gerando um e-mail com base no código INEP da escola para evitar dados nulos
    df_filtrado['email'] = df_filtrado['cod_inep'].apply(lambda x: f"escola_{int(x)}@inep.gov.br" if pd.notna(x) else "contato@escola.gov.br")
else:
    df_filtrado = df_filtrado.rename(columns={'TX_EMAIL': 'email'})

# Limpeza e padronização vital
df_filtrado = df_filtrado.dropna(subset=['nome_escola', 'cep'])
df_filtrado['cep'] = df_filtrado['cep'].astype(str).str.replace(r'\.0$', '', regex=True).str.zfill(8)

# Tratamento de coordenadas
def limpar_coordenada(val, is_latitude=True):
    if pd.isna(val) or str(val).strip() == '########' or str(val).strip() == '':
        return None
    try:
        f_val = float(str(val).replace(',', '.'))
        if is_latitude:
            while abs(f_val) > 90:
                f_val /= 10.0
            if f_val < -40 or f_val > 10:
                return None
        else:
            while abs(f_val) > 180:
                f_val /= 10.0
            if f_val < -80 or f_val > -30:
                return None
        return f_val
    except Exception:
        return None

print("Tratando coordenadas de latitude e longitude...")
df_filtrado['latitude'] = df_filtrado['latitude'].apply(lambda x: limpar_coordenada(x, is_latitude=True))
df_filtrado['longitude'] = df_filtrado['longitude'].apply(lambda x: limpar_coordenada(x, is_latitude=False))

# Tratamento de contatos nulos
df_filtrado['ddd'] = df_filtrado['ddd'].fillna('').astype(str).str.replace(r'\.0$', '', regex=True).str.strip()
df_filtrado['telefone'] = df_filtrado['telefone'].fillna('').astype(str).str.replace(r'\.0$', '', regex=True).str.strip()
df_filtrado['email'] = df_filtrado['email'].fillna('').astype(str).str.strip()

# Tratar valores vazios nas colunas de acessibilidade (converter para 0 ou 1)
colunas_acessibilidade = [
    'possui_rampas', 'possui_elevador', 'possui_piso_tatil', 'possui_vao_livre', 'possui_corremao',
    'banheiro_acessivel', 'possui_sala_atendimento_especial', 'qtd_salas_acessiveis',
    'sinalizacao_sonora', 'sinalizacao_tatil', 'sinalizacao_visual',
    'material_edu_especial', 'material_bilingue_surdos', 'educacao_especial_exclusiva'
]

for col in colunas_acessibilidade:
    if col in df_filtrado.columns:
        df_filtrado[col] = df_filtrado[col].fillna(0).astype(int)

# Salvar arquivo pronto v2
df_filtrado.to_csv(arquivo_saida, index=False, encoding='utf-8')
print(f"Sucesso! Novo arquivo '{arquivo_saida}' gerado com as colunas de contato e coordenadas tratadas.")
