# Consulta para puxar o histórico e médias do SAEB (Escolas do Nordeste)
query_saeb = """
SELECT 
    ano,
    id_escola,
    media_proficiencia_lp,
    media_proficiencia_mt
FROM `basedosdados.br_inep_saeb.escola`
WHERE sigla_uf IN ('PE', 'PB', 'CE', 'RN', 'BA', 'MA', 'PI', 'AL', 'SE')
ORDER BY ano DESC
"""

# O seu client do BigQuery executará isso para gerar os gráficos de evolução
df_saeb = client.query(query_saeb).to_dataframe()