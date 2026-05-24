# Documentação do Site (Interface Pública)

Esta plataforma converte dados abertos do Censo Escolar e do SAEB em uma experiência gamificada e de **Auditoria Cidadã** para escolas públicas do Nordeste brasileiro.

## 🗺️ O Mapa Dinâmico (Home)
A página inicial (`index.html`) apresenta um mapa interativo ocupando 100% da tela (`100vw` / `100vh`), desenvolvido com a biblioteca **Leaflet.js**. 

### 1. Sistema de Agrupamento (Clustering)
- **Desafio:** Renderizar mais de 51.000 escolas do Nordeste de uma vez destruiria a performance do navegador do usuário.
- **Solução (MarkerCluster):** Utilizamos o plugin `Leaflet.markercluster` para agrupar as escolas geograficamente dependendo do zoom. Ao abrir a página, o usuário visualiza grandes "bolhas" (ex: 4500 escolas em Pernambuco). Conforme aplica zoom (scroll do mouse ou clique na bolha), os clusters se quebram em bolhas menores, até revelar o pino individual de cada escola.

### 2. O Cartão da Escola (Popup)
Ao clicar no pino exato de uma escola, surge um painel (Popup) interativo trazendo as informações mestre injetadas pela nossa Engenharia de Dados:
- **Nome Oficial da Escola**
- **Localização** (Cidade)
- **🛠️ Nota de Infraestrutura (0 a 10):** Uma métrica simplificada derivada dos microdados do MEC, ponderando a presença de Água Potável, Internet e Banheiros Acessíveis (PCD).

## 💬 Fórum e Auditoria Cidadã (Próximos Passos)
A atual versão exibe o panorama base. As próximas implementações de interface englobam:

1. **Painel Expandido da Escola:** Ao clicar no nome da escola no mapa, abrirá um modal detalhado consumindo a tabela `Escolas` do nosso Back4App, mostrando o desempenho no IDEB (notas do SAEB).
2. **Sistema de Avaliações:** Formulário público de 1 a 5 estrelas atrelado à tabela `Avaliacoes`, focado na fiscalização popular da zeladoria da escola. O usuário fará o reporte (ex: *'Falta de Água'* ou *'Estrutura Danificada'*).
3. **Mural de Evidências:** As avaliações registradas (e fotos anexadas) gerarão um *feed social* exibido no perfil da escola, empoderando pais e alunos a exporem a realidade física em contraponto aos dados oficias do MEC. 

## 🌐 Tecnologias Atuais no Front-End
- Vanilla JavaScript / HTML / CSS
- **Leaflet.js** (Renderização do Mapa)
- **Parse SDK para JS** (Comunicação Direta Serverless com a API do Back4App)
