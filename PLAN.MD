# PLAN.MD — Bíblia Técnica do Projeto AcessoEdu Nordeste

**Versão:** 1.0.0
**Instituição:** Universidade Católica de Pernambuco — UNICAP
**Disciplina:** Desenvolvimento Web
**Atividade:** A07 — Projeto Final
**Docente:** Professor Gabriel
**Idioma Oficial:** Português do Brasil (PT-BR)

---

## 1. Visão Geral do Sistema

### 1.1 Conceito e Missão

O AcessoEdu Nordeste é uma Single Page Application (SPA) de auditoria cidadã e
inteligência educacional que mapeia, contrasta e expõe de forma pública e transparente
os indicadores de infraestrutura e acessibilidade para pessoas com deficiência (PCD)
das escolas da região Nordeste do Brasil. O sistema opera exclusivamente sobre dados
reais e abertos do Censo Escolar do Instituto Nacional de Estudos e Pesquisas
Educacionais Anísio Teixeira (INEP) dos anos de 2024 e 2025, com foco absoluto na
evolução da infraestrutura física e digital das escolas entre estes dois anos.

O produto tem caráter acadêmico e cívico simultâneos. Academicamente, demonstra o
domínio de tecnologias modernas de desenvolvimento web sem o uso de frameworks
JavaScript. Civicamente, oferece a cidadãos, jornalistas, pesquisadores e gestores
públicos uma ferramenta acessível para fiscalizar a evolução das condições físicas das
escolas e exigir responsabilidade das administrações públicas.

### 1.2 O Paradigma Comparativo 2024 vs 2025

O princípio arquitetural central da plataforma é a **contraposição visual e explícita**
entre os dados do Censo Escolar de 2024 e os dados do Censo Escolar de 2025 para a
mesma escola, na mesma tela. Esta abordagem responde diretamente à pergunta que move a
plataforma: "Esta escola está melhorando ou piorando?"

A comparação se manifesta de três formas no produto:

**Forma 1 — Dashboard (index.html):** Os quatro cartões de KPI exibem os totais
agregados para o Nordeste inteiro com a variação percentual em relação ao ano anterior,
colorida em verde (melhora) ou vermelho (piora).

**Forma 2 — Perfil da Escola (detalhes.html):** O checklist de infraestrutura exibe
cada item (água potável, energia elétrica, esgoto, internet, acessibilidade PCD) com
dois indicadores visuais lado a lado: o estado em 2024 (ícone e cor cinza = ausente,
verde = presente) e o estado em 2025, permitindo identificar a evolução ou retrocesso
item a item.

**Forma 3 — Análise (analise.html):** O gráfico de barras agrupadas do Chart.js exibe
duas barras por categoria de infraestrutura: uma representando a porcentagem de escolas
que possuíam o item em 2024 e outra representando a porcentagem em 2025.

O campo `delta_infraestrutura` é calculado no ETL e persistido no banco como um número
decimal que representa a variação percentual positiva ou negativa entre os dois anos.
O front-end **consome este valor diretamente** sem recalculá-lo.

### 1.3 Restrição Estrita de Interface — Proibição Total de Emojis

É terminantemente proibido o uso de qualquer caractere emoji no código-fonte desta
aplicação. Esta restrição é absoluta e se aplica a:

- Arquivos HTML (atributos, textos, placeholders, titles)
- Arquivos JavaScript (strings, comentários, console.log)
- Arquivos CSS (content de pseudo-elementos)
- Mensagens de toast e alertas do sistema
- Textos de botões, modais e formulários

A justificativa técnica é dupla: (a) emojis possuem renderização inconsistente entre
sistemas operacionais e navegadores, comprometendo a identidade visual; (b) a plataforma
visa acessibilidade máxima, e emojis mal etiquetados degradam a experiência com leitores
de tela.

Toda representação visual de estado, categoria ou ação deve ser realizada exclusivamente
por meio da **biblioteca Phosphor Icons**, que oferece mais de 6.000 ícones SVG vetoriais
com semântica clara e suporte a `aria-label`.

---

## 2. Arquitetura de Software

### 2.1 Fundamentos da Escolha Arquitetural

A decisão de construir uma SPA em **Vanilla JS puro** (sem React, Vue, Angular ou
similares) é uma restrição acadêmica deliberada que demonstra a compreensão profunda
dos mecanismos nativos do navegador. Para garantir a mesma performance e manutenibilidade
que um framework ofereceria, a arquitetura adota três pilares:

1. **Modularidade via ES6 Modules nativos:** Cada arquivo é um módulo isolado com
   escopo próprio, importado explicitamente onde necessário.
2. **Gestão de Estado Centralizada via Pub/Sub:** Um Event Bus único (`estado.js`)
   é o único ponto de verdade sobre o estado global da aplicação.
