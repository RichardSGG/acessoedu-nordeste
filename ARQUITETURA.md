# ARQUITETURA.md — Manual Técnico de Engenharia do AcessoEdu Nordeste

## 1. Princípio Filosófico da Arquitetura

O AcessoEdu Nordeste é construído sobre o princípio de **separação radical de
responsabilidades**. Nenhuma camada conhece os detalhes de implementação da outra.
Os serviços de API não conhecem o DOM. Os módulos de UI não conhecem o Parse Server.
O estado global é o único contrato compartilhado entre todas as camadas. Esta decisão
garante testabilidade, manutenibilidade e escalabilidade sem a necessidade de frameworks.

---

## 2. Estrutura de Diretóriosacesso-edu-nordeste/
│
├── index.html                  # Dashboard principal com mapa
├── detalhes.html               # Perfil detalhado de escola
├── ranking.html                # Ranking de Excelência gamificado
├── analise.html                # Relatórios comparativos 2024 vs 2025
├── admin.html                  # Painel do gestor (moderação)
├── config.html                 # Configurações do usuário
├── termos.html                 # Termos de uso (OAuth Google)
├── privacidade.html            # Política de privacidade (OAuth Google)
│
├── src/
│   ├── css/
│   │   ├── variaveis.css       # Tokens de design: cores, fontes, breakpoints
│   │   ├── componentes.css     # Estilos reutilizáveis: cards, badges, botões
│   │   └── temas.css           # Variáveis para modo claro e modo escuro
│   │
│   └── js/
│       ├── api/                # Camada de acesso a dados (serviços externos)
│       │   ├── escolas.api.js  # CRUD de escolas no Back4App
│       │   ├── avaliacoes.api.js
│       │   ├── fotos.api.js
│       │   ├── notificacoes.api.js
│       │   ├── auth.api.js     # Autenticação Parse + Google OAuth
│       │   ├── viacep.api.js
│       │   ├── mapillary.api.js
│       │   └── nominatim.api.js
│       │
│       ├── core/               # Lógica central e infraestrutura do SPA
│       │   ├── estado.js       # Event Bus global (Pub/Sub)
│       │   ├── roteador.js     # SPA Router baseado em hash (#/rota)
│       │   ├── utilitarios.js  # debounce, throttle, formatadores
│       │   ├── constantes.js   # Enums, chaves de eventos, configs globais
│       │   └── inicializador.js # Bootstrap: verifica sessão, inicia listeners
│       │
│       └── ui/                 # Controladores de interface (uma UI por tela)
│           ├── mapa.ui.js      # Leaflet, marcadores, filtros geográficos
│           ├── ranking.ui.js   # Renderização do pódio e lista com Fragment
│           ├── detalhes.ui.js  # Carrossel, checklist, gráfico radar
│           ├── analise.ui.js   # Chart.js: barras, linhas, donut, exportação PDF
│           ├── admin.ui.js     # Tabelas de moderação, aprovação de fotos
│           ├── auth.ui.js      # Modal de login, fluxo Google OAuth
│           └── config.ui.js    # Avatar (Pica.js), karma, tema escuro
│
├── assets/
│   ├── imagens/
│   │   └── placeholder-escola.svg  # SVG local para fallback de imagem
│   └── fontes/                     # Fontes auto-hospedadas (opcional)
│
├── etl/                        # Pipeline Python (fora do bundle do front-end)
│   ├── processar_censos.py
│   ├── geocodificar.py
│   └── escolas_limpo.json      # Saída final do ETL (input do seeder)
│
├── seeder/                     # Script Node.js de carga no Back4App
│   ├── seed.js
│   └── package.json
│
├── .env.exemplo                # Template de variáveis de ambiente
├── .gitignore
├── AI_CONTEXT.md
├── ARQUITETURA.md
└── PLAN.MD

---

## 3. Fluxo de Dados Unidirecional

