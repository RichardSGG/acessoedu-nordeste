# ARQUITETURA.md — Manual Técnico de Engenharia do AcessoEdu Nordeste

## 1. Princípio Filosófico da Arquitetura

O AcessoEdu Nordeste é construído sobre o princípio de **separação radical de
responsabilidades**. Nenhuma camada conhece os detalhes de implementação da outra.
Os serviços de API não conhecem o DOM. Os módulos de UI não conhecem o Parse Server.
O estado global é o único contrato compartilhado entre todas as camadas. Esta decisão
garante testabilidade, manutenibilidade e escalabilidade sem a necessidade de frameworks.

---

## 2. Estrutura de Diretórios

```
acesso-edu-nordeste/
│
├── index.html                  # Dashboard principal
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
│       │   ├── feedback.api.js # CRUD de avaliações e interações
│       │   ├── fotos.api.js    # Upload e listagem de fotos
│       │   ├── auth.api.js     # Autenticação Parse
│       │   ├── brasilapi.api.js # Integração CEP via BrasilAPI
│       │   └── mapillary.api.js # Integração Mapillary API
│       │
│       ├── core/               # Lógica central e infraestrutura do SPA
│       │   ├── estado.js       # Event Bus global (Pub/Sub)
│       │   ├── roteador.js     # SPA Router baseado em hash (#/rota)
│       │   ├── utilitarios.js  # debounce, throttle, formatadores
│       │   ├── constantes.js   # Enums, chaves de eventos, configs globais
│       │   └── inicializador.js # Bootstrap: verifica sessão, inicia listeners
│       │
│       └── ui/                 # Controladores de interface (uma UI por tela)
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
├── pipeline_dados/             # Scripts Python de ETL e geração de agregados
│   ├── extrair_complementos.py # Extrai dependência, número e telefone dos CSVs
│   ├── patch_back4app.js       # Atualiza dados complementares no Back4App (PATCH)
│   ├── gerar_estaticos.js      # Gera estatísticas agregadas locais
│   └── enviar_estaticos.js     # Envia estatísticas para o Back4App
│
├── seeder/                     # Script Node.js de carga no Back4App (Clean Slate)
│   ├── seed.mjs                # Upload de dados das escolas
│   └── modelo_avaliacao.js     # Geração de dados de avaliações fictícias
│
├── .env.exemplo                # Template de variáveis de ambiente
├── .gitignore
├── AI_CONTEXT.md
├── ARQUITETURA.md
└── PLAN.MD
```

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
┌──────────────────────┐
▼                      ▼
[ranking.ui.js]        [analise.ui.js]
(re-renderiza          (re-renderiza
lista/pódio)           gráficos)

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
| `mudanca:escolas`             | escolas.api.js      | ranking.ui.js                     |
| `mudanca:escolaSelecionada`   | dashboard.js        | escola.js                         |
| `mudanca:usuarioAtual`        | auth.api.js         | Todos os módulos de UI (permissão)|
| `mudanca:filtros`             | dashboard.js        | escolas.api.js (nova query)       |
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
}// Uso em dashboard.js
import { debounce } from '../core/utilitarios.js';const buscarComDebounce = debounce((termo) => {
escolas.api.buscarPorNome(termo);
}, 400);document.getElementById('input-busca').addEventListener('input', (e) => {
buscarComDebounce(e.target.value);
});

### 5.3 Throttle para Eventos de Alta Frequência

Eventos de scroll e resize devem ser interceptados por `throttle`:

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

O Chart.js é pesado. Ele não deve ser inicializado no carregamento
da página, mas apenas quando a `<div>` que o contém entra no viewport:

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
| Visualizar dashboard e dados     | Sim       | Sim                 | Sim   |
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

### 8.1 Coleções: Escolas2024 e Escolas2025

Representam os dados de infraestrutura escolar coletados no Censo INEP para os respectivos anos.

| Campo | Tipo | Descrição |
|---|---|---|
| `id_escola` | String | Código INEP único da escola (chave de negócio) |
| `nome` | String | Nome completo da instituição |
| `municipio` | String | Município de localização |
| `uf` | String | Sigla do estado (ex: PE, BA, CE) |
| `regiao` | String | Região (sempre 'Nordeste') |
| `cep` | String | CEP da escola |
| `internet` | Number | Indicador (1 = Possui, 0 = Não possui) |
| `laboratorio` | Number | Indicador de laboratório de informática (1/0) |
| `quadra` | Number | Indicador de quadra de esportes (1/0) |
| `rampa_acessibilidade`| Number | Indicador de rampa de acessibilidade (1/0) |
| `banheiro_pne` | Number | Indicador de banheiro acessível PNE (1/0) |
| `agua_potavel` | Number | Indicador de água potável (1/0) |
| `energia_eletrica` | Number | Indicador de energia elétrica (1/0) |
| `dependencia` | String | Tipo de administração (Federal, Estadual, Municipal ou Privada) |
| `telefone` | String | Contato telefônico da escola |
| `numero` | String | Número do logradouro |
| `posicao_geografica` | GeoPoint | Coordenadas do Parse para buscas espaciais |
| `foto_url` | String | URL em cache de imagem externa ou de fachada |
| `indicador_geral` | Number | Média de excelência de infraestrutura calculada no ETL |

### 8.2 Coleção: _User (Parse Built-in)

