"""
extrator_censo_simples.py
Extrai indicadores do Censo Escolar (CSV INEP) e gera JSONs separados
para 2024 e 2025 no formato padronizado do AcessoEdu Nordeste.

Uso:
  py extrator_censo_simples.py
"""

import json
import glob
import math
import os
import sys

import pandas as pd

# ---------------------------------------------------------------------------
# Constantes -- colunas comuns a ambos os formatos
# ---------------------------------------------------------------------------

COLUNAS_BASE = [
    "CO_ENTIDADE",
    "NO_ENTIDADE",
    "NO_MUNICIPIO",
    "SG_UF",
    "TP_DEPENDENCIA",
    "LATITUDE",
    "LONGITUDE",
    "IN_INTERNET",
    "IN_BIBLIOTECA",
    "IN_LABORATORIO_INFORMATICA",
    "IN_QUADRA_ESPORTES",
    "IN_ACESSIBILIDADE_RAMPAS",
    "IN_BANHEIRO_PNE",
    "QT_PROF_PSICOLOGO",
    "IN_AGUA_POTAVEL",
    "DS_ENDERECO",
    "NU_TELEFONE",
    "DS_EMAIL",
]

# Formato 2024 -- niveis de ensino sao colunas simples
NIVEIS_2024 = {
    "infantil": ["IN_INF"],
    "fundamental": ["IN_FUND"],
    "medio": ["IN_MED"],
    "eja": ["IN_EJA"],
    "especial": ["IN_ESP"],
    "profissionalizante": ["IN_PROF"],
}

# Formato 2025 -- niveis de ensino sao colunas decompostas
NIVEIS_2025 = {
    "infantil": ["IN_COMUM_CRECHE", "IN_COMUM_PRE"],
    "fundamental": ["IN_COMUM_FUND_AI", "IN_COMUM_FUND_AF"],
    "medio": [
        "IN_COMUM_MEDIO_MEDIO",
        "IN_COMUM_MEDIO_INTEGRADO",
        "IN_COMUM_MEDIO_FIC",
        "IN_COMUM_MEDIO_NORMAL",
    ],
    "eja": ["IN_COMUM_EJA_FUND", "IN_COMUM_EJA_MEDIO", "IN_COMUM_EJA_PROF"],
    "especial": [
        "IN_ESPECIAL_EXCLUSIVA",
        "IN_ESP_EXCLUSIVA_CRECHE",
        "IN_ESP_EXCLUSIVA_PRE",
        "IN_ESP_EXCLUSIVA_FUND_AI",
        "IN_ESP_EXCLUSIVA_FUND_AF",
        "IN_ESP_EXCLUSIVA_MEDIO_MEDIO",
        "IN_ESP_EXCLUSIVA_MEDIO_INTEGR",
        "IN_ESP_EXCLUSIVA_MEDIO_FIC",
        "IN_ESP_EXCLUSIVA_MEDIO_NORMAL",
        "IN_ESP_EXCLUSIVA_EJA_FUND",
        "IN_ESP_EXCLUSIVA_EJA_MEDIO",
        "IN_ESP_EXCLUSIVA_EJA_PROF",
        "IN_ESP_EXCLUSIVA_PROF",
    ],
    "profissionalizante": ["IN_COMUM_PROF", "IN_PROFISSIONALIZANTE"],
}

# Colunas de indicadores binarios (convertidas para 0/1)
INDICADORES_BINARIOS = [
    "IN_INTERNET",
    "IN_BIBLIOTECA",
    "IN_LABORATORIO_INFORMATICA",
    "IN_QUADRA_ESPORTES",
    "IN_ACESSIBILIDADE_RAMPAS",
    "IN_BANHEIRO_PNE",
    "IN_AGUA_POTAVEL",
]

DEPENDENCIA_MAP = {
    "1": "Federal",
    "2": "Estadual",
    "3": "Municipal",
    "4": "Privada",
}

