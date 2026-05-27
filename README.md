# AcessoEdu Nordeste 🌵

Plataforma de transparência e auditoria cidadã para infraestrutura escolar do Nordeste brasileiro. ☀️

## Missão 📚

Transformar os microdados do Censo Escolar INEP em uma ferramenta visual, interativa e gratuita. Qualquer cidadão pode consultar a infraestrutura de uma escola pública, comparar a evolução entre 2024 e 2025, e contribuir com avaliações e fotos verificadas presencialmente.

## Paradigma Comparativo 🏖️

O diferencial do AcessoEdu é a **comparação temporal por escola**. O usuário vê lado a lado o que a escola possuía em 2024 e o que possui em 2025. O **delta de infraestrutura** mostra exatamente quais indicadores melhoraram, pioraram ou permaneceram estáveis.

| Ícone | Significado |
|-------|-------------|
| Check verde | A escola **possui** o indicador |
| X vermelho | A escola **não possui** o indicador |
| Traço cinza "Sem Informação" | Dado ausente no Censo INEP |

Zero **não é** a mesma coisa que `null`. Zero significa ausência confirmada pelo INEP. `null` significa que o dado não foi informado.

## Funcionalidades 🌴

- **Dashboard** com KPIs, gráficos de barras comparativos 2024/2025 e gráficos de rosca
- **Lista de escolas** com filtros por Estado, Município e busca por nome
- **Perfil completo da escola** com checklist comparativo 2024 vs 2025, gráfico radar (Chart.js) e feed de avaliações
- **Avaliações com verificação local** — fórmula de Haversine confirma se o usuário está a até 500m da escola
- **Cascata de imagens** — Back4App (fotos comunitárias) -> placeholder
- **Ranking de Excelência** com pódio Top 3 e badges ouro/prata/bronze baseados em 7 indicadores
- **Busca por CEP** — consulta BrasilAPI v1 para obter o município e filtra escolas por cidade no banco
- **Painel admin** com moderação de fotos e denúncias, validado via `Parse.Role`

## Arquitetura e Fluxo de Dados (CRUD)

O sistema implementa as quatro operações fundamentais de persistência distribuídas entre o front-end Vanilla JS e o Back4App (Parse Server):

### Create
- **Cadastro de usuários**: Registro com email/senha via `Parse.User.signUp()` e role padrão `usuario`.
- **Envio de fotos**: Upload de imagens para a classe `SchoolPhoto` via `Parse.File`, associadas ao `id_escola`. Fotos entram com status pendente de aprovação.
- **Envio de denúncias**: Usuários logados podem denunciar avaliações impróprias, registradas na classe `Avaliacoes` com contador de flags.

### Read
- **Dados consolidados do dashboard**: KPIs e gráficos consomem a classe `EstatisticasAgregadas`, que armazena percentuais pré-calculados por município, estado e região — evitando consultas pesadas em tempo real sobre ~74 mil registros.
- **Busca por CEP**: O campo de CEP na barra de filtros consulta a BrasilAPI v1 para obter o nome do município e em seguida realiza uma busca por cidade (`equalTo('cidade', ...)`) sobre a classe `Escolas2025`, retornando todas as escolas do município.
- **Listagem com filtros**: Consultas paginadas com `Parse.Query` aplicando filtros de UF, município e busca textual por nome.

### Update
- **Moderação de imagens**: O painel Admin lista fotos pendentes (`aprovada === false`) e permite aprovar ou rejeitar, atualizando o campo `aprovada` no registro.
- **Cache de foto_url**: Ao carregar imagens externas (Mapillary), a URL da primeira foto é salva no campo `foto_url` do registro da escola para consultas futuras.

### Delete
- **Remoção de imagens**: O Admin pode excluir permanentemente registros de `SchoolPhoto` via `Parse.Object.destroy()`, removendo tanto o registro no banco quanto o arquivo no storage.
- **Exclusão de avaliações**: Usuários podem excluir as próprias avaliações; administradores podem excluir qualquer avaliação.

## Stack Tecnológica

### Front-end: Vanilla JS (ES6) + TailwindCSS

| Tecnologia | Propósito |
|------------|-----------|
| **Chart.js** | Gráficos interativos (barras, rosca, radar, linha) |
| **TailwindCSS** | Estilização utilitária |
| **Phosphor Icons** | Iconografia |
| **Vanilla JS (ES6 Modules)** | Lógica da aplicação (Pub/Sub) |

### Extração de Dados: Scripts em Python (Pandas)

