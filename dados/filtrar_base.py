import pandas as pd

arquivo_entrada = 'Escolas-nordeste.csv' 
arquivo_saida = 'escolas_acessoedu_final.csv'

print("Carregando base do INEP...")
try:
    df = pd.read_csv(arquivo_entrada, sep=';', encoding='utf-8', low_memory=False)
except UnicodeDecodeError:
    df = pd.read_csv(arquivo_entrada, sep=';', encoding='latin1', low_memory=False)

# Mapeamento com os nomes EXATOS do arquivo bruto
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

# Filtrar apenas as 23 colunas mapeadas
df_filtrado = df[list(mapeamento_colunas.keys())].copy()
df_filtrado = df_filtrado.rename(columns=mapeamento_colunas)

# Limpeza vital
df_filtrado = df_filtrado.dropna(subset=['nome_escola', 'cep'])
df_filtrado['cep'] = df_filtrado['cep'].astype(str).str.replace(r'\.0$', '', regex=True).str.zfill(8)

# Substituir valores vazios por 0 nas métricas
colunas_metricas = list(mapeamento_colunas.values())[9:] # Pega todas as colunas de acessibilidade
for col in colunas_metricas:
    df_filtrado[col] = df_filtrado[col].fillna(0).astype(int)

# Salvar arquivo pronto
df_filtrado.to_csv(arquivo_saida, index=False, encoding='utf-8')
print(f"Sucesso! Arquivo '{arquivo_saida}' gerado com as {len(mapeamento_colunas)} colunas corretas.")