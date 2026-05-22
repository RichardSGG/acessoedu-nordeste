# AcessoEdu Nordeste

O **AcessoEdu Nordeste** é um painel interativo (Dashboard) focado na auditoria cidadã da infraestrutura de acessibilidade nas escolas do Nordeste do Brasil. 

Funcionando como um "TripAdvisor" escolar, a plataforma permite que a comunidade avalie os recursos de acessibilidade (rampas, piso tátil, banheiros adaptados) das instituições já cadastradas, gerando um ranking público em tempo real.

Projeto desenvolvido para a atividade **A07 - Dashboard HTML/CSS/JS** do curso de Sistemas para Internet (UNICAP).

## Funcionalidades

- **Ranking Interativo (Chart.js):** Gráficos dinâmicos que exibem as escolas com as melhores médias de avaliação e o panorama geral de satisfação.
- **Busca Inteligente (API ViaCEP):** O usuário digita o seu CEP e o sistema localiza automaticamente o seu bairro, filtrando o feed para exibir apenas as escolas da sua região.
- **Mural de Auditoria (CRUD):** Feed no estilo blog onde os usuários podem:
  - **Criar (Create):** Atribuir notas de 1 a 5 e deixar comentários sobre a escola.
  - **Ler (Read):** Visualizar as avaliações de outros cidadãos e o total de curtidas (Likes/Dislikes).
  - **Atualizar (Update):** Editar o próprio comentário caso a escola passe por reformas.
  - **Deletar (Delete):** Remover sua avaliação do sistema.

## Tecnologias Utilizadas

- **Front-end:** HTML5, JavaScript (ES6+ Vanilla).
- **Estilização:** Tailwind CSS (via CDN) com foco em alto contraste e acessibilidade visual (A11y).
- **Visualização de Dados:** Chart.js.
- **Back-end e Banco de Dados:** [Back4App](https://www.back4app.com/) (REST API).
- **API Externa:** [ViaCEP](https://viacep.com.br/) (Geolocalização por Código Postal).
- **Hospedagem:** Render / Vercel.

## Como executar o projeto localmente

1. Faça o clone deste repositório:
   ```bash
   git clone [https://github.com/SEU_USUARIO/acessoedu-nordeste.git](https://github.com/SEU_USUARIO/acessoedu-nordeste.git)