O sistema opera em **fluxo de mão única e sem exceções**:[Interação do Usuário]
│
▼
[Módulo UI] ── chama ──► [Módulo API]
│
(fetch ao Back4App
ou API externa)
│
▼
[estado.js] ◄── emite evento ── resposta processada
│
(emit 'escolasCarregadas')
│
┌──────────────────────┼──────────────────────┐
▼                      ▼                      ▼
[mapa.ui.js]         [ranking.ui.js]        [analise.ui.js]
(re-renderiza         (re-renderiza          (re-renderiza
marcadores)           lista/pódio)           gráficos)

**Regra inviolável:** Nenhum módulo de UI importa diretamente um módulo de API.
A comunicação entre UI e serviços ocorre **exclusivamente** através de eventos emitidos
e assinados no `estado.js`.

---

## 4. O Event Bus — estado.js

O arquivo `estado.js` é o núcleo da arquitetura. Ele implementa o padrão Observer
(Pub/Sub) e armazena o estado global da aplicação em um objeto único e protegido.

```javascript// src/js/core/estado.jsconst _estado = {
escolas: [],
escolaSelecionada: null,
usuarioAtual: null,
filtros: { estado: null, municipio: null, ano: 2025 },
modoEscuro: false,
carregando: false,
};const _ouvintes = {};const estado = {
obter(chave) {
return _estado[chave];
},definir(chave, valor) {
_estado[chave] = valor;
estado.emitir(mudanca:${chave}, valor);
},emitir(evento, dados) {
if (!_ouvintes[evento]) return;
_ouvintes[evento].forEach((cb) => cb(dados));
},assinar(evento, callback) {
if (!_ouvintes[evento]) _ouvintes[evento] = [];
_ouvintes[evento].push(callback);
// Retorna função de cancelamento (cleanup)
return () => {
_ouvintes[evento] = _ouvintes[evento].filter((cb) => cb !== callback);
};
},
};export default estado;

### Catálogo de Eventos do Sistema

| Evento                        | Emitido por         | Consumido por                     |
|-------------------------------|---------------------|-----------------------------------|
| `mudanca:escolas`             | escolas.api.js      | mapa.ui.js, ranking.ui.js         |
| `mudanca:escolaSelecionada`   | mapa.ui.js          | detalhes.ui.js                    |
| `mudanca:usuarioAtual`        | auth.api.js         | Todos os módulos de UI (permissão)|
| `mudanca:filtros`             | mapa.ui.js          | escolas.api.js (nova query)       |
| `mudanca:carregando`          | Qualquer serviço    | Componente de loading global      |
| `mudanca:modoEscuro`          | config.ui.js        | temas.css (via classe no `<html>`)|
| `notificacao:nova`            | notificacoes.api.js | Componente de toast global        |

---

## 5. Regras Críticas de Otimização do DOM

### 5.1 DocumentFragment para Renderizações Massivas

Toda função que renderize listas (ranking, feed de comentários, marcadores de mapa)
**deve** construir os elementos em memória com `DocumentFragment` e fazer um único
`appendChild` ao final:

```javascript// CORRETO — src/js/ui/ranking.ui.js
function renderizarListaRanking(escolas) {
const fragmento = document.createDocumentFragment();escolas.forEach((escola) => {
const item = document.createElement('li');
item.className = 'card-escola rounded-2xl shadow-md p-4';
item.textContent = escola.nomeEscola;
fragmento.appendChild(item);
});const listaEl = document.getElementById('lista-ranking');
listaEl.innerHTML = ''; // Limpa uma única vez, fora do laço
listaEl.appendChild(fragmento); // Uma única mutação de DOM
}// PROIBIDO — causa layout thrashing
escolas.forEach((escola) => {
document.getElementById('lista-ranking').innerHTML += <li>${escola.nomeEscola}</li>;
});

### 5.2 Debounce em Inputs de Busca

Toda escuta de evento `input` em campos de texto deve ser protegida por `debounce`
para evitar chamadas excessivas à API:

```javascript// src/js/core/utilitarios.js
export function debounce(funcao, espera = 400) {
let temporizador;
return function (...args) {
clearTimeout(temporizador);
temporizador = setTimeout(() => funcao.apply(this, args), espera);
};
}// Uso em mapa.ui.js
import { debounce } from '../core/utilitarios.js';const buscarComDebounce = debounce((termo) => {
escolas.api.buscarPorNome(termo);
}, 400);document.getElementById('input-busca').addEventListener('input', (e) => {
buscarComDebounce(e.target.value);
});

### 5.3 Throttle para Eventos de Alta Frequência

Eventos de scroll, resize e drag no mapa Leaflet devem ser interceptados por `throttle`:

```javascript// src/js/core/utilitarios.js
export function throttle(funcao, limite = 200) {
let ultimaExecucao = 0;
return function (...args) {
const agora = Date.now();
if (agora - ultimaExecucao >= limite) {
ultimaExecucao = agora;
funcao.apply(this, args);
}
};
}

### 5.4 Lazy Loading com IntersectionObserver

O Leaflet.js e o Chart.js são pesados. Eles não devem ser inicializados no carregamento
da página, mas apenas quando a `<div>` que os contém entra no viewport:

```javascript// src/js/core/inicializador.js
const observadorMapa = new IntersectionObserver(
(entradas) => {
if (entradas[0].isIntersecting) {
import('../ui/mapa.ui.js').then((modulo) => modulo.inicializar());
observadorMapa.disconnect(); // Inicializa uma única vez
}
},
{ threshold: 0.1 }
);observadorMapa.observe(document.getElementById('container-mapa'));

---

## 6. Sistema de Fallback de Imagens em Cascata

Quando a tela `detalhes.html` é carregada para uma escola específica, o sistema
executa a seguinte cascata de busca de imagem de fachada em sequência assíncrona:Etapa 1: Consultar Back4App
└─► Existem fotos com status = 'approved' para esta escola?
├─► SIM → Renderizar carrossel com as fotos aprovadas. FIM.
└─► NÃO → Ir para Etapa 2.Etapa 2: Consultar Mapillary API
└─► GET https://graph.mapillary.com/images
?fields=id,thumb_1024_url
&bbox={lng-d},{lat-d},{lng+d},{lat+d}
&limit=5
├─► Retornou imagens? → Exibir como "Imagens da Rua (Fonte: Mapillary)". FIM.
└─► Não retornou → Ir para Etapa 3.Etapa 3: Exibir Placeholder SVG Local
└─► Renderizar <img src="/assets/imagens/placeholder-escola.svg">
+ Botão CTA: "Seja o primeiro a enviar uma foto desta escola"
(Este botão abre o modal de upload, exigindo autenticação)

```javascript// src/js/ui/detalhes.ui.js
async function carregarImagemEscola(escola) {
// Etapa 1: Back4App
const fotosAprovadas = await fotos.api.listarAprovadas(escola.coInep);
if (fotosAprovadas.length > 0) {
renderizarCarrossel(fotosAprovadas);
return;
}// Etapa 2: Mapillary
try {
const imagensRua = await mapillary.api.buscarPorCoordenadas(
escola.latitude,
escola.longitude
);
if (imagensRua.length > 0) {
renderizarCarrossel(imagensRua, { fonte: 'Mapillary' });
return;
}
} catch (_erro) {
// Silencia e avança para o placeholder
}// Etapa 3: Placeholder
renderizarPlaceholder();
}

---

## 7. Segurança e Controle de Acesso

### 7.1 Regras de Acesso por Perfil

| Ação                             | Visitante | Usuário Autenticado | Admin |
|----------------------------------|-----------|---------------------|-------|
| Visualizar mapa e dados          | Sim       | Sim                 | Sim   |
| Enviar avaliação (estrelas)      | Não       | Sim                 | Sim   |
| Fazer denúncia                   | Não       | Sim                 | Sim   |
| Enviar foto de fachada           | Não       | Sim                 | Sim   |
| Aprovar/rejeitar fotos           | Não       | Não                 | Sim   |
| Moderar comentários denunciados  | Não       | Não                 | Sim   |
| Acessar admin.html               | Não       | Não                 | Sim   |