| Campo | Tipo | Descrição |
|---|---|---|
| `username` | String | E-mail do usuário (identificador único) |
| `email` | String | E-mail associado |
| `role` | String | `'admin'` \| `'user'` |
| `karmaPoints` | Number | Pontuação de engajamento do usuário |
| `profilePhoto` | File | Avatar de perfil do usuário |
| `nomeExibicao` | String | Nome para ser exibido nas avaliações |

### 8.3 Coleção: Avaliacoes

Armazena as avaliações feitas pela comunidade sobre a infraestrutura escolar.

| Campo | Tipo | Descrição |
|---|---|---|
| `id_escola` | String | Código INEP da escola avaliada |
| `nome` | String | Nome de exibição do autor |
| `nota` | Number | Avaliação de 1 a 5 |
| `mensagem` | String | Comentário escrito pelo cidadão |
| `flags_count` | Number | Contador de denúncias recebidas |
| `verificado_local` | Boolean | Sinaliza se foi enviado com geolocalização ativa |
| `latitude_envio` | Number | Latitude capturada no momento do envio |
| `longitude_envio` | Number | Longitude capturada no momento do envio |
| `respostas` | Array | Respostas adicionadas pela moderação (Admin) |

### 8.4 Coleção: AvaliacaoInteracao

| Campo | Tipo | Descrição |
|---|---|---|
| `review_id` | String | ID da avaliação associada |
| `usuario_id` | String | ID do usuário autor da ação |
| `tipo` | String | `'like'` \| `'flag'` (curtida ou denúncia) |

A unicidade do par `(review_id, usuario_id, tipo)` previne duplicidades.

### 8.5 Coleção: SchoolPhoto

| Campo | Tipo | Descrição |
|---|---|---|
| `id_escola` | String | Código INEP da escola associada |
| `arquivo` | File | Arquivo de imagem enviado |
| `status` | String | `'pending'` \| `'approved'` \| `'rejected'` |

### 8.6 Coleção: EstatisticasGeograficas

Estatísticas agregadas por município, estado e região a partir do Censo 2025.

| Campo | Tipo | Descrição |
|---|---|---|
| `nivel` | String | `'municipio'` \| `'estado'` \| `'regiao'` |
| `uf` | String | Sigla do estado correspondente |
| `municipio` | String | Nome do município correspondente |
| `total_escolas` | Number | Quantidade total de escolas |
| `internet` | Number | Percentual de escolas com internet |
| `biblioteca` | Number | Percentual de escolas com biblioteca |
| `lab_informatica` | Number | Percentual com laboratório de informática |
| `quadra_esportes` | Number | Percentual com quadra de esportes |
| `rampas` | Number | Percentual com rampas de acessibilidade |
| `banheiro_acessivel`| Number | Percentual com banheiro acessível |
| `agua_potavel` | Number | Percentual com água potável |

### 8.7 Coleção: EstatisticasAgregadas

Armazena os deltas temporais 2024 vs 2025 para exibição nos painéis e gráficos comparativos.

| Campo | Tipo | Descrição |
|---|---|---|
| `chave` | String | ID de busca da estatística (ex: `'Nordeste'`, `'PE'`, `'PE-Recife'`) |
| `nivel` | String | Nível geográfico ('regiao', 'estado', 'municipio') |
| `dados_2024` | Object | Dados de infraestrutura agregados de 2024 |
| `dados_2025` | Object | Dados de infraestrutura agregados de 2025 |

---

## 9. ETL Local — Pipeline de Dados

O processamento e a sanitização dos dados são realizados localmente utilizando Python e Node.js:

```
[CSV Censo INEP 2024] ──┐
[CSV Censo INEP 2025] ──┼─► Python (extrair_complementos.py)
                        │   Lê CSVs, extrai telefones, dependência, etc.
                        ▼
                 [JSONs Locais]
                        │
                        ▼
                 [Node.js Scripts]
         ├── patch_back4app.js   (Atualização dos metadados das escolas)
         ├── gerar_estaticos.js  (Calcula as médias agregadas temporais)
         └── enviar_estaticos.js (Carrega EstatisticasAgregadas/Geograficas no banco)
```

---

## 10. Seeder Node.js — Carga no Back4App

O seeder realiza a carga inicial (*Clean Slate*) no banco de dados a partir dos dados limpos, enviando em lotes de 100 registros para otimizar os requests.

```javascript
// seeder/seed.mjs (Estrutura lógica simplificada)
import Parse from 'parse/node.js';
import fs from 'fs';

// Configura SDK do Parse Server
Parse.initialize(APP_ID, JS_KEY, MASTER_KEY);
Parse.serverURL = 'https://parseapi.back4app.com';

async function rodarSeeder() {
  const dados = JSON.parse(fs.readFileSync('./seeder/escolas_limpo.json'));
  
  // Envio em blocos de 100
  const lotes = chunkArray(dados, 100);
  for (const lote of lotes) {
    const objetos = lote.map(escola => {
      const obj = new Parse.Object('Escolas2025');
      obj.set('id_escola', String(escola.id_escola));
      obj.set('nome', String(escola.nome));
      obj.set('municipio', String(escola.municipio));
      obj.set('uf', String(escola.uf));
      
      // Indicadores int
      obj.set('internet', parseInt(escola.internet));
      obj.set('banheiro_pne', parseInt(escola.banheiro_pne));
      // ...
      
      if (escola.latitude && escola.longitude) {
        obj.set('posicao_geografica', new Parse.GeoPoint(escola.latitude, escola.longitude));
      }
      return obj;
    });
    
    await Parse.Object.saveAll(objetos, { useMasterKey: true });
  }
}
```