# Chaves de indicadores usadas no calculo de delta
CHAVES_DELTA = [
    "internet",
    "biblioteca",
    "lab_informatica",
    "quadra_esportes",
    "rampas",
    "banheiro_acessivel",
    "agua_potavel",
]

SAIDA_2024 = "escolas_2024.json"
SAIDA_2025 = "escolas_2025.json"


# ---------------------------------------------------------------------------
# Funcoes auxiliares
# ---------------------------------------------------------------------------


def localizar_csvs():
    """Procura CSVs do Censo 2024 e 2025 em locais conhecidos."""
    base = os.path.join("src", "dados", "Tabelas Escolas")
    encontrados = {}

    # Mapeia padrao de busca -&gt; ano
    padroes = {
        "Escolas-nordeste_2024.csv": 2024,
        "Escolas-nordeste_2025.csv": 2025,
        "TS_ESCOLA_2024*.csv": 2024,
        "TS_ESCOLA_2025*.csv": 2025,
        "TS_ESCOLA*.csv": None,  # ambíguo
    }

    for padrao, ano in padroes.items():
        for local in [padrao, os.path.join(base, padrao)]:
            for caminho in glob.glob(local):
                if ano:
                    encontrados[ano] = caminho

    # Fallback: procura qualquer CSV com 2024/2025 no nome
    for local in [".", base, "src/dados"]:
        for caminho in glob.glob(os.path.join(local, "*2024*.csv")):
            if 2024 not in encontrados:
                encontrados[2024] = caminho
        for caminho in glob.glob(os.path.join(local, "*2025*.csv")):
            if 2025 not in encontrados:
                encontrados[2025] = caminho

    return encontrados


def detectar_formato(df):
    """Detecta se o CSV usa formato 2024 (simples) ou 2025 (decomposto)."""
    colunas = set(df.columns)

    # O formato 2025 tem estas colunas características
    marcadores_2025 = {"IN_COMUM_FUND_AI", "IN_COMUM_FUND_AF", "IN_COMUM_MEDIO_MEDIO"}
    if marcadores_2025 & colunas:
        return 2025

    # O formato 2024 tem estas
    marcadores_2024 = {"IN_INF", "IN_FUND", "IN_MED"}
    if marcadores_2024 & colunas:
        return 2024

    # Fallback: tenta deduzir pela presenca de colunas LATITUDE/LONGITUDE
    if "LATITUDE" in colunas and "LONGITUDE" in colunas:
        return 2025  # arquivos mais recentes tem coordenadas

    return 2024  # fallback conservador


def garantir_colunas(df):
    """Adiciona colunas ausentes com valor padrao '0'."""
    todas = set(COLUNAS_BASE)

    # Adiciona colunas de ambos os formatos de niveis
    for mapa in [NIVEIS_2024, NIVEIS_2025]:
        for sub_cols in mapa.values():
            todas.update(sub_cols)

    for col in todas:
        if col not in df.columns:
            df[col] = "0"

    return df