| Tecnologia | Propósito |
|------------|-----------|
| **Back4App (BaaS)** | Banco de dados, autenticação e storage |
| **Parse SDK** | Cliente JavaScript para o Back4App |
| **Python 3.10+** | Scripts de ETL (extração de CSVs do INEP) |
| **Node.js** | Seeders e scripts de PATCH |

### APIs Externas

| API | Propósito | Custo |
|-----|-----------|-------|
| **BrasilAPI** | Consulta de endereço e município via CEP — converte CEPs em filtros de busca por município no banco de dados | Gratuito |
| **ViaCEP** | Busca de endereço por CEP (fallback na página de detalhes da escola) | Gratuito |

Integração de API: O sistema consome a BrasilAPI V1 para geocodificação reversa de municípios (CEP -> Município), utilizando normalização de strings (UTF-8/NFD) para garantir a consistência entre dados de terceiros e a base local do Censo Escolar.

## Arquitetura

```
src/js/
  core/
    estado.js          — Pub/Sub Event Bus (estado global centralizado)
    constantes.js      — Enumerações e configurações
    utilitarios.js     — Haversine, debounce, formatação
    inicializador.js   — Bootstrap e auth UI global
  api/
    auth.api.js        — Login, logout, verificarAdmin() via Parse.Role
    escolas.api.js     — CRUD Escolas2024/2025, busca por raio, ranking
    feedback.api.js    — CRUD Avaliações + interações (like/flag)
    fotos.api.js       — Upload e listagem de SchoolPhoto
  ui/
    dashboard.js       — KPIs, filtros, lista, busca geo
    escola.js          — Perfil completo da escola
    ranking.js         — Ranking de Excelência
    analise.js         — Gráficos Chart.js comparativos
    admin.js           — Moderação (admin)
    config.js          — Login/registro/avatar
    modal.ui.js        — Alertas, confirmações e prompts

pipeline_dados/
  extrair_complementos.py — Lê CSVs do INEP, extrai dependência, número e telefone
  patch_back4app.js       — Atualiza campos complementares no Back4App (PATCH)
  gerar_estaticos.js      — Gera estatísticas agregadas a partir dos JSONs
  enviar_estaticos.js     — Envia estatísticas para EstatisticasAgregadas
```

Fluxo de dados: `CSV INEP` -> `Python ETL` -> `JSON` -> `Node seeder` -> `Back4App` -> `SPA Frontend (Pub/Sub via estado.js)`

## Banco de Dados (Back4App)

### Tabelas por Ano

- **Escolas2024** — Dados do Censo Escolar 2024 (~74 mil registros no Nordeste)
- **Escolas2025** — Dados do Censo Escolar 2025 (~74 mil registros)

Cada registro contém 7 indicadores binários + metadados:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id_escola` | String | Código INEP da escola |
| `nome` | String | Nome da escola |
| `cidade` | String | Município |
| `uf` | String | Sigla do estado |
| `internet` | Number | 1=Possui, 0=Não possui |
| `laboratorio` | Number | Laboratório de informática |
| `quadra` | Number | Quadra de esportes |
| `rampa_acessibilidade` | Number | Acessibilidade (rampas) |
| `banheiro_pne` | Number | Banheiro acessível PNE |
| `agua_potavel` | Number | Abastecimento de água potável |
| `energia_eletrica` | Number | Acesso à energia elétrica |
| `dependencia` | String | Federal/Estadual/Municipal/Privada |
| `telefone` | String | Telefone da escola |
| `numero` | String | Número do endereço |
| `posicao_geografica` | GeoPoint | Coordenadas geográficas |

### Classes Auxiliares

- **EstatisticasAgregadas** — Médias percentuais por município, estado e região (2024/2025)
- **Avaliacoes** — Feedbacks de cidadãos com nota, comentário e verificação local
- **SchoolPhoto** — Fotos enviadas pela comunidade (aprovação via admin)

## Instalação

### Pré-requisitos

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
# Extrai complementos (dependência, número, telefone)
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

Conventional Commits em Português Brasileiro:

```text
<tipo>(escopo): <descrição curta no imperativo>
```

Exemplos: `feat(dashboard): adicionar gráfico de barras comparativo`, `fix(api): corrigir campos dos indicadores`, `docs(readme): atualizar arquitetura`

## Desenvolvedor

**Richard da Silva Souza**

- [github.com/Richdssz](https://github.com/Richdssz)

### Equipe

Projeto acadêmico — **Sistemas para Internet, UNICAP**.

- Micael Barros
- Richard da Silva Souza
- Suedson Fernando

## Licença

MIT.