3. **Otimização Agressiva do DOM:** Regras rígidas de manipulação do DOM garantem
   60 FPS mesmo com listas de centenas de escolas.

### 2.2 Modularidade e Separação de Camadas (ES6 Modules)

A estrutura de diretórios reflete a separação estrita de responsabilidades:

**Camada `/src/js/api/` — Serviços de Dados:**
Esta camada é a única que conhece o Back4App, o Mapillary e o Nominatim.
Ela é responsável por fazer requisições HTTP/WebSocket, tratar erros de rede,
normalizar a resposta para o formato interno da aplicação e chamar `estado.definir()`
para publicar os dados recebidos. Esta camada **não conhece o DOM** e jamais
manipula elementos HTML diretamente.

**Camada `/src/js/core/` — Infraestrutura da Aplicação:**
Esta camada contém o Event Bus (`estado.js`), o roteador SPA (`roteador.js`), as
funções utilitárias agnósticas de domínio (`utilitarios.js`), as constantes globais
(`constantes.js`) e o script de inicialização (`inicializador.js`). Esta camada
não conhece nem o DOM de forma específica nem o Back4App.

**Camada `/src/js/ui/` — Controladores de Interface:**
Esta camada é a única que toca o DOM. Cada arquivo de UI é responsável por uma tela
ou componente. Os módulos de UI **assinam eventos do `estado.js`** e reagem a eles
renderizando a interface. Eles nunca chamam diretamente módulos da camada `/api/`.

### 2.3 Gestão de Estado Global — O Padrão Pub/Sub com estado.js

O arquivo `src/js/core/estado.js` implementa o padrão Observer (também chamado de
Publisher/Subscriber ou Event Bus). Ele é o contrato compartilhado entre todas as
camadas da aplicação.

**Funcionamento detalhado:**

Quando um usuário aplica um filtro geográfico na interface (por exemplo, seleciona
o estado "Pernambuco"), o seguinte fluxo ocorre:

1. `mapa.ui.js` detecta a mudança no `<select>` e chama
   `estado.definir('filtros', { uf: 'PE' })`.
2. `estado.js` atualiza o valor interno e emite o evento `mudanca:filtros`.
3. `escolas.api.js`, que assinou `mudanca:filtros` via `estado.assinar()`, recebe
   os novos filtros, monta a query no Parse Server e faz o fetch.
4. Ao receber a resposta, `escolas.api.js` chama `estado.definir('escolas', resultado)`.
5. `estado.js` emite `mudanca:escolas`.
6. `mapa.ui.js` e `ranking.ui.js`, que assinaram `mudanca:escolas`, recebem a lista
   atualizada e re-renderizam seus componentes respectivos de forma independente.

Este fluxo garante que nenhuma UI precise conhecer outra UI, e nenhuma UI precise
conhecer a API. O desacoplamento é total.

### 2.4 Otimização Crítica do DOM — As Três Regras Invioláveis

#### Regra 1 — DocumentFragment para Renderizações em Lote

Toda função que precise inserir múltiplos elementos no DOM como resultado de uma
iteração (listas de escolas, feed de comentários, marcadores de mapa) deve construir
todos os elementos em memória dentro de um `document.createDocumentFragment()` e
executar uma única operação de `appendChild()` no elemento pai real ao final.

Este padrão elimina completamente o fenômeno de "layout thrashing", que ocorre quando
o navegador é forçado a recalcular o layout da página a cada inserção individual,
resultando em queda de FPS e travamentos perceptíveis ao usuário.

#### Regra 2 — Debounce em Inputs de Texto

Qualquer campo de texto cujo evento `input` dispare operações custosas (chamadas à API,
queries no banco, operações de filtro) deve ter sua função handler protegida por
`debounce` com janela de no mínimo 400 milissegundos. A função `debounce` é definida
em `utilitarios.js` e exportada para uso em todos os módulos de UI.

#### Regra 3 — Throttle em Eventos de Alta Frequência

Eventos que disparam dezenas ou centenas de vezes por segundo — como `scroll`, `resize`,
`mousemove` e os eventos de movimentação de câmera do Leaflet (`moveend`, `zoomend`) —
devem ser protegidos por `throttle` com limite de no mínimo 200 milissegundos.

### 2.5 Lazy Loading com IntersectionObserver

As bibliotecas Leaflet.js (mapa) e Chart.js (gráficos) totalizam aproximadamente
250KB de JavaScript. Elas não devem ser carregadas ou inicializadas até que o
container que as hospeda entre no viewport do usuário.

A técnica de Lazy Loading é implementada via `IntersectionObserver` nativo do
navegador. Quando o observador detecta que o container cruzou o limiar de 10% de
visibilidade, o módulo correspondente é importado dinamicamente via `import()` e
inicializado. O observador é então desconectado para evitar execuções repetidas.