def normalizar_coordenada(valor_str, tipo):
    """
    Corrige coordenadas do INEP que usam formatos heterogeneos:

    - Valores com multiplos pontos usam ponto como separador de milhar
      (ex: -119.309.573 = -119309573). Requerem divisao por potencia de 10.
    - Valores com 1 ponto onde o float ja e valido (ex: -23.499) ja estao
      no formato decimal correto e sao usados diretamente.
    - Valores com 1 ponto onde o float e invalido (ex: -581.293) tem o ponto
      tratado como separador de milhar e sao normalizados.

    Parametros:
        valor_str : str -- valor bruto do CSV
        tipo      : 'lat' ou 'lon'

    Retorna:
        float normalizado ou None se invalido
    """
    if pd.isna(valor_str) or str(valor_str).strip() in ("", "0", "0.0", "nan"):
        return None

    raw = str(valor_str).strip()
    limite_geo = 90 if tipo == "lat" else 180

    # --- Passo 1: interpretacao direta como float ---
    # Cobre casos como "-23.499" onde o ponto ja e decimal e o valor
    # esta pronto para uso. Se houver multiplos pontos (ex: -119.309.573),
    # float() lanca ValueError e cai no Passo 2.
    try:
        direto = float(raw.replace(",", "."))
        if abs(direto) <= limite_geo and direto != 0:
            return direto
    except (ValueError, TypeError):
        pass

    # --- Passo 2: remocao de pontos (separadores de milhar) + divisao ---
    raw_limpo = raw.replace(".", "").replace(",", "")
    if not raw_limpo:
        return None

    try:
        negativo = raw_limpo.startswith("-")
        valor = abs(int(raw_limpo))
    except (ValueError, TypeError):
        return None

    if valor == 0:
        return None

    # Bounding box aproximado do Brasil
    if tipo == "lat":
        lim_inf, lim_sup = -34, 6
    else:
        lim_inf, lim_sup = -75, -32

    # Varre potencias da menor para a maior (5 -> 9).
    # A primeira que satisfizer ambos os criterios (limite global + bounding box)
    # sera a de maior valor absoluto = menor perda de precisao.
    for potencia in range(5, 10):
        resultado = valor / (10 ** potencia)
        resultado_signed = -resultado if negativo else resultado
        if resultado <= limite_geo and lim_inf <= resultado_signed <= lim_sup:
            return resultado_signed

    # Fallback: apenas restricao geografica global, sem bounding box
    for potencia in range(5, 10):
        resultado = valor / (10 ** potencia)
        if resultado <= limite_geo:
            return -resultado if negativo else resultado

    return None


def _valor_indicador(val):
    """Retorna None se o valor for NaN/vazio, ou int 0/1 se marcado pelo INEP."""
    if val is None:
        return None
    try:
        f = float(val)
        if math.isnan(f):
            return None
        return int(f)
    except (ValueError, TypeError):
        return None


def extrair_coordenadas(lat, lng):
    """Retorna dict com latitude/longitude normalizados, ou 0 se ambas invalidas."""
    lat_num = normalizar_coordenada(lat, "lat")
    lng_num = normalizar_coordenada(lng, "lon")

    if lat_num is None or lng_num is None:
        return {"latitude": 0, "longitude": 0}

    return {"latitude": lat_num, "longitude": lng_num}


def extrair_niveis_ensino(row, formato):
    """Extrai niveis de ensino conforme o formato detectado."""
    mapa = NIVEIS_2024 if formato == 2024 else NIVEIS_2025
    resultado = {}

    for chave, colunas in mapa.items():
        # Para cada nivel, verifica se PELO MENOS UMA das colunas relevantes é 1
        valor = 0
        for col in colunas:
            try:
                v = int(float(row.get(col, 0) or 0))
            except (ValueError, TypeError):
                v = 0
            if v == 1:
                valor = 1
                break
        resultado[chave] = valor

    return resultado


# ---------------------------------------------------------------------------
# Extracao principal
# ---------------------------------------------------------------------------


