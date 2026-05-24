import json

print("Analisando as coordenadas no arquivo escolas_limpo.json...")

with open('dados/escolas_limpo.json', 'r', encoding='utf-8') as f:
    dados = json.load(f)

total = len(dados)
validos = 0
com_virgula = 0
vazios_ou_nulos = 0
hashtags = 0
outros = 0
exemplos_outros = []

for escola in dados:
    lat = str(escola.get('latitude', '')).strip()
    
    if not lat or lat.lower() in ['null', 'none', 'nan']:
        vazios_ou_nulos += 1
    elif '#' in lat:
        hashtags += 1
    elif ',' in lat:
        com_virgula += 1
    else:
        try:
            float(lat)
            validos += 1
        except ValueError:
            outros += 1
            if len(exemplos_outros) < 3:
                exemplos_outros.append(lat)

print("\n=== RELATORIO DE ANALISE DE COORDENADAS ===")
print(f"Total de Escolas no JSON: {total}")
print(f"Validos (Numero com ponto): {validos}")
print(f"Com Virgula (Pode ser corrigido): {com_virgula}")
print(f"Vazios ou Nulos (Sem solucao facil): {vazios_ou_nulos}")
print(f"Corrompidos com '#' (Erro do INEP): {hashtags}")
print(f"Outros erros de formatacao: {outros}")

if outros > 0:
    print(f"Exemplos de outros erros: {exemplos_outros}")
