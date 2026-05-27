# AcessoEdu Nordeste

Plataforma de transparencia e auditoria cidada para infraestrutura escolar do Nordeste brasileiro.

## Missao

Transformar os microdados do Censo Escolar INEP em uma ferramenta visual, interativa e gratuita. Qualquer cidadao pode consultar a infraestrutura de uma escola publica, comparar a evolucao entre 2024 e 2025, e contribuir com avaliacoes e fotos verificadas presencialmente.

## Paradigma Comparativo

O diferencial do AcessoEdu e a **comparacao temporal por escola**. O usuario ve lado a lado o que a escola possuia em 2024 e o que possui em 2025. O **delta de infraestrutura** mostra exatamente quais indicadores melhoraram, pioraram ou permaneceram estaveis.

| Icone | Significado |
|-------|-------------|
| Check verde | A escola **possui** o indicador |
| X vermelho | A escola **nao possui** o indicador |
| Traco cinza "Sem Informacao" | Dado ausente no Censo INEP |

Zero **nao e** a mesma coisa que `null`. Zero significa ausencia confirmada pelo INEP. `null` significa que o dado nao foi informado.

## Funcionalidades

- **Dashboard** com KPIs, graficos de barras comparativos 2024/2025 e graficos de rosca
- **Lista de escolas** com filtros por Estado, Municipio e busca por nome
- **Perfil completo da escola** com checklist comparativo 2024 vs 2025, grafico radar (Chart.js) e feed de avaliacoes
- **Avaliacoes com verificacao local** — formula de Haversine confirma se o usuario esta a ate 500m da escola
- **Cascata de imagens** — Back4App (fotos comunitarias) -> placeholder
- **Ranking de Excelencia** com podio Top 3 e badges ouro/prata/bronze baseados em 7 indicadores
- **Busca por CEP** — preenche automaticamente os filtros de Estado e Municipio via ViaCEP
- **Busca por raio** — geocodificacao de CEP via BrasilAPI + `query.withinKilometers()` do Parse
- **Painel admin** com moderacao de fotos e denuncias, validado via `Parse.Role`

## Stack Tecnologica

### Bibliotecas / Front-end

| Tecnologia | Proposito |
|------------|-----------|
| **Chart.js** | Graficos interativos (barras, rosca, radar, linha) |
| **TailwindCSS** | Estilizacao utilitaria |
| **Phosphor Icons** | Iconografia |
| **Vanilla JS (ES6 Modules)** | Logica da aplicacao (Pub/Sub) |

### Back-end / Dados

| Tecnologia | Proposito |
|------------|-----------|
| **Back4App (BaaS)** | Banco de dados, autenticacao e storage |
| **Parse SDK** | Cliente JavaScript para o Back4App |
| **Python 3.10+** | Scripts de ETL (extracao de CSVs do INEP) |
| **Node.js** | Seeders e scripts de PATCH |

### APIs Externas

| API | Proposito | Custo |
|-----|-----------|-------|
| **BrasilAPI** | Geocodificacao de CEP (coordenadas geograficas) | Gratuito |
| **ViaCEP** | Busca de endereco por CEP | Gratuito |

## Arquitetura

```
src/js/
  core/
    estado.js          — Pub/Sub Event Bus (estado global centralizado)
    constantes.js      — Enumeracoes e configuracoes
    utilitarios.js     — Haversine, debounce, formatacao
    inicializador.js   — Bootstrap e auth UI global
  api/
    auth.api.js        — Login, logout, verificarAdmin() via Parse.Role
    escolas.api.js     — CRUD Escolas2024/2025, busca por raio, ranking
    feedback.api.js    — CRUD Avaliacoes + interacoes (like/flag)
    fotos.api.js       — Upload e listagem de SchoolPhoto
    viacep.api.js      — Consulta de endereco por CEP
  ui/
    dashboard.js       — KPIs, filtros, lista, busca geo
    escola.js          — Perfil completo da escola
    ranking.js         — Ranking de Excelencia
    analise.js         — Graficos Chart.js comparativos
    admin.js           — Moderacao (admin)
    config.js          — Login/registro/avatar
    modal.ui.js        — Alertas, confirmacoes e prompts

pipeline_dados/
  extrair_complementos.py — Le CSVs do INEP, extrai dependencia, numero e telefone
  patch_back4app.js       — Atualiza campos complementares no Back4App (PATCH)
  gerar_estaticos.js      — Gera estatisticas agregadas a partir dos JSONs
  enviar_estaticos.js     — Envia estatisticas para EstatisticasAgregadas
```

