"""
saeb_scraper.py
---------------
Scraper da API do INEP para coletar medias SAEB 2023 por escola.

Endpoint:
  GET https://saeb.inep.gov.br/saeb/rest/resultado-final/escolas/{CO_ENTIDADE}/anos-projeto/2023

Execucao:
  pip install requests pandas tqdm
  python saeb_scraper.py --ids 23145366 23259191 29106103   # teste
  python saeb_scraper.py --input TS_ESCOLA.csv              # producao
"""

import argparse
import json
import time
import sys
import logging
from pathlib import Path

import requests
import pandas as pd
from tqdm import tqdm

# ---------------------------------------------------------------------------
# Configuracao
# ---------------------------------------------------------------------------
API_BASE      = "https://saeb.inep.gov.br/saeb/rest/resultado-final/escolas/{co}/anos-projeto/2023"
CHECKPOINT_FILE = "saeb_checkpoint.json"
OUTPUT_FILE   = "escolas_saeb_historico.json"

DELAY_BETWEEN_REQUESTS = 0.5
DELAY_ON_ERROR         = 10
MAX_RETRIES            = 3

# coDisciplina → sigla
DISCIPLINAS_MAP = {1: "LP", 2: "MT"}

# idSerie → sufixo  (campo correto confirmado no JSON real da API)
SERIES_MAP = {5: "5EF", 9: "9EF", 13: "EM"}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("saeb_scraper.log", encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Parsing do JSON da API
# ---------------------------------------------------------------------------

def parse_resposta_inep(json_data: dict) -> dict:
    """
    Extrai medias SAEB 2023 do JSON retornado pela API do INEP.

    Estrutura real confirmada:
      dados.disciplinas[].coDisciplina          → 1=LP, 2=MT
      dados.disciplinas[].series[].idSerie      → 5, 9, 13
      dados.disciplinas[].series[]
            .desempenhoEscolaEdicaoesSaeb[]
            .name                               → "2023", "2021", ...
            .value                              → media (float)
    """
    medias = {}
    try:
        disciplinas = (json_data or {}).get("dados", {}).get("disciplinas") or []

        for disc in disciplinas:
            sigla_disc = DISCIPLINAS_MAP.get(disc.get("coDisciplina"))
            if not sigla_disc:
                continue

            for serie in disc.get("series") or []:
                # CORRECAO: campo e "idSerie", nao "coSerie"
                sufixo_serie = SERIES_MAP.get(serie.get("idSerie"))
                if not sufixo_serie:
                    continue

                for edicao in serie.get("desempenhoEscolaEdicaoesSaeb") or []:
                    # CORRECAO: "name" e direto no objeto, nao dentro de "edicaoSaeb"
                    if str(edicao.get("name", "")) == "2023":
                        val = edicao.get("value")
                        if val is not None:
                            chave = f"MEDIA_{sufixo_serie}_{sigla_disc}"
                            try:
                                medias[chave] = round(float(val), 2)
                            except (ValueError, TypeError):
                                pass
    except Exception as e:
        log.warning(f"Erro ao parsear JSON: {e}")

    return medias

# ---------------------------------------------------------------------------
# Consulta HTTP
# ---------------------------------------------------------------------------

def consultar_api_inep(session: requests.Session, co_entidade: str) -> tuple:
    """Retorna (status: str, medias: dict)"""
    url = API_BASE.format(co=co_entidade)

    for tentativa in range(1, MAX_RETRIES + 1):
        try:
            res = session.get(url, timeout=15)

            if res.status_code == 200:
                try:
                    data = res.json()
                except Exception:
                    return "json_error", {}

                # Series vazias = escola sem resultado publicado
                disciplinas = (data.get("dados") or {}).get("disciplinas") or []
                tem_series = any(d.get("series") for d in disciplinas)
                if not tem_series:
                    return "sem_resultado", {}

                medias = parse_resposta_inep(data)
                return ("ok" if medias else "sem_medias_2023"), medias

            elif res.status_code == 404:
                return "not_found", {}

            elif res.status_code in (429, 503):
                log.warning(f"Rate limit {res.status_code} em {co_entidade}. Aguardando {DELAY_ON_ERROR}s...")
                time.sleep(DELAY_ON_ERROR)

            else:
                log.warning(f"HTTP {res.status_code} para {co_entidade} (tentativa {tentativa})")
                time.sleep(2)

        except requests.exceptions.Timeout:
            log.warning(f"Timeout em {co_entidade} (tentativa {tentativa})")
            time.sleep(3)
        except requests.exceptions.RequestException as e:
            log.warning(f"Erro de conexao em {co_entidade}: {e} (tentativa {tentativa})")
            time.sleep(3)

    return "error", {}

# ---------------------------------------------------------------------------
# Carga do CSV
# ---------------------------------------------------------------------------

def carregar_ids_nordeste(caminho_csv: str) -> list:
    log.info(f"Lendo {caminho_csv}...")
    try:
        df = pd.read_csv(caminho_csv, sep=";", encoding="latin-1", low_memory=False)
    except Exception as e:
        log.error(f"Erro ao ler CSV: {e}")
        sys.exit(1)

    if "ID_REGIAO" in df.columns:
        df = df[df["ID_REGIAO"] == 2]
        log.info(f"Escolas nordestinas: {len(df):,}")
    else:
        log.warning("Coluna ID_REGIAO nao encontrada — usando todas")

    id_col = "ID_ESCOLA" if "ID_ESCOLA" in df.columns else df.columns[0]
    ids = df[id_col].dropna().astype(str).str.strip().unique().tolist()
    log.info(f"IDs unicos para processar: {len(ids):,}")
    return ids

# ---------------------------------------------------------------------------
# Loop principal
# ---------------------------------------------------------------------------

def rodar_scraper(ids: list, output_path: str):
    global DELAY_BETWEEN_REQUESTS

    # Carrega checkpoint
    resultados = {}
    if Path(CHECKPOINT_FILE).exists():
        try:
            with open(CHECKPOINT_FILE, "r", encoding="utf-8") as f:
                resultados = json.load(f)
            log.info(f"Checkpoint: {len(resultados):,} escolas ja processadas")
        except Exception:
            log.warning("Checkpoint corrompido. Iniciando do zero.")

    pendentes = [i for i in ids if i not in resultados]
    log.info(f"Pendentes: {len(pendentes):,}")

    if not pendentes:
        log.info("Tudo ja processado!")
        _salvar(resultados, output_path)
        return

    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (AcessoEdu-Nordeste)",
        "Accept": "application/json",
        "Referer": "https://saeb.inep.gov.br/saeb/resultado-final-externo",
    })

    try:
        for i, co in enumerate(tqdm(pendentes, desc="Coletando SAEB", unit="escola")):
            status, medias = consultar_api_inep(session, co)
            resultados[co] = {"status": status, "historico_saeb": medias}

            if (i + 1) % 100 == 0:
                _salvar(resultados, CHECKPOINT_FILE)
                log.info(f"Checkpoint: {len(resultados):,} escolas salvas")

            time.sleep(DELAY_BETWEEN_REQUESTS)

    except KeyboardInterrupt:
        log.info("Interrompido. Salvando checkpoint...")

    _salvar(resultados, CHECKPOINT_FILE)

    # Resumo
    contagem = {}
    for v in resultados.values():
        s = v["status"]
        contagem[s] = contagem.get(s, 0) + 1

    log.info("=" * 50)
    log.info(f"Total processado : {len(resultados):,}")
    for status, n in sorted(contagem.items()):
        log.info(f"  {status:25s}: {n:,}")
    log.info(f"Arquivo final    : {output_path}")

    _salvar(resultados, output_path)


def _salvar(dados: dict, caminho: str):
    with open(caminho, "w", encoding="utf-8") as f:
        json.dump(dados, f, ensure_ascii=False, indent=2)

# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

def main():
    global DELAY_BETWEEN_REQUESTS

    parser = argparse.ArgumentParser(description="Scraper SAEB 2023 por escola")
    parser.add_argument("--input",  default="TS_ESCOLA.csv")
    parser.add_argument("--output", default=OUTPUT_FILE)
    parser.add_argument("--delay",  type=float, default=DELAY_BETWEEN_REQUESTS)
    parser.add_argument("--ids",    nargs="*",
                        help="IDs manuais para teste: --ids 23145366 23259191")
    args = parser.parse_args()

    DELAY_BETWEEN_REQUESTS = args.delay

    if args.ids:
        ids = args.ids
        log.info(f"Modo teste: {len(ids)} IDs")
    elif Path(args.input).exists():
        ids = carregar_ids_nordeste(args.input)
    else:
        log.error(f"Arquivo nao encontrado: {args.input}")
        log.error("Use --ids 23145366 para testar, ou --input para o CSV completo")
        sys.exit(1)

    rodar_scraper(ids, args.output)


if __name__ == "__main__":
    main()