def extrair(caminho_csv, ano_label):
    print(f"[ETL]   Lendo CSV ({ano_label}): {caminho_csv}")

    df = pd.read_csv(
        caminho_csv,
        sep=";",
        encoding="latin1",
        dtype=str,
        low_memory=False,
    )

    print(f"[ETL]   Total de registos: {len(df):,}")
    print(f"[ETL]   Total de colunas : {len(df.columns)}")

    # Filtrar apenas Nordeste (AL, BA, CE, MA, PB, PE, PI, RN, SE)
    UF_NORDESTE = ["AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE"]
    if "SG_UF" in df.columns:
        antes = len(df)
        df = df[df["SG_UF"].str.strip().str.upper().isin(UF_NORDESTE)]
        print(f"[ETL]   Apos filtro Nordeste: {len(df):,} registos (removidos {antes - len(df):,})")

    formato = detectar_formato(df)
    print(f"[ETL]   Formato detectado: {formato}")

    df = garantir_colunas(df)

    # Converte indicadores binarios para float (NaN = ausente no CSV)
    for col in INDICADORES_BINARIOS:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # Converte QT_PROF_PSICOLOGO para float (NaN = ausente no CSV)
    if "QT_PROF_PSICOLOGO" in df.columns:
        df["QT_PROF_PSICOLOGO"] = pd.to_numeric(df["QT_PROF_PSICOLOGO"], errors="coerce")

    # Constroi o dicionario de saida
    escolas = {}
    total = len(df)

    for idx, row in df.iterrows():
        co_raw = row.get("CO_ENTIDADE")
        if pd.isna(co_raw):
            continue

        try:
            co_entidade = str(int(float(co_raw)))
        except (ValueError, TypeError):
            continue

        if not co_entidade or co_entidade == "0":
            continue

        escolas[co_entidade] = {
            "nome": str(row.get("NO_ENTIDADE", "")).strip()
            if pd.notna(row.get("NO_ENTIDADE"))
            else "",
            "cidade": str(row.get("NO_MUNICIPIO", "")).strip()
            if pd.notna(row.get("NO_MUNICIPIO"))
            else "",
            "uf": str(row.get("SG_UF", "")).strip()
            if pd.notna(row.get("SG_UF"))
            else "",
            "posicao_geografica": extrair_coordenadas(
                row.get("LATITUDE"), row.get("LONGITUDE")
            ),
            "internet": _valor_indicador(row.get("IN_INTERNET")),
            "biblioteca": _valor_indicador(row.get("IN_BIBLIOTECA")),
            "lab_informatica": _valor_indicador(row.get("IN_LABORATORIO_INFORMATICA")),
            "quadra_esportes": _valor_indicador(row.get("IN_QUADRA_ESPORTES")),
            "rampas": _valor_indicador(row.get("IN_ACESSIBILIDADE_RAMPAS")),
            "banheiro_acessivel": _valor_indicador(row.get("IN_BANHEIRO_PNE")),
            "psicologos": _valor_indicador(row.get("QT_PROF_PSICOLOGO")),
            "agua_potavel": _valor_indicador(row.get("IN_AGUA_POTAVEL")),
            "dependencia": DEPENDENCIA_MAP.get(
                str(row.get("TP_DEPENDENCIA", "")).strip(), "Nao informada"
            ),
            "niveis_ensino": extrair_niveis_ensino(row, formato),
            "endereco": str(row.get("DS_ENDERECO", "")).strip()
            if pd.notna(row.get("DS_ENDERECO"))
            and str(row.get("DS_ENDERECO")).strip()
            else None,
            "telefone": str(row.get("NU_TELEFONE", "")).strip()
            if pd.notna(row.get("NU_TELEFONE"))
            and str(row.get("NU_TELEFONE")).strip()
            else None,
            "email": str(row.get("DS_EMAIL", "")).strip()
            if pd.notna(row.get("DS_EMAIL"))
            and str(row.get("DS_EMAIL")).strip()
            else None,
        }

        if (idx + 1) % 50000 == 0:
            print(f"[ETL]     Processados {idx + 1:,}/{total:,} registos...")

    print(f"[ETL]   Escolas unicas extraidas: {len(escolas):,}")
    return escolas


# ---------------------------------------------------------------------------
# Persistencia
# ---------------------------------------------------------------------------


def backfill_coordenadas_2024(escolas_2024, escolas_2025):
    """Para cada escola de 2024 sem coordenadas validas, busca fallback no 2025."""
    corrigidas = 0
    for co_entidade, dados in escolas_2024.items():
        pos = dados.get("posicao_geografica", {})
        lat = pos.get("latitude", 0)
        lng = pos.get("longitude", 0)

        if lat != 0 or lng != 0:
            continue

        fallback = escolas_2025.get(co_entidade)
        if not fallback:
            continue

        fb_pos = fallback.get("posicao_geografica", {})
        fb_lat = fb_pos.get("latitude", 0)
        fb_lng = fb_pos.get("longitude", 0)

        if fb_lat == 0 and fb_lng == 0:
            continue

        if abs(fb_lat) <= 90 and abs(fb_lng) <= 180:
            dados["posicao_geografica"] = {"latitude": fb_lat, "longitude": fb_lng}
            corrigidas += 1

    if corrigidas:
        print(f"[ETL]   Backfill 2024: {corrigidas:,} escolas receberam coordenadas do 2025")
    return escolas_2024


