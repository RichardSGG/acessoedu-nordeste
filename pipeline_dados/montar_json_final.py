"""
montar_json_final.py
---------------------
Combina o TS_ESCOLA.csv com os resultados do saeb_scraper.py
para gerar o escolas_saeb_historico.json final do projeto AcessoEdu-Nordeste.

Execução:
  python montar_json_final.py \
    --csv TS_ESCOLA.csv \
    --saeb saeb_checkpoint.json \
    --output escolas_saeb_historico.json
"""

import argparse
import json
import logging
import sys
from pathlib import Path

import pandas as pd

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger(__name__)

# Colunas do TS_ESCOLA que queremos manter no JSON final
COLUNAS_ESCOLA = [
    "ID_ESCOLA",
    "ID_UF",
    "ID_MUNICIPIO",
    "IN_PUBLICA",
    "ID_LOCALIZACAO",
    "NIVEL_SOCIO_ECONOMICO",
    "NU_MATRICULADOS_CENSO_5EF",
    "NU_MATRICULADOS_CENSO_9EF",
    "NU_MATRICULADOS_CENSO_EM",
    # Médias internas do TS_ESCOLA (úteis como fallback)
    "MEDIA_5EF_LP",
    "MEDIA_5EF_MT",
    "MEDIA_9EF_LP",
    "MEDIA_9EF_MT",
    "MEDIA_EM_LP",
    "MEDIA_EM_MT",
]


def carregar_csv(caminho: str) -> pd.DataFrame:
    log.info(f"Lendo {caminho}...")
    df = pd.read_csv(caminho, sep=";", encoding="latin-1", low_memory=False)

    # Filtra Nordeste
    if "ID_REGIAO" in df.columns:
        df = df[df["ID_REGIAO"] == 2].copy()
        log.info(f"Escolas nordestinas no CSV: {len(df):,}")
    else:
        log.warning("ID_REGIAO não encontrada — usando todas")

    # Garante coluna de ID como string
    df["ID_ESCOLA"] = df["ID_ESCOLA"].astype(str).str.strip()

    # Mantém só as colunas que existem
    cols = [c for c in COLUNAS_ESCOLA if c in df.columns]
    df = df[cols]
    return df


def carregar_saeb(caminho: str) -> dict:
    log.info(f"Lendo {caminho}...")
    with open(caminho, "r", encoding="utf-8") as f:
        return json.load(f)


def montar_registro(row: dict, saeb: dict) -> dict:
    co = str(row.get("ID_ESCOLA", "")).strip()
    resultado_saeb = saeb.get(co, {})

    historico = resultado_saeb.get("historico_saeb", {})
    fonte = "api_inep" if historico else "nenhum"

    # Fallback: usa média do TS_ESCOLA se API não trouxe resultado
    if not historico:
        fallback = {}
        for campo in ["MEDIA_5EF_LP", "MEDIA_5EF_MT", "MEDIA_9EF_LP",
                      "MEDIA_9EF_MT", "MEDIA_EM_LP", "MEDIA_EM_MT"]:
            val = row.get(campo)
            if val is not None and str(val) not in ("", "nan"):
                try:
                    fallback[campo] = round(float(val), 2)
                except (ValueError, TypeError):
                    pass
        if fallback:
            historico = fallback
            fonte = "ts_escola_csv"

    return {
        "co_entidade": co,
        "id_uf": row.get("ID_UF"),
        "id_municipio": row.get("ID_MUNICIPIO"),
        "publica": bool(row.get("IN_PUBLICA")) if row.get("IN_PUBLICA") is not None else None,
        "localizacao": row.get("ID_LOCALIZACAO"),  # 1=Urbana, 2=Rural
        "nivel_socioeconomico": row.get("NIVEL_SOCIO_ECONOMICO"),
        "matriculados": {
            "ef5": _int(row.get("NU_MATRICULADOS_CENSO_5EF")),
            "ef9": _int(row.get("NU_MATRICULADOS_CENSO_9EF")),
            "em":  _int(row.get("NU_MATRICULADOS_CENSO_EM")),
        },
        "historico_saeb": historico,
        "fonte_saeb": fonte,
        "status_api": resultado_saeb.get("status", "nao_consultado"),
    }


def _int(val):
    try:
        v = float(val)
        return int(v) if not (v != v) else None  # NaN check
    except (TypeError, ValueError):
        return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv",    default="TS_ESCOLA.csv")
    parser.add_argument("--saeb",   default="saeb_checkpoint.json")
    parser.add_argument("--output", default="escolas_saeb_historico.json")
    args = parser.parse_args()

    # Verifica arquivos
    if not Path(args.csv).exists():
        log.error(f"CSV não encontrado: {args.csv}")
        sys.exit(1)

    saeb = {}
    if Path(args.saeb).exists():
        saeb = carregar_saeb(args.saeb)
        log.info(f"Resultados SAEB carregados: {len(saeb):,} escolas")
    else:
        log.warning(f"Checkpoint SAEB não encontrado: {args.saeb}")
        log.warning("Montando JSON apenas com dados do CSV (sem médias SAEB por escola)")

    df = carregar_csv(args.csv)

    log.info("Montando registros...")
    registros = []
    for _, row in df.iterrows():
        registros.append(montar_registro(row.to_dict(), saeb))

    # Estatísticas
    com_saeb = sum(1 for r in registros if r["fonte_saeb"] == "api_inep")
    fallback  = sum(1 for r in registros if r["fonte_saeb"] == "ts_escola_csv")
    sem_dado  = sum(1 for r in registros if r["fonte_saeb"] == "nenhum")

    log.info("=" * 50)
    log.info(f"Total de escolas: {len(registros):,}")
    log.info(f"  ✅ Com médias da API INEP  : {com_saeb:,}")
    log.info(f"  🔄 Fallback (média do CSV) : {fallback:,}")
    log.info(f"  ❌ Sem nenhuma média       : {sem_dado:,}")

    # Salva
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(registros, f, ensure_ascii=False, indent=2)

    log.info(f"\nArquivo salvo: {args.output} ({Path(args.output).stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
