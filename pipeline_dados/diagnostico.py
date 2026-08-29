import pandas as pd

df = pd.read_csv(
    "src/dados/Tabelas SAEB/TS_ALUNO_2EF.csv",
    sep=";", encoding="latin-1", dtype=str, nrows=3
)
print("Colunas TS_ALUNO_2EF:", list(df.columns))