---

## 3. Pipeline de Dados e Back-end

### 3.1 Princípio de Dados Pré-Calculados

Para garantir que o front-end jamais precise executar joins, agregações ou cálculos
pesados em tempo de execução, todo o processamento de dados complexo ocorre uma única
vez no ambiente local do desenvolvedor, antes do deploy. O resultado é um arquivo JSON
plano (`escolas_limpo.json`) onde cada linha representa uma escola com todos os seus
atributos já calculados e prontos para consumo.

### 3.2 ETL Local — Python + Pandas

O pipeline de Extração, Transformação e Carga (ETL) é executado localmente e consiste
em dois scripts Python:

**`etl/processar_censos.py` — Etapa de Higienização e Fusão:**

Os microdados brutos do INEP para o Censo Escolar chegam em arquivos CSV com mais de
700 colunas cada. O script executa as seguintes operações na ordem apresentada:

1. Carrega os CSVs de 2024 e 2025 com Pandas, especificando dtype `str` para
   evitar inferência incorreta de tipos.
2. Filtra as linhas mantendo apenas as escolas cujo campo `CO_UF` pertence ao conjunto
   dos 9 estados do Nordeste: AL, BA, CE, MA, PB, PE, PI, RN, SE.
3. Seleciona apenas as colunas relevantes para o produto (aproximadamente 30 de 700).
4. Realiza o merge dos dois DataFrames usando `CO_ENTIDADE` (código INEP da escola)
   como chave de junção. Escolas presentes apenas em um dos anos recebem os campos
   do outro ano preenchidos com `NaN`, depois convertidos para `null`.
5. Calcula o campo `delta_infraestrutura`: a diferença entre a soma dos indicadores
   binários de 2025 e a soma dos indicadores binários de 2024, dividida pelo número
   total de indicadores, resultando em um percentual decimal.
6. Calcula o campo `notaExcelencia` conforme a fórmula do Ranking de Excelência.
7. Determina o campo `badge` com base nos intervalos de `notaExcelencia`.
8. Exporta o resultado como `escolas_bruto.json` (input do geocoder).

**`etl/geocodificar.py` — Etapa de Geocoding Offline:**

Este script lê o `escolas_bruto.json` e, para cada escola que ainda não possui
coordenadas válidas, monta um endereço textual no formato
`"{NO_ENTIDADE}, {NO_MUNICIPIO}, {SG_UF}, Brasil"` e faz uma requisição GET à API
pública do Nominatim (OpenStreetMap) no endpoint
`https://nominatim.openstreetmap.org/search?q=...&format=json&limit=1`.

Por respeito às diretrizes de uso do Nominatim, o script insere um `time.sleep(1.1)`
entre cada requisição. Para um conjunto de 100.000 escolas, esta etapa pode levar
várias horas e é executada **uma única vez**, com o resultado cacheado localmente.

As coordenadas retornadas são gravadas nos campos `latitude` e `longitude` do objeto.
O resultado final é exportado como `escolas_limpo.json`.

**Resultado em Produção:** Como as coordenadas já estão no JSON antes do seeding,
o front-end **nunca faz chamadas ao Nominatim para geocoding em runtime**. O custo
de geocoding em produção é literalmente R$ 0,00.

### 3.3 Seeder Node.js — Carga no Back4App

O script `seeder/seed.js` é executado manualmente pelo desenvolvedor sempre que os
dados do ETL são atualizados. Ele realiza as seguintes operações:

1. Inicializa o SDK do Parse com as credenciais do `.env`.
2. Executa uma query para recuperar todos os objetos existentes na coleção `School`
   usando `useMasterKey: true`.
3. Destrói todos os objetos existentes em lote com `Parse.Object.destroyAll()`.
4. Divide o array `escolas_limpo.json` em lotes de 100 objetos (limite máximo da
   API do Back4App para operações em lote).
5. Para cada lote, cria um array de `Parse.Object` instâncias, mapeia todos os campos,
   cria o objeto `Parse.GeoPoint` com `latitude` e `longitude` e chama
   `Parse.Object.saveAll()`.
6. Registra no console o progresso de cada lote processado.

### 3.4 Back4App como BaaS — Responsabilidades

O Back4App (que executa o Parse Server sobre MongoDB) é responsável por:

- **Autenticação:** Login com usuário/senha nativo do Parse e integração com Google
  OAuth via `Parse.User.logInWith('google', ...)`.
- **Controle de Acesso (ACLs):** Cada objeto tem uma `Parse.ACL` que define quem pode
  ler e escrever. Objetos `School` têm leitura pública e escrita restrita ao Master Key.
  Objetos `Review` têm leitura pública e escrita apenas pelo autor.
- **Armazenamento de Arquivos:** Fotos enviadas pelos usuários são armazenadas no
  File Storage do Back4App e referenciadas como `Parse.File` nos objetos `SchoolPhoto`.
- **Live Queries (WebSocket):** A coleção `Notification` é observada em tempo real
  via `Parse.LiveQuery`, permitindo que notificações de karma e aprovação de fotos
  cheguem instantaneamente ao usuário logado sem necessidade de polling.

---

## 4. Mapeamento de Telas e Comportamentos

### 4.1 index.html — Dashboard Principal com Mapa

**Propósito:** Ponto de entrada da aplicação. Oferece uma visão macro dos dados do
Nordeste com mapa interativo, filtros geográficos e cartões de KPI.

**Layout e Componentes:**

O `<header>` é um elemento fixo no topo da viewport com `position: sticky; top: 0`.
Ele possui `backdrop-filter: blur(12px)` e fundo semi-transparente para criar o efeito
de profundidade ao rolar a página. O logo textual "AcessoEdu Nordeste" é renderizado
em Poppins Bold na cor primária `#1A5691`. À direita do header, uma navegação
horizontal com links para as demais telas e um botão "Entrar" que dispara o modal
de autenticação. Quando o usuário está logado, o botão é substituído pelo avatar
circular (rounded-full) do usuário e seu nome de exibição.

Abaixo do header, uma seção de filtros contém: um `<select>` de estado (populado
estaticamente com os 9 estados do Nordeste), um `<select>` de município (populado
dinamicamente via Back4App após a seleção do estado) e um campo de busca por nome
da escola com debounce de 400ms. Todos os controles possuem `rounded-xl` e label
descritivo em `<label for="...">` para acessibilidade.

Logo abaixo dos filtros, quatro cartões de KPI são exibidos em grid responsivo
(1 coluna no mobile, 2 no tablet, 4 no desktop). Cada cartão possui:
- Ícone Phosphor relacionado ao indicador (ex: `ph-student` para total de escolas)
- Valor numérico grande em Poppins Bold
- Rótulo descritivo em texto menor
- Seta de variação percentual em relação ao ano anterior, colorida em verde ou vermelho
- `rounded-2xl`, `shadow-md`, fundo branco, efeito `hover:shadow-xl` com transição 300ms

O toggle de visualização é uma pílula `rounded-full` com dois botões internos:
"Mapa" e "Lista". Ao clicar em "Mapa", o `<div id="container-mapa">` é exibido e o
`<div id="container-lista">` é ocultado via `classList.add('hidden')` e vice-versa.
A alternância não causa nenhum page reload.

O `<div id="container-mapa">` tem altura fixa de 600px no desktop e 350px no mobile.
O Leaflet é inicializado via Lazy Loading (IntersectionObserver) somente quando este
container entra no viewport. Os marcadores do mapa são círculos coloridos por
relevância: amarelo-dourado para Selo Ouro, cinza para sem badge, roxo para escolas
com destaque de acessibilidade PCD. Ao clicar em um marcador, um popup exibe o nome
da escola, a nota de excelência e um botão "Ver Detalhes" que navega para
`detalhes.html?id={objectId}`.

**Estados da Tela por Perfil de Usuário:**

| Elemento                   | Visitante    | Usuário Logado |
|----------------------------|--------------|----------------|
| Botão "Entrar"             | Visível      | Oculto         |
| Avatar do usuário          | Oculto       | Visível        |
| Botão "Denunciar" no popup | Oculto       | Visível        |
| Link "Admin" no header     | Oculto       | Apenas para admin |

### 4.2 detalhes.html — Perfil Detalhado da Escola

**Propósito:** Exibir todas as informações disponíveis sobre uma escola específica,
identificada via parâmetro de URL (`?id={objectId}`).

**Layout e Componentes:**

O `objectId` é extraído de `new URLSearchParams(window.location.search).get('id')`.
O módulo `detalhes.ui.js` assina `mudanca:escolaSelecionada` e renderiza a tela
quando o dado chega do estado. Se o parâmetro de URL estiver ausente ou inválido,
o usuário é redirecionado para `index.html`.

**Seção de Cabeçalho da Escola:** Nome completo, município, estado, código INEP e
a badge de excelência (renderizada condicionalmente com ícone Phosphor `ph-trophy`
e cor correspondente ao tipo de badge).

**Carrossel de Imagens:** Exibe até 30 fotos em um carrossel responsivo. As imagens
são carregadas conforme o sistema de fallback em cascata descrito na seção 5.1. O
carrossel é implementado em CSS puro com `scroll-snap-type: x mandatory` e JavaScript
para os botões de navegação anterior/próximo.

**Checklist de Infraestrutura Comparativa:** Uma grade de itens onde cada linha
representa um indicador de infraestrutura. Cada linha exibe:
- Ícone Phosphor do indicador (ex: `ph-drop` para água, `ph-lightning` para energia)
- Nome do indicador
- Célula "2024": ícone `ph-check-circle` verde se possuía, `ph-x-circle` cinza se não
- Célula "2025": mesma lógica com dados do ano atual