Fluxo de dados: `CSV INEP` -> `Python ETL` -> `JSON` -> `Node seeder` -> `Back4App` -> `SPA Frontend (Pub/Sub via estado.js)`

## Banco de Dados (Back4App)

### Tabelas por Ano

- **Escolas2024** — Dados do Censo Escolar 2024 (~74 mil registros no Nordeste)
- **Escolas2025** — Dados do Censo Escolar 2025 (~74 mil registros)

Cada registro contem 7 indicadores binarios + metadados:

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `id_escola` | String | Codigo INEP da escola |
| `nome` | String | Nome da escola |
| `cidade` | String | Municipio |
| `uf` | String | Sigla do estado |
| `internet` | Number | 1=Possui, 0=Nao possui |
| `laboratorio` | Number | Laboratorio de informatica |
| `quadra` | Number | Quadra de esportes |
| `rampa_acessibilidade` | Number | Acessibilidade (rampas) |
| `banheiro_pne` | Number | Banheiro acessivel PNE |
| `agua_potavel` | Number | Abastecimento de agua potavel |
| `energia_eletrica` | Number | Acesso a energia eletrica |
| `dependencia` | String | Federal/Estadual/Municipal/Privada |
| `telefone` | String | Telefone da escola |
| `numero` | String | Numero do endereco |
| `posicao_geografica` | GeoPoint | Coordenadas geograficas |

### Classes Auxiliares

- **EstatisticasAgregadas** — Medias percentuais por municipio, estado e regiao (2024/2025)
- **Avaliacoes** — Feedbacks de cidadaos com nota, comentario e verificacao local
- **SchoolPhoto** — Fotos enviadas pela comunidade (aprovacao via admin)

## Instalacao

### Pre-requisitos

- Node.js 18+
- Python 3.10+
- Conta no [Back4App](https://www.back4app.com/) com app criado

### 1. Clonar e configurar

```bash
git clone https://github.com/Richdssz/acessoedu-nordeste.git
cd acessoedu-nordeste
cp .env.exemplo .env
# Preencha BACK4APP_APP_ID e BACK4APP_REST_API_KEY no .env
```

### 2. Extrair dados do INEP (ETL)

Coloque os CSVs do Censo Escolar na raiz do projeto com `2024` e `2025` no nome do arquivo.

```bash
# Extrai complementos (dependencia, numero, telefone)
python pipeline_dados/extrair_complementos.py

# Aplica PATCH no Back4App (atualiza sem apagar dados existentes)
node pipeline_dados/patch_back4app.js
```

### 3. Servir o frontend

```bash
npx serve .
# Acesse http://localhost:3000
```

## Commits

Conventional Commits em Portugues Brasileiro:

```text
<tipo>(escopo): <descricao curta no imperativo>
```

Exemplos: `feat(dashboard): adicionar grafico de barras comparativo`, `fix(api): corrigir campos dos indicadores`, `docs(readme): atualizar arquitetura`

## Desenvolvedor

**Richard da Silva Souza**

- [github.com/Richdssz](https://github.com/Richdssz)

### Equipe

Projeto academico — **Sistemas para Internet, UNICAP**.

- Micael Barros
- Richard Silva
- Suedson Fernando

## Licenca

MIT.