### 7.2 Verificação de Role no Front-end

A verificação de `role` no front-end é apenas para UX (ocultar botões e menus).
A segurança real é garantida pelas **ACLs (Access Control Lists) do Parse Server**
no Back4App, que rejeitam operações não autorizadas a nível de banco de dados.

```javascript// src/js/ui/admin.ui.js
import estado from '../core/estado.js';function protegerRotaAdmin() {
const usuario = estado.obter('usuarioAtual');
if (!usuario || usuario.get('role') !== 'admin') {
window.location.href = '/index.html';
}
}

---

## 8. Coleções do Banco de Dados (Back4App / MongoDB)

### 8.1 Coleção: School

| Campo                        | Tipo      | Descrição                                           |
|------------------------------|-----------|-----------------------------------------------------|
| `coInep`                     | String    | Código INEP único da escola (chave de negócio)      |
| `nomeEscola`                 | String    | Nome completo da instituição                        |
| `municipio`                  | String    | Município de localização                            |
| `uf`                         | String    | Sigla do estado (ex: PE, BA, CE)                    |
| `latitude`                   | Number    | Coordenada gerada no ETL via Nominatim              |
| `longitude`                  | Number    | Coordenada gerada no ETL via Nominatim              |
| `localizacao`                | GeoPoint  | Objeto GeoPoint do Parse para queries geoespaciais  |
| `ideb2023`                   | Number    | Nota IDEB mais recente disponível                   |
| `premiacao_obmep`            | Boolean   | Se a escola possui premiação OBMEP                  |
| `notaExcelencia`             | Number    | Nota 0-10 calculada no ETL (não recalculada no UI)  |
| `badge`                      | String    | 'ouro' \| 'prata' \| 'bronze' \| null               |
| `censo24_agua_potavel`       | Boolean   | Dado do Censo 2024                                  |
| `censo24_energia_eletrica`   | Boolean   | Dado do Censo 2024                                  |
| `censo24_esgoto`             | Boolean   | Dado do Censo 2024                                  |
| `censo24_internet`           | Boolean   | Dado do Censo 2024                                  |
| `censo24_acessibilidade_pcd` | Boolean   | Dado do Censo 2024                                  |
| `censo25_agua_potavel`       | Boolean   | Dado do Censo 2025                                  |
| `censo25_energia_eletrica`   | Boolean   | Dado do Censo 2025                                  |
| `censo25_esgoto`             | Boolean   | Dado do Censo 2025                                  |
| `censo25_internet`           | Boolean   | Dado do Censo 2025                                  |
| `censo25_acessibilidade_pcd` | Boolean   | Dado do Censo 2025                                  |
| `delta_infraestrutura`       | Number    | Diferença percentual de indicadores 25 vs 24        |
| `mediaAvaliacoes`            | Number    | Média das avaliações de 1-5 estrelas                |
| `totalAvaliacoes`            | Number    | Contagem de avaliações recebidas                    |

### 8.2 Coleção: _User (Parse Built-in)

| Campo           | Tipo   | Descrição                                         |
|-----------------|--------|---------------------------------------------------|
| `username`      | String | Identificador único (email normalmente)           |
| `email`         | String | E-mail do usuário                                 |
| `role`          | String | `'admin'` \| `'user'`                             |
| `karmaPoints`   | Number | Pontuação acumulada de colaborações               |
| `profilePhoto`  | File   | Avatar 256x256px processado pelo Pica.js          |
| `nomeExibicao`  | String | Nome público exibido nos comentários              |

### 8.3 Coleção: Review

| Campo            | Tipo      | Descrição                                        |
|------------------|-----------|--------------------------------------------------|
| `escola`         | Pointer   | Referência à coleção School                      |
| `autor`          | Pointer   | Referência à coleção _User                       |
| `nota`           | Number    | Avaliação de 1 a 5                               |
| `comentario`     | String    | Texto da avaliação (máx. 500 caracteres)         |
| `flags_count`    | Number    | Contador de denúncias recebidas                  |
| `verificado_local` | Boolean | Se o GPS confirmou a presença na escola         |
| `latitude_envio` | Number    | Capturada via navigator.geolocation              |
| `longitude_envio`| Number    | Capturada via navigator.geolocation              |

### 8.4 Coleção: ReviewInteraction

| Campo     | Tipo    | Descrição                                                    |
|-----------|---------|--------------------------------------------------------------|
| `review`  | Pointer | Referência à Review                                          |
| `usuario` | Pointer | Referência ao _User                                          |
| `tipo`    | String  | `'like'` \| `'flag'`                                         |

A unicidade do par `(review, usuario, tipo)` é garantida por índice único no MongoDB,
prevenindo duplicidade de likes e múltiplas denúncias pelo mesmo usuário.

### 8.5 Coleção: SchoolPhoto

| Campo      | Tipo    | Descrição                                                   |
|------------|---------|-------------------------------------------------------------|
| `escola`   | Pointer | Referência à School                                         |
| `autor`    | Pointer | Referência ao _User                                         |
| `arquivo`  | File    | Imagem armazenada no File Storage do Back4App               |
| `status`   | String  | `'pending'` \| `'approved'` \| `'rejected'`                 |

### 8.6 Coleção: Notification

| Campo       | Tipo    | Descrição                                                  |
|-------------|---------|------------------------------------------------------------|
| `usuario`   | Pointer | Destinatário da notificação                                |
| `tipo`      | String  | `'karma'` \| `'foto_aprovada'` \| `'denuncia_validada'`    |
| `mensagem`  | String  | Texto da notificação                                       |
| `lida`      | Boolean | Se o usuário já visualizou                                 |

As notificações são entregues em tempo real via **Live Queries (WebSocket)** do
Parse Server, sem necessidade de polling.

---

## 9. ETL Local — Pipeline Python[INEP Censo 2024 .csv]  ─┐
[INEP Censo 2025 .csv]  ─┼─► processar_censos.py
[IDEB .xlsx]            ─┤       │
[OBMEP .csv]            ─┘       │
▼
Merge por CO_ENTIDADE (coInep)
Remoção de ~500 colunas irrelevantes
Filtragem: uf IN ['AL','BA','CE','MA',
'PB','PE','PI','RN','SE']
Cálculo de delta_infraestrutura
Cálculo de notaExcelencia
Definição de badge
│
▼
geocodificar.py
Nominatim API (OSM) — batch único
Grava latitude e longitude por escola
│
▼
escolas_limpo.json
(input do seeder)

---

## 10. Seeder Node.js — Carga no Back4App

```javascript// seeder/seed.js (pseudocódigo estrutural)
import Parse from 'parse/node.js';
import dados from './escolas_limpo.json' assert { type: 'json' };Parse.initialize(APP_ID, JS_KEY, MASTER_KEY);
Parse.serverURL = 'https://parseapi.back4app.com';async function executarSeed() {
// 1. Limpar a coleção existente
const query = new Parse.Query('School');
const existentes = await query.find({ useMasterKey: true });
await Parse.Object.destroyAll(existentes, { useMasterKey: true });// 2. Inserir em lotes de 100 objetos (limite da API)
const lotes = chunk(dados, 100);
for (const lote of lotes) {
const objetos = lote.map((escola) => {
const obj = new Parse.Object('School');
obj.set('coInep', escola.CO_ENTIDADE);
obj.set('nomeEscola', escola.NO_ENTIDADE);
// ... demais campos
const ponto = new Parse.GeoPoint(escola.latitude, escola.longitude);
obj.set('localizacao', ponto);
return obj;
});
await Parse.Object.saveAll(objetos, { useMasterKey: true });
console.log(Lote inserido: ${lotes.indexOf(lote) + 1}/${lotes.length});
}
}