**Selos Gamificados:** Badges renderizados condicionalmente com base nos campos do
banco. Cada badge é um elemento `<span>` com `rounded-full`, cor de fundo correspondente,
ícone Phosphor e texto descritivo.

**Gráfico Radar (Chart.js):** Um gráfico de radar com 7 eixos representando os
indicadores de infraestrutura da escola (Internet, Biblioteca, Lab. Informática,
Banheiro Acessível, Quadra Esportes, Rampas, Água Potável). O dataset exibe os
valores da escola atual e um segundo dataset sobreposto com a média do município
para comparação.

**Formulário de Avaliação:** Visível apenas para usuários autenticados. Exibe 5
estrelas clicáveis (implementadas com ícones `ph-star` e `ph-star-fill` do Phosphor),
um campo de texto para o comentário (máx. 500 caracteres com contador regressivo) e
um botão de envio. O sistema verifica se o usuário já avaliou esta escola antes de
exibir o formulário, exibindo a avaliação anterior em modo de leitura caso já exista.

**Feed de Comentários:** Lista as avaliações existentes em ordem cronológica decrescente.
Cada comentário exibe: avatar do autor (rounded-full), nome de exibição, nota em
estrelas, texto, data formatada e botões de ação (like com contador, botão de denúncia
para usuários logados). A renderização usa DocumentFragment.

### 4.3 ranking.html — Ranking de Excelência Gamificado

**Propósito:** Exibir o ranking das 50 melhores escolas do Nordeste com pódio
visual para o Top 3 e lista contínua do 4º ao 50º lugar.

**Layout e Componentes:**

**Pódio Visual (Top 3):** As três primeiras escolas são exibidas em um layout de
pódio estilizado. A escola em 1º lugar ocupa o centro e é escalada com `scale(1.1)`
via CSS. A escola em 2º lugar fica à esquerda com `scale(1.0)`. A 3ª fica à direita
com `scale(0.95)`. Cada elemento do pódio exibe: posição numérica, nome da escola,
município, nota de excelência formatada e o badge visual correspondente.

**Lista do 4º ao 50º Lugar:** Renderizada via DocumentFragment em um único appendChild.
Cada item da lista exibe: número ordinal, nome, município e nota. A lista suporta
paginação ou carregamento infinito via scroll.

**Filtros do Ranking:** Seletores de estado e município para filtrar o ranking
geograficamente. O filtro atualiza o ranking em tempo real via evento no estado.js.

**Modal de Transparência Algorítmica:** Um botão "Como é calculada esta nota?" abre
um modal (`rounded-2xl`, overlay com `backdrop-blur`) que explica em linguagem acessível
a fórmula do Ranking de Excelência: os três critérios, seus pesos (40%, 40%, 20%)
e como as notas de cada dimensão são normalizadas para a escala 0-10.

### 4.4 analise.html — Relatórios de Evolução

**Propósito:** Página analítica de comparação de dados regionais. Não possui mapa.
Foco total em visualizações de dados com Chart.js.

**Layout e Componentes:**

**Gráfico 1 — Barras Agrupadas (Infraestrutura 2024 vs 2025):**
Eixo X: categorias de infraestrutura (Água, Energia, Esgoto, Internet, PCD).
Eixo Y: porcentagem de escolas com o indicador (0% a 100%).
Dois grupos de barras por categoria: barra azul para 2024, barra verde para 2025.
Este gráfico é o mais crítico para o paradigma comparativo da plataforma.

**Gráfico 2 — Donut (Conectividade à Internet):**
Exibe a distribuição das escolas em quatro segmentos: "Com internet 2025", "Sem internet
2025", "Ganhou internet (estava sem em 2024)", "Perdeu internet (tinha em 2024)".

**Filtros Geográficos:** Seletores de estado e município que atualizam os três gráficos
simultaneamente via evento no estado.js.

**Botão "Exportar Relatório PDF":** Ao clicar, aciona `window.print()`. A interface
é preparada para impressão via `@media print` no CSS: o header, os filtros e os botões
são ocultados com `display: none`, os gráficos são expandidos para ocupar a largura
total do papel A4, e um cabeçalho de relatório com logotipo textual e data de geração
é exibido apenas na impressão.

### 4.5 admin.html — Painel do Gestor

**Propósito:** Interface restrita para usuários com `role === 'admin'`. Permite
moderar o conteúdo enviado pela comunidade.

**Controle de Acesso:** A primeira instrução executada pelo módulo `admin.ui.js` é
a verificação do usuário atual no estado. Se não houver usuário logado ou se o role
não for 'admin', `window.location.href = '/index.html'` é executado imediatamente,
sem renderizar nada da página.

