"""
pipeline_dados/extrair_complementos.py
Extrai CO_ENTIDADE (id_escola), NU_ENDERECO (numero), TP_DEPENDENCIA e
NU_TELEFONE (telefone) dos CSVs originais do Censo Escolar INEP.

Mapeia TP_DEPENDENCIA: 1=Federal, 2=Estadual, 3=Municipal, 4=Privada

Uso:
  python pipeline_dados/extrair_complementos.py
"""

import csv
import json
import os
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SAIDA = Path(__file__).resolve().parent / "saida"

MAPA_DEPENDENCIA = {
    1: "Federal",
    2: "Estadual",
    3: "Municipal",
    4: "Privada",
}


def encontrar_csv(ano: int) -> Path | None:
    """Procura CSV contendo o ano no nome, em varios diretorios comuns (recursivo)."""
    bases = [
        Path.home() / "Downloads",
        Path.home() / "Desktop",
        RAIZ,
        RAIZ / "src" / "dados",
    ]
    for base in bases:
        if not base.exists():
            continue
        candidatos = (
            list(base.rglob(f"microdados_ed_basica*{ano}*.csv"))
            + list(base.rglob(f"microdados_ed_basica*{ano}*.CSV"))
            + list(base.rglob(f"Tabela_Escola*{ano}*.csv"))
            + list(base.rglob(f"Tabela_Escola*{ano}*.CSV"))
        )
        if candidatos:
            return candidatos[0]
    return None


def extrair(ano: int) -> dict:
    """Le o CSV do ano e retorna dict {id_escola: {dependencia, numero, telefone}}."""
    csv_path = encontrar_csv(ano)
    if not csv_path:
        print(f"  [ERRO] CSV para {ano} nao encontrado em {RAIZ} ou {RAIZ / 'src' / 'dados'}")
        sys.exit(1)

    print(f"  Lendo {csv_path.name} ...")
    encoding = "utf-8"
    try:
        with open(csv_path, encoding="utf-8") as f:
            f.read(1024)
    except UnicodeDecodeError:
        encoding = "latin-1"

    resultado = {}
    total = 0
    com_numero = 0
    com_telefone = 0

    with open(csv_path, encoding=encoding) as f:
        reader = csv.DictReader(f, delimiter=";")
        for row in reader:
            id_escola = (row.get("CO_ENTIDADE") or "").strip()
            if not id_escola:
                continue

            tp_dep = row.get("TP_DEPENDENCIA") or row.get("TP_DEPENDÊNCIA") or ""
            tp_dep = tp_dep.strip()
            dep_num = int(tp_dep) if tp_dep.isdigit() else 0
            dependencia = MAPA_DEPENDENCIA.get(dep_num, "")

            numero = (row.get("NU_ENDERECO") or row.get("NU_ENDEREÇO") or "").strip()

            telefone = (row.get("NU_TELEFONE") or row.get("DS_TELEFONE") or "").strip()
            if telefone:
                telefone = telefone.replace("(", "").replace(")", "").replace("-", "").replace(" ", "")

            resultado[id_escola] = {
                "id_escola": id_escola,
                "dependencia": dependencia,
                "numero": numero if numero else None,
                "telefone": telefone if telefone else None,
            }

            total += 1
            if numero:
                com_numero += 1
            if telefone:
                com_telefone += 1

    print(f"  Extraidos: {total} escolas | {com_numero} com numero | {com_telefone} com telefone")
    return resultado


def main():
    os.makedirs(SAIDA, exist_ok=True)

    for ano in (2024, 2025):
        print(f"\nProcessando ano {ano}...")
        dados = extrair(ano)
        out_path = SAIDA / f"complementos_{ano}.json"
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(dados, f, ensure_ascii=False, indent=2)
        print(f"  Salvo: {out_path} ({len(dados)} registros)")

    print("\nExtracao de complementos concluida.")


if __name__ == "__main__":
    main()