def calcular_deltas(escolas_2024, escolas_2025):
    """Calcula delta_infraestrutura para cada escola presente em ambos os anos.

    O delta e a variacao percentual entre o total de indicadores atendidos
    em 2025 vs 2024. Se a escola nao existir em 2024, o delta e None.
    """
    total_indicadores = len(CHAVES_DELTA)

    for co_entidade, dados_2025 in escolas_2025.items():
        dados_2024 = escolas_2024.get(co_entidade)
        if not dados_2024:
            dados_2025["delta_infraestrutura"] = None
            continue

        soma_2024 = sum(
            1 for chave in CHAVES_DELTA if dados_2024.get(chave) == 1
        )
        soma_2025 = sum(
            1 for chave in CHAVES_DELTA if dados_2025.get(chave) == 1
        )

        if soma_2024 == 0 and soma_2025 == 0:
            dados_2025["delta_infraestrutura"] = 0.0
        elif soma_2024 == 0:
            dados_2025["delta_infraestrutura"] = round(
                (soma_2025 / total_indicadores) * 100, 1
            )
        else:
            delta = ((soma_2025 - soma_2024) / soma_2024) * 100
            dados_2025["delta_infraestrutura"] = round(delta, 1)

    print(
        f"[ETL]   Delta calculado para {len(escolas_2025):,} escolas do ano 2025"
    )


def salvar_json(escolas, caminho_saida):
    with open(caminho_saida, "w", encoding="utf-8") as f:
        json.dump(escolas, f, ensure_ascii=False, indent=2)

    tamanho_mb = os.path.getsize(caminho_saida) / (1024 * 1024)
    print(f"[ETL]   JSON salvo: {caminho_saida} ({tamanho_mb:.1f} MB)")


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------


def main():
    print("=" * 60)
    print("[ETL] Extrator Censo Simples -- INEP -&gt; JSON (2024 + 2025)")
    print("=" * 60)
    print()

    csvs = localizar_csvs()
    if not csvs:
        print("[ERRO] Nenhum CSV do Censo encontrado.")
        print("       Coloque os ficheiros em src/dados/Tabelas Escolas/")
        print("       com nome contendo '2024' ou '2025'.")
        sys.exit(1)

    print(f"[ETL] CSVs encontrados: {list(csvs.keys())}")
    print()

    escolas_2024 = {}
    escolas_2025 = {}

    # Processa 2024
    if 2024 in csvs:
        print("[ETL] === Processando 2024 ===")
        escolas_2024 = extrair(csvs[2024], "2024")
    else:
        print("[ETL] AVISO: CSV de 2024 nao encontrado. Pulando.")

    print()

    # Processa 2025
    if 2025 in csvs:
        print("[ETL] === Processando 2025 ===")
        escolas_2025 = extrair(csvs[2025], "2025")
    else:
        print("[ETL] AVISO: CSV de 2025 nao encontrado. Pulando.")

    print()

    # Backfill: coord 2024 <- 2025
    if escolas_2024 and escolas_2025:
        print("[ETL] === Backfill Coordenadas 2024 a partir de 2025 ===")
        escolas_2024 = backfill_coordenadas_2024(escolas_2024, escolas_2025)

        print()
        print("[ETL] === Calculo de Delta Infraestrutura (2024 -> 2025) ===")
        calcular_deltas(escolas_2024, escolas_2025)

    # Persistencia
    if escolas_2024:
        salvar_json(escolas_2024, SAIDA_2024)
    if escolas_2025:
        salvar_json(escolas_2025, SAIDA_2025)

    print()
    print("[ETL] Pronto.")


if __name__ == "__main__":
    main()