**Tabela de Fotos Pendentes:**
Uma tabela com colunas: miniatura da foto, nome da escola, nome do autor, data de
envio, e dois botões de ação ("Aprovar" com ícone `ph-check` e "Rejeitar" com ícone
`ph-x`). Ao aprovar, o campo `status` da foto é atualizado para 'approved' via API e
o sistema aciona o incremento de karma do autor. Ao rejeitar, o status é atualizado
para 'rejected' e a foto é removida da fila sem notificação ao autor (por padrão).

**Tabela de Comentários Denunciados:**
Lista todas as `Review` com `flags_count >= 3`. Exibe o texto do comentário, o autor,
o número de denúncias e dois botões: "Manter" (limpa as flags, restaurando o comentário)
e "Remover" (deleta o objeto do banco via Master Key).

### 4.6 config.html — Configurações do Usuário

**Propósito:** Permitir que o usuário logado personalize sua conta.

**Upload de Avatar:**
Um campo de input `type="file"` oculto é ativado por um botão estilizado. Ao selecionar
uma imagem, o Pica.js é utilizado para redimensionar a imagem no navegador do usuário
para 256x256 pixels antes de fazer o upload, economizando armazenamento e largura de
banda. O resultado é enviado como `Parse.File` e associado ao campo `profilePhoto` do
usuário atual.

**Barra de Karma Points:**
Uma barra de progresso visual (`rounded-full`) exibe os karma points acumulados do
usuário em relação ao próximo nível. Os níveis são: Iniciante (0-99), Colaborador
(100-499), Guardião (500-999), Embaixador (1000+). O nível atual e o próximo nível
são exibidos como texto.

**Toggle de Modo Escuro:**
Um toggle switch em pílula (`rounded-full`) controla o modo escuro da aplicação.
O estado é persistido em `localStorage` e aplicado adicionando ou removendo a classe
`dark` no elemento `<html>`. As cores do modo escuro são controladas por variáveis
CSS no arquivo `temas.css`.

### 4.7 termos.html e privacidade.html

Páginas estáticas de leitura com estrutura semântica simples. São referenciadas nos
parâmetros de configuração da integração Google OAuth como URLs obrigatórias para a
publicação do aplicativo no Google Cloud Console.

---

## 5. Funcionalidades Dinâmicas Avançadas

### 5.1 Sistema de Cascata de Imagens — Fallback Sequencial

A lógica de exibição de imagem de fachada de uma escola segue um algoritmo de cascata
com três etapas, implementado integralmente no módulo `detalhes.ui.js` como uma função
assíncrona com `await`:

**Etapa 1 — Back4App (Fonte Primária):**
O módulo chama `fotos.api.listarAprovadas(coInep)`, que realiza uma query na coleção
`SchoolPhoto` filtrando por `escola == pointer` e `status == 'approved'`. Se o array
retornado contiver pelo menos um item, a função renderiza o carrossel com as fotos
da comunidade e encerra o fluxo. Nenhuma chamada externa é feita.

**Etapa 2 — Mapillary API (Fonte Secundária):**
Se o Back4App não retornar fotos aprovadas, o módulo chama
`mapillary.api.buscarPorCoordenadas(latitude, longitude)`. Esta função realiza um
GET ao endpoint `https://graph.mapillary.com/images` com parâmetro `bbox` calculado
como uma caixa delimitadora de 0.001 graus ao redor das coordenadas da escola,
`fields=id,thumb_1024_url` e `limit=5`. Se a resposta contiver imagens, elas são
renderizadas no carrossel com uma legenda discreta "Imagens da Rua — Fonte: Mapillary".
O token de acesso ao Mapillary é lido de `constantes.js` que por sua vez lê do
objeto de configuração inicializado com os valores do `.env`.

**Etapa 3 — Placeholder SVG (Fallback Final):**
Se as duas etapas anteriores falharem ou retornarem vazio, o módulo renderiza o
SVG placeholder localizado em `/assets/imagens/placeholder-escola.svg`. Abaixo do
placeholder, um botão com o ícone `ph-camera` e o texto "Enviar a primeira foto desta
escola" é exibido. Este botão dispara o modal de upload, que exige autenticação.

### 5.2 Validação Geográfica Anti-Fraude — Selo "Local Verificado"

Quando um usuário logado submete uma avaliação para uma escola, o módulo
`detalhes.ui.js` solicita a localização atual do dispositivo via `navigator.geolocation.
getCurrentPosition()` **antes** de enviar a avaliação ao Back4App.

Se o usuário conceder a permissão, as coordenadas retornadas são enviadas junto com
a avaliação nos campos `latitude_envio` e `longitude_envio`. A distância entre o
ponto de envio e as coordenadas da escola é calculada no cliente usando a fórmula
de Haversine:

```javascript
// src/js/core/utilitarios.js
export function calcularDistanciaKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Raio médio da Terra em km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
```

Se a distância calculada for menor ou igual a 0.5 km (500 metros), o campo
`verificado_local` da Review é salvo como `true`. Na renderização do feed de
comentários, avaliações com `verificado_local === true` exibem um badge com o ícone
`ph-map-pin` e o texto "Local Verificado" na cor verde `#3DA35A`.

Se o usuário negar a permissão de localização, a avaliação é enviada normalmente com
`verificado_local: false` e sem os campos de coordenada. A negação da permissão
não impede o envio da avaliação.

---

## 6. Design System Visual

### 6.1 Tipografia

A tipografia da plataforma é definida em duas famílias:

**Inter (Peso 400, 500, 600, 700):** Fonte principal usada em todos os textos do corpo,
labels, inputs, tabelas e componentes de UI. Escolhida por sua legibilidade excepcional
em telas e seu suporte completo ao charset do Português Brasileiro.

**Poppins (Peso 600, 700, 800):** Usada exclusivamente em títulos de destaque (h1 da
capa, nomes de escola em destaque, números de KPI). Confere personalidade e distinção
visual aos elementos de maior hierarquia.

Ambas são carregadas via Google Fonts com `preconnect` para performance:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700
  &family=Poppins:wght@600;700;800&display=swap" rel="stylesheet">
```

### 6.2 Paleta de Cores e Variáveis CSS

```css
/* src/css/variaveis.css */
:root {
  /* Paleta Principal — Tema Nordeste */
  --cor-primaria: #1A5691;
  --cor-primaria-escura: #134070;
  --cor-primaria-clara: #E8F0F9;

  --cor-secundaria: #3DA35A;
  --cor-secundaria-escura: #2D7A43;
  --cor-secundaria-clara: #E6F4EA;

  --cor-acento: #F2994A;
  --cor-acento-escura: #D4792A;
  --cor-acento-clara: #FEF3E7;

  --cor-mobilidade: #805AD5;
  --cor-mobilidade-escura: #5E3FA3;
  --cor-mobilidade-clara: #EDE9F8;

  /* Neutros — Modo Claro */
  --cor-fundo: #F7F8FA;
  --cor-superficie: #FFFFFF;
  --cor-borda: #E2E8F0;
  --cor-texto-principal: #1A202C;
  --cor-texto-secundario: #718096;

  /* Semânticas */
  --cor-sucesso: var(--cor-secundaria);
  --cor-erro: #E53E3E;
  --cor-aviso: var(--cor-acento);
  --cor-info: var(--cor-primaria);

  /* Tipografia */
  --fonte-corpo: 'Inter', system-ui, sans-serif;
  --fonte-titulo: 'Poppins', 'Inter', sans-serif;

  /* Bordas */
  --raio-pequeno: 0.5rem;   /* 8px */
  --raio-medio: 1rem;       /* 16px */
  --raio-grande: 1.5rem;    /* 24px — rounded-2xl */
  --raio-total: 9999px;     /* rounded-full */

  /* Sombras */
  --sombra-suave: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06);
  --sombra-media: 0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06);
  --sombra-forte: 0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05);

  /* Transições */
  --transicao-padrao: all 300ms ease-in-out;
}

/* Modo Escuro */
.dark {
  --cor-fundo: #121212;
  --cor-superficie: #1E1E1E;
  --cor-borda: #2D2D2D;
  --cor-texto-principal: #E0E0E0;
  --cor-texto-secundario: #A0A0A0;
  --cor-primaria-clara: #1A3050;
  --cor-secundaria-clara: #1A3025;
  --cor-acento-clara: #3D2810;
  --cor-mobilidade-clara: #2D1F50;
}
```

### 6.3 Componentes Padrão do Sistema

**Card Padrão:**
```css
/* src/css/componentes.css */
.card {
  background-color: var(--cor-superficie);
  border-radius: var(--raio-grande);
  box-shadow: var(--sombra-suave);
  border: 1px solid var(--cor-borda);
  padding: 1.5rem;
  transition: var(--transicao-padrao);
}
.card:hover {
  box-shadow: var(--sombra-forte);
  transform: translateY(-2px);
}
```

**Botão Primário:**
```css
.botao-primario {
  background-color: var(--cor-primaria);
  color: #FFFFFF;
  border-radius: var(--raio-total);
  padding: 0.625rem 1.5rem;
  font-family: var(--fonte-corpo);
  font-weight: 600;
  font-size: 0.875rem;
  border: none;
  cursor: pointer;
  transition: var(--transicao-padrao);
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}
.botao-primario:hover {
  background-color: var(--cor-primaria-escura);
  box-shadow: var(--sombra-media);
}
```

**Badge de Excelência:**
```css
.badge-ouro {
  background-color: var(--cor-acento-clara);
  color: var(--cor-acento-escura);
  border: 1px solid var(--cor-acento);
  border-radius: var(--raio-total);
  padding: 0.25rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
}
```

### 6.4 Comportamento do Modo Escuro

O modo escuro é ativado adicionando a classe `dark` ao elemento `<html>`. Todas as
variáveis CSS são sobrescritas automaticamente pelo bloco `.dark { }` em `variaveis.css`.
O Tailwind CSS (via CDN com configuração `darkMode: 'class'`) também reconhece a classe
para as utilities `dark:` quando necessário.

O estado do modo escuro é persistido em `localStorage` com a chave `'acessoedu:tema'`
e restaurado no carregamento da página antes do primeiro render, dentro de um `<script>`
síncrono no `<head>` para evitar o flash de tema incorreto (FOUC):

```html
<!-- No <head> do index.html, ANTES de qualquer outro script -->
<script>
  (function() {
    const tema = localStorage.getItem('acessoedu:tema');
    if (tema === 'escuro') {
      document.documentElement.classList.add('dark');
    }
  })();
