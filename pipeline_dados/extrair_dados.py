"""
pipeline_dados/extrair_dados.py
Le os arquivos brutos do Censo Escolar 2024 e 2025 e extrai apenas as colunas
usadas no projeto AcessoEdu Nordeste.

Uso:
    python pipeline_dados/extrair_dados.py

SITUACAO DAS COORDENADAS (confirmada via diagnostico):
    - 2024: arquivo regional do NE, mas o INEP NAO incluiu colunas de lat/lng
            nesse export. lat/lng = null e o comportamento correto.
    - 2025: arquivo nacional, colunas LATITUDE e LONGITUDE presentes (indices
            33 e 34). Filtro de estados do Nordeste aplicado para descartar
            as ~490k escolas fora da regiao.
"""

import csv
import json
import os

# ---------------------------------------------------------------------------
# Caminhos
# ---------------------------------------------------------------------------
_BASE = os.path.join(os.path.dirname(__file__), '..', 'src', 'dados', 'Tabelas Escolas')
ARQUIVO_2024 = os.path.join(_BASE, 'Escolas-nordeste_2024.csv')
ARQUIVO_2025 = os.path.join(_BASE, 'Escolas-nordeste_2025.csv')

# ---------------------------------------------------------------------------
# Mapeamento de colunas do Censo -> nome final no JSON
# ---------------------------------------------------------------------------
COLUNAS_CENSO = {
    'CO_ENTIDADE':              'id',
    'NO_ENTIDADE':              'nome',
    'NO_MUNICIPIO':             'municipio',
    'SG_UF':                    'uf',
    'NO_REGIAO':                'regiao',
    'IN_BANHEIRO_PNE':          'banheiro_pne',
    'IN_QUADRA_ESPORTES':       'quadra',
    'IN_ACESSIBILIDADE_RAMPAS': 'rampa_acessibilidade',
    'IN_INTERNET':              'internet',
    'IN_LABORATORIO_INFORMATICA': 'laboratorio',
    'IN_AGUA_POTAVEL':          'agua_potavel',
    'IN_ENERGIA_REDE_PUBLICA':  'energia_eletrica',
    'CO_CEP':                   'cep',
}

INDICADORES = [
    'banheiro_pne', 'quadra', 'rampa_acessibilidade',
    'internet', 'laboratorio', 'agua_potavel', 'energia_eletrica',
]

# ---------------------------------------------------------------------------
# Nordeste — usado para filtrar o arquivo nacional 2025
# ---------------------------------------------------------------------------
UFS_NORDESTE = {'AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'}

# ---------------------------------------------------------------------------
# Nomes EXATOS das colunas de coordenadas em cada ano
# (confirmados via diagnostico_colunas.py)
#   2024 -> nao existem (INEP nao incluiu no export regional)
#   2025 -> 'LATITUDE' e 'LONGITUDE'
# ---------------------------------------------------------------------------
COLUNAS_COORDS = {
    2024: (None,        None),
    2025: ('LATITUDE',  'LONGITUDE'),
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _para_int(valor):
    s = str(valor).strip() if valor is not None else ''
    return 1 if s in ('1', '1.0') else 0


def _sanitizar_cep(valor):
    s = ''.join(ch for ch in str(valor or '') if ch.isdigit())
    return s.zfill(8) if s else ''


def _sanitizar_coordenada(valor):
    """
    Converte para float, garante sinal negativo (Brasil) e trata vazios/zeros.
    Aceita tanto ponto quanto virgula como separador decimal.
    """
    if valor is None:
        return None
    s = str(valor).strip()
    if not s or s.lower() in ('nan', '0', '0.0', 'null', 'none'):
        return None
    try:
        val = float(s.replace(',', '.'))
        if val == 0.0:
            return None
        return -abs(val)   # Brasil: sempre negativo (Sul / Oeste)
    except (ValueError, TypeError):
        return None


def calcular_indicador(escola):
    soma = sum(1 for ind in INDICADORES if escola.get(ind) == 1)
    return round((soma / len(INDICADORES)) * 10, 1)


# ---------------------------------------------------------------------------
# Extracao CSV
# ---------------------------------------------------------------------------
def extrair_csv(caminho, ano, filtrar_nordeste=False):
    if not os.path.exists(caminho):
        print(f'  ERRO: Arquivo nao encontrado: {caminho}')
        return []

    col_lat, col_lng = COLUNAS_COORDS.get(ano, (None, None))

    if col_lat:
        print(f'  [coords] Usando colunas: "{col_lat}" / "{col_lng}"')
    else:
        print(f'  [coords] Ano {ano}: sem colunas de coordenadas no export do INEP — lat/lng = null.')

    dados = []
    sem_coords = 0
    descartadas = 0

    with open(caminho, 'r', encoding='latin1', errors='replace') as f:
        leitor = csv.DictReader(f, delimiter=';')

        for linha in leitor:
            escola = {'ano': ano}

            for col_orig, col_dest in COLUNAS_CENSO.items():
                valor = linha.get(col_orig, '') or ''
                if col_dest in INDICADORES:
                    escola[col_dest] = _para_int(valor)
                elif col_dest == 'cep':
                    escola[col_dest] = _sanitizar_cep(valor)
                else:
                    escola[col_dest] = valor.strip()

            if not escola.get('id'):
                continue

            # Filtro Nordeste (arquivo nacional 2025)
            if filtrar_nordeste and escola.get('uf', '').upper() not in UFS_NORDESTE:
                descartadas += 1
                continue

            # Coordenadas
            lat = _sanitizar_coordenada(linha.get(col_lat) if col_lat else None)
            lng = _sanitizar_coordenada(linha.get(col_lng) if col_lng else None)
            escola['lat'] = lat
            escola['lng'] = lng

            if lat is None or lng is None:
                sem_coords += 1

            escola['indicador_geral'] = calcular_indicador(escola)
            dados.append(escola)

    total = len(dados)
    if filtrar_nordeste:
        print(f'  Filtro Nordeste: {descartadas:,} escolas de outras regioes descartadas.')
    print(f'  Registros extraidos: {total:,}')
    if col_lat:
        com_coords = total - sem_coords
        print(f'  Com coordenadas validas: {com_coords:,} ({100*com_coords//total if total else 0}%)')
        print(f'  Sem coordenadas (null):  {sem_coords:,}')

    return dados


# ---------------------------------------------------------------------------
# Salvar JSON
# ---------------------------------------------------------------------------
def salvar_json(dados, nome_arquivo):
    caminho = os.path.join(os.path.dirname(__file__), nome_arquivo)
    with open(caminho, 'w', encoding='utf-8') as f:
        json.dump(dados, f, ensure_ascii=False, indent=2)
    print(f'  Salvo: {caminho} ({len(dados):,} registros)')


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    print('=' * 60)
    print('Pipeline de extracao — AcessoEdu Nordeste')
    print('=' * 60)

    configs = [
        (ARQUIVO_2024, 2024, False),   # ja e regional, sem filtro
        (ARQUIVO_2025, 2025, True),    # nacional -> filtrar Nordeste
    ]

    for caminho, ano, filtrar in configs:
        print(f'\n[{ano}] {caminho}')
        dados = extrair_csv(caminho, ano, filtrar_nordeste=filtrar)
        if dados:
            salvar_json(dados, f'dados_extraidos_{ano}.json')
        else:
            print(f'  AVISO: nenhum registro gerado para {ano}.')

    print('\n' + '=' * 60)
    print('Extracao concluida.')


if __name__ == '__main__':
    main()