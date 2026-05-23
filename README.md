<h1 align="center">
  AcessoEdu
</h1>

<p align="center">
  <strong>Plataforma de auditoria cidadã sobre acessibilidade nas escolas públicas do Nordeste brasileiro.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black" alt="JavaScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/Leaflet-199900?style=flat-square&logo=leaflet&logoColor=white" alt="Leaflet" />
  <img src="https://img.shields.io/badge/Back4App-04365e?style=flat-square&logo=parse&logoColor=white" alt="Back4App" />
</p>

---

## O Problema

Mais de **74.000 escolas públicas** no Nordeste brasileiro possuem dados de acessibilidade registrados pelo INEP — rampas, banheiros adaptados, sinalização para deficientes visuais, entre outros. 
Esses dados existem em planilhas brutas, inacessíveis ao cidadão comum. 

A fiscalização real, no entanto, não pode viver apenas em dados oficiais: **ela precisa de vozes.**

## A Solução

O **AcessoEdu** transforma dados brutos do censo escolar em uma **rede social cívica**.
Qualquer pessoa pode consultar o índice de acessibilidade de uma escola, publicar uma avaliação, anexar fotos de evidências (como uma rampa quebrada), interagir com a comunidade e ser reconhecida como **Auditora Cidadã**. 

Dados oficiais encontram a realidade do chão de escola.

---

## Funcionalidades Principais

- **Fórum Comunitário por Escola:** Cada escola possui sua própria página com URL permanente e compartilhável via hash routing. A comunidade pode criar avaliações detalhadas, comentar, responder e registrar votos positivos.
- **Mapa Interativo (Gratuito):** A localização de cada escola é exibida em um mapa interativo renderizado com **Leaflet.js** e tiles do **OpenStreetMap** — solução 100% gratuita e open-source. As coordenadas das escolas são pré-calculadas no pipeline ETL e armazenadas no banco de dados, eliminando chamadas caras de Geocoding.
- **Autenticação e Identidade:** Sistema de cadastro e login via API de Users do Back4App. A sessão do usuário é mantida de forma segura.
- **Notificações em Tempo Real:** Alertas instantâneos via WebSocket (Live Queries do Back4App) quando alguém curte ou responde a uma avaliação do usuário. 
- **Gamificação Cívica:** Usuários acumulam badges conforme participam da plataforma:
  - *Auditor Cidadão:* Primeira avaliação publicada
  - *Especialista em Acessibilidade:* 10 avaliações com evidências
  - *Voz da Comunidade:* 50 votos positivos recebidos
- **Upload de Evidências:** Anexe fotos diretamente do dispositivo (armazenadas no sistema de arquivos do Back4App) para provar com imagens o que os dados confirmam.

---

## Arquitetura Técnica

```text
[INEP Microdados]
      |
      | Python / Pandas (ETL)
      | Limpeza, normalização, extração de 23 colunas
      | Geocoding via Nominatim (lat/lng calculados uma única vez)
      v
[CSV Tratado — 74.000 escolas com coordenadas]
      |
      | Node.js — Batch Upload Script
      | Upload em lotes via REST API
      v
[Back4App — BaaS / MongoDB]
      | REST API (CRUD de escolas, fórum, usuários, arquivos)
      | Live Queries (WebSocket para notificações)
      v
[SPA — Vanilla JS + HTML5 + Tailwind CSS + Chart.js + Leaflet.js]
      | Hash Router (navegação sem reload)
      | ES Modules (code splitting nativo)
      | Leaflet.js + OpenStreetMap (mapas gratuitos, sem chave de API)
```

### Camadas do Frontend

| Camada | Responsabilidade |
|---|---|
| **Router** | Mapeamento de hash URLs para controllers |
| **Services** | Toda comunicação com APIs externas (Back4App) |
| **Controllers** | Orquestração: busca dados e aciona a view |
| **Views** | Geração de HTML e inserção no DOM |
| **Components** | Elementos reutilizáveis (Navbar, ForumPost, Toast) |
| **AppState** | Estado global reativo via padrão Observer |

---

## Stack Completa

| Camada | Tecnologia | Custo |
|---|---|---|
| **ETL** | Python 3.10+, Pandas, Nominatim | Gratuito |
| **Ingestão** | Node.js (script batch) | Gratuito |
| **Backend / BaaS** | Back4App (Parse Server + MongoDB) | Gratuito |
| **Frontend** | Vanilla JS, HTML5, Tailwind CSS | Gratuito |
| **Gráficos** | Chart.js | Gratuito |
| **Mapas** | Leaflet.js + OpenStreetMap | Gratuito |
| **Hospedagem** | GitHub Pages / Netlify | Gratuito |
| **Total mensal** | | **R$ 0,00** |

---

## Como Rodar Localmente

### Pré-requisitos
- **Node.js 18+**
- **Python 3.10+**
- **Conta no Back4App** com uma aplicação criada

> **Nota:** Nenhuma chave de API de mapas é necessária! O projeto usa Leaflet.js com tiles do OpenStreetMap, que são completamente gratuitos.

### 1. Clonar o repositório
```bash
git clone https://github.com/seu-usuario/acessoedu.git
cd acessoedu
```

### 2. Configurar variáveis de ambiente
```bash
cp .env.example .env
```
Preencha o `.env` com as suas credenciais do Back4App:
```env
BACK4APP_APP_ID=seu_app_id
BACK4APP_API_KEY=sua_api_key
BACK4APP_MASTER_KEY=sua_master_key
```

### 3. Rodar o pipeline ETL (Processamento de Dados)
```bash
cd dados
python filtrar_base.py
```
> O script processará os dados brutos, fará o geocoding (se aplicável) e gerará o `escolas_pronto_b4app.csv`.

### 4. Upload das escolas para o banco
```bash
# Na raiz do projeto, execute o script passando as credenciais do .env
node --env-file=.env importar_b4app.js
```

### 5. Iniciar a aplicação
```bash
npx serve .
```
Acesse `http://localhost:3000` no navegador.

---

## Convenções de Commit

Este projeto adota **Conventional Commits em português** no seguinte formato:
```
<tipo>(escopo): <descrição no imperativo>
```

**Tipos Aceitos:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`

**Exemplos:**
- `feat(forum): adicionar sistema de likes em avaliacoes`
- `perf(maps): implementar carregamento lazy do Leaflet`
- `refactor(mapsService): migrar de Google Maps para Leaflet e OpenStreetMap`

---

## Equipe

Projeto acadêmico desenvolvido para o curso de **Sistemas para Internet** na **UNICAP** por:
- **Micael Barros**
- **Richard Silva**
- **Suedson Fernando**

---

## Licença

Este projeto está sob a licença [MIT](https://opensource.org/licenses/MIT).