</script>
```

### 6.5 Acessibilidade (a11y)

Todas as decisões de design devem respeitar as seguintes diretrizes:

- Contraste mínimo de 4.5:1 entre texto e fundo (WCAG AA).
- Todos os ícones Phosphor usados de forma funcional (não decorativa) devem ter
  `aria-label` descritivo ou ser acompanhados por texto visível.
- Elementos interativos (botões, links) devem ter foco visível com `outline` customizado
  na cor primária.
- Imagens devem ter atributo `alt` descritivo.
- A estrutura de cabeçalhos (h1 > h2 > h3) deve ser hierárquica e sem saltos.

---

## 7. Cronograma de Implementação Sugerido

| Fase | Entregas                                                             | Estimativa |
|------|----------------------------------------------------------------------|------------|
| 1    | ETL Python + Geocoding + geração do escolas_limpo.json              | 2 dias     |
| 2    | Configuração do Back4App (coleções, ACLs, Live Queries) + Seeder    | 1 dia      |
| 3    | Scaffolding do projeto: index.html, variaveis.css, estado.js, utils | 1 dia      |
| 4    | index.html: header, KPIs, filtros, toggle, mapa Leaflet             | 2 dias     |
| 5    | detalhes.html: cascata de imagens, checklist, gráfico radar         | 2 dias     |
| 6    | ranking.html: pódio, lista com Fragment, modal algorítmico           | 1 dia      |
| 7    | analise.html: 2 gráficos Chart.js, exportação PDF                   | 1 dia      |
| 8    | admin.html: moderação de fotos e comentários                         | 1 dia      |
| 9    | config.html: Pica.js, karma, modo escuro                            | 1 dia      |
| 10   | Google OAuth, testes de fluxo de autenticação, revisão final        | 1 dia      |
| **Total** |                                                                 | **13 dias**|

---

## 8. Checklist de Conformidade Final

Antes de qualquer entrega ou apresentação, o seguinte checklist deve ser verificado
item a item:

- [ ] Nenhum emoji em nenhum arquivo do projeto
- [ ] Nenhuma chamada ao Google Maps ou Google Geocoding API
- [ ] Nenhuma manipulação de DOM dentro de laços (grep por `innerHTML +=` no repo)
- [ ] DocumentFragment usado em todas as renderizações de listas
- [ ] debounce aplicado em todos os inputs de busca
- [ ] throttle aplicado em todos os eventos de scroll e mapa
- [ ] Leaflet e Chart.js carregados via Lazy Loading (IntersectionObserver)
- [ ] Todos os nomes de variáveis, funções e comentários em PT-BR
- [ ] Arquivo `.env` listado no `.gitignore` (nunca versionado)
- [ ] `AI_CONTEXT.md`, `ARQUITETURA.md` e `PLAN.MD` listados no `.gitignore`
- [ ] Rodapé acadêmico presente em todas as páginas HTML
- [ ] ACLs configuradas corretamente no Back4App (leitura pública para School)
- [ ] Verificação de role admin executada na primeira linha de admin.ui.js
- [ ] Sistema de cascata de imagens funcionando (Back4App → Mapillary → Placeholder)
- [ ] Todas as coleções do banco criadas com os campos documentados neste PLAN.MD
- [ ] Formulário de avaliação bloqueado para usuários não autenticados
- [ ] Prevenção de avaliações duplicadas verificada (ReviewInteraction)
- [ ] Modo escuro funcionando sem FOUC (script síncrono no head)
- [ ] Contraste de cores verificado com ferramenta WCAG (mínimo 4.5:1)
- [ ] `aria-label` em todos os ícones funcionais da interface