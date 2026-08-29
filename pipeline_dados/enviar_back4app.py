"""
pipeline_dados/enviar_back4app.py
Envia os dados processados para a tabela EscolaEstatistica no Back4App
usando a REST API. Envia em lotes de 50 para respeitar rate limits.

Credenciais devem ser configuradas via variaveis de ambiente:
    BACK4APP_APP_ID  — Application ID do Back4App
    BACK4APP_REST_KEY — REST API Key do Back4App

Uso:
    set BACK4APP_APP_ID=SEU_APP_ID
    set BACK4APP_REST_KEY=SUA_REST_KEY
    python enviar_back4app.py
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error

B4A_BASE = 'https://parseapi.back4app.com'
BATCH_SIZE = 150
DELAY_ENTRE_LOTES = 1.2  # segundos


def _carregar_env():
    """Le o arquivo .env na raiz do projeto e carrega no os.environ."""
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    if not os.path.exists(env_path):
        return
    with open(env_path, 'r', encoding='utf-8') as f:
        for linha in f:
            linha = linha.strip()
            if not linha or linha.startswith('#'):
                continue
            if '=' in linha:
                chave, _, valor = linha.partition('=')
                chave = chave.strip()
                valor = valor.strip().strip('"').strip("'")
                if chave and chave not in os.environ:
                    os.environ[chave] = valor


def obter_credenciais():
    _carregar_env()
    app_id = os.environ.get('APP_ID')
    rest_key = os.environ.get('REST_API_KEY')

    if not app_id or not rest_key:
        print('ERRO: Variaveis APP_ID e REST_API_KEY nao encontradas no .env.')
        print('Certifique-se de que o arquivo .env existe na raiz do projeto.')
        sys.exit(1)

    return app_id, rest_key


def carregar_dados(arquivo):
    caminho = os.path.join(os.path.dirname(__file__), 'saida', arquivo)
    with open(caminho, 'r', encoding='utf-8') as f:
        return json.load(f)


def criar_lote(dados, headers, classe):
    """Cria objetos no Back4App via batch request."""
    url = f'{B4A_BASE}/parse/batch'

    requisicoes = []
    for escola in dados:
        lat = escola.get('lat')
        lng = escola.get('lng')
        coords_validas = (
            lat is not None and lng is not None
            and lat != 0.0 and lng != 0.0
            and lat != 0 and lng != 0
        )

        body = {
            'id': str(escola.get('id', '')),
            'nome': escola.get('nome', ''),
            'municipio': escola.get('municipio', ''),
            'uf': escola.get('uf', ''),
            'regiao': escola.get('regiao', ''),
            'ano': escola.get('ano', 0),
            'banheiro_pne': escola.get('banheiro_pne', 0),
            'quadra': escola.get('quadra', 0),
            'rampa_acessibilidade': escola.get('rampa_acessibilidade', 0),
            'internet': escola.get('internet', 0),
            'laboratorio': escola.get('laboratorio', 0),
            'agua_potavel': escola.get('agua_potavel', 0),
            'energia_eletrica': escola.get('energia_eletrica', 0),
            'indicador_geral': escola.get('indicador_geral', 0),
            'cep': escola.get('cep', ''),
        }

        if coords_validas:
            body['lat'] = lat
            body['lng'] = lng
            body['posicao_geografica'] = {
                '__type': 'GeoPoint',
                'latitude': lat,
                'longitude': lng,
            }

        requisicoes.append({
            'method': 'POST',
            'path': f'/parse/classes/{classe}',
            'body': body,
        })

    data = json.dumps({'requests': requisicoes}).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers=headers, method='POST')

    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8') if e.fp else ''
        raise RuntimeError(f'HTTP {e.code}: {body}')


def enviar_ano(arquivo, ano, headers):
    """Envia todas as escolas de um ano em lotes de BATCH_SIZE."""
    print(f'\nCarregando escolas de {ano}...')
    dados = carregar_dados(arquivo)
    print(f'  {len(dados)} escolas carregadas.')

    total_lotes = (len(dados) + BATCH_SIZE - 1) // BATCH_SIZE
    classe = f'EscolaEstatistica'

    for i in range(0, len(dados), BATCH_SIZE):
        lote = dados[i:i + BATCH_SIZE]
        num_lote = i // BATCH_SIZE + 1

        try:
            criar_lote(lote, headers, classe)
            print(f'  Lote {num_lote}/{total_lotes} enviado ({len(lote)} escolas)')
        except RuntimeError as e:
            print(f'  ERRO no lote {num_lote}: {e}')
            continue

        if num_lote < total_lotes:
            time.sleep(DELAY_ENTRE_LOTES)

    print(f'  Envio de {ano} concluido.')


def main():
    app_id, rest_key = obter_credenciais()

    headers = {
        'X-Parse-Application-Id': app_id,
        'X-Parse-REST-API-Key': rest_key,
        'Content-Type': 'application/json',
    }

    print('Enviando dados para o Back4App...')
    print(f'  Base URL: {B4A_BASE}')
    print(f'  Tamanho do lote: {BATCH_SIZE}')

    enviar_ano('escolas_2024.json', 2024, headers)
    enviar_ano('escolas_2025.json', 2025, headers)

    print('\nEnvio concluido com sucesso.')


if __name__ == '__main__':
    main()
