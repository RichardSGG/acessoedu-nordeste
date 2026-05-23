# 🏫 AcessoEdu

> 🌍 **AcessoEdu** é uma plataforma de auditoria cidadã sobre acessibilidade nas escolas públicas do Nordeste brasileiro. Nosso objetivo é transformar dados oficiais em ação social de forma transparente, moderna e gratuita.

<p align="center">
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black" alt="JavaScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/Leaflet-199900?style=flat-square&logo=leaflet&logoColor=white" alt="Leaflet" />
  <img src="https://img.shields.io/badge/Back4App-04365e?style=flat-square&logo=parse&logoColor=white" alt="Back4App" />
</p>

---

## 🔍 O Problema

Mais de **74.000 escolas públicas** no Nordeste possuem dados de acessibilidade registrados pelo INEP (rampas, banheiros adaptados, pisos táteis, etc.). Porém, esses dados residem em planilhas gigantescas e de difícil acesso ao cidadão. Além disso, a realidade física nem sempre bate com os dados oficiais.

## 💡 A Solução

O **AcessoEdu** converte microdados do censo escolar em uma **rede social cívica**. Qualquer pessoa pode consultar a acessibilidade de uma escola, entrar em contato, visualizar gráficos estatísticos e auditar as informações publicando avaliações com evidências reais (fotos).

---

## ✨ Funcionalidades Principais

*   💬 **Fórum de Avaliações por Escola:** Cada escola possui um mural para relatos da comunidade, comentários, respostas e curtidas.
*   📞 **Contato Direto:** Exibição do telefone (com link `tel:`) e e-mail oficiais da escola extraídos diretamente do INEP.
*   🗺️ **Mapa Interativo Gratuito:** Renderização da localização exata usando **Leaflet.js** e **OpenStreetMap** (100% livre de chaves pagas).
*   📍 **Escolas Próximas:** Listagem dinâmica das escolas mais próximas da região do usuário através de geolocalização por **GeoPoint** no Back4App.
*   📊 **Gráficos de Acessibilidade:** Visualização rápida do status da escola usando gráficos dinâmicos com **Chart.js**.
*   🏆 **Gamificação Cívica:** Conquista de selos (*badges*) conforme o usuário interage e audita as escolas (ex: *Auditor Cidadão*, *Voz da Comunidade*).
*   📸 **Upload de Evidências:** Envio de imagens reais das condições físicas das escolas armazenadas na nuvem.

---

## 🏗️ Arquitetura do Sistema

```text
[Microdados INEP (CSV bruto)]
       │
       │ Python / Pandas (ETL — dados/clean_inep.py)
       │ Filtros geográficos, contato e coordenadas tratadas
       ▼
[escolas_pronto_b4app_v2.csv]
       │
       │ Node.js (importar_b4app.js)
       │ Upload seguro em lotes (batch) com GeoPoints
       ▼
[Back4App (BaaS / MongoDB)]
       │ REST API + WebSockets (Live Queries)
       ▼
[SPA Frontend (Vanilla JS + HTML5 + CSS)]
       │ Hash Router (Navegação dinâmica)
       │ Componentes modulares reutilizáveis
       │ Mapas (Leaflet) & Gráficos (Chart.js)
```

---

## 🛠️ Stack Tecnológica

| Camada | Tecnologia | Licença / Custo |
| :--- | :--- | :--- |
| **Processamento (ETL)** | Python 3.10+, Pandas | Gratuito |
| **Banco de Dados / BaaS** | Back4App (Parse Server) | Gratuito (Plano Free) |
| **Frontend SPA** | Vanilla JS, HTML5, CSS | Gratuito |
| **Gráficos** | Chart.js | Gratuito |
| **Mapas** | Leaflet.js + OpenStreetMap | Gratuito (Sem chaves pagas) |
| **Hospedagem** | Vercel | Gratuito |

---

## 🚀 Como Executar Localmente

### Pré-requisitos
*   **Node.js 18+**
*   **Python 3.10+** (com gerenciador `py` no Windows)
*   **Conta no Back4App** com app configurado

### 1. Clonar o Repositório
```bash
git clone https://github.com/seu-usuario/acessoedu.git
cd acessoedu
```

### 2. Configurar Variáveis de Ambiente
Crie um arquivo `.env` na raiz do projeto:
```env
APP_ID=seu_application_id_do_back4app
MASTER_KEY=sua_master_key_do_back4app
```

### 3. Rodar o Pipeline de Extração (ETL)
```bash
cd dados
py clean_inep.py
```
> O script irá gerar o arquivo filtrado e pronto `escolas_pronto_b4app_v2.csv`.

### 4. Importar os Dados para o Back4App
Na raiz do projeto, envie os dados usando a flag nativa de variáveis de ambiente do Node:
```bash
node --env-file=.env importar_b4app.js
```

### 5. Iniciar a Aplicação Frontend
Você pode rodar a SPA usando qualquer servidor estático local:
```bash
npx serve .
```

---

## 🤝 Regras de Commits (Conventional Commits)

Adotamos a padronização de commits em **Português do Brasil (PT-BR)** seguindo a convenção:
```text
<tipo>(escopo): <descrição curta no imperativo>
```
*   `feat(contato): adicionar telefone e email na pagina da escola`
*   `fix(mapa): corrigir centralizacao de marcador do leaflet`
*   `docs(readme): atualizar escopo de funcionalidades no readme`

---

## 👥 Equipe

Projeto acadêmico desenvolvido para o curso de **Sistemas para Internet** na **UNICAP** por:
*   **Micael Barros**
*   **Richard Silva**
*   **Suedson Fernando**

---

## 📄 Licença

Este projeto é distribuído sob a licença **MIT**. Veja o arquivo `LICENSE` para mais detalhes.
