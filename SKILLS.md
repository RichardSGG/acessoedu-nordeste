# Skills Instaladas — ezmtds

Skills do repositório [claude-skills](https://github.com/alirezarezvani/claude-skills) (345+ skills) selecionadas para o perfil do projeto: **frontend, segurança, design system e SaaS**.

---

## Caminhos de Instalação

| Plataforma | Caminho | Índice |
|-----------|---------|--------|
| **Claude Code** | `C:\Users\richd\.claude\skills\` | Automático (carrega SKILL.md do diretório) |
| **Gemini CLI (Antigravity)** | `C:\Users\richd\.gemini\skills\` | `skills-index.json` (20 skills indexadas) |

## Como Chamar

| Plataforma | Sintaxe | Exemplo |
|-----------|---------|---------|
| **Claude Code** | `/skill-name` | `/senior-frontend` |
| **Gemini CLI (Antigravity)** | `activate_skill(name="skill-name")` | `activate_skill(name=senior-frontend")` |

As skills do marketplace usam prefixo: `engineering-skills:skill-name`, `product-skills:skill-name`, `marketing-skills:skill-name`.

---

## Frontend & Design (5)

| Skill | Resumo |
|-------|--------|
| `senior-frontend` | React, Next.js, TypeScript e Tailwind. Otimização de bundle, scaffolding, acessibilidade e code review de frontend. |
| `senior-fullstack` | Scaffolding de projetos (Next.js, FastAPI, MERN, Django), análise de qualidade de código e decisão de stack. |
| `ui-design-system` | Design tokens, documentação de componentes, design responsivo e handoff design-dev. |
| `landing-page-generator` | Gera landing pages em Next.js/React + Tailwind com seções de hero, pricing, FAQ, depoimentos e CTA. Otimizado para Core Web Vitals. |
| `ux-researcher-designer` | Personas data-driven, journey mapping, testes de usabilidade e síntese de pesquisa UX. |

## Segurança (6)

| Skill | Resumo |
|-------|--------|
| `senior-security` | Threat modeling (STRIDE/DREAD), análise de data-flow e roteamento para skills especializadas de segurança. |
| `security-pen-testing` | Testes de penetração, scan de vulnerabilidades, OWASP Top 10, análise estática e detecção de secrets. |
| `threat-detection` | Caça a ameaças, análise de IOCs, detecção de anomalias e priorização com MITRE ATT&CK. |
| `cloud-security` | Postura de segurança cloud (AWS, Azure, GCP): IAM, S3 exposto, security groups e IaC security. |
| `ai-security` | Segurança em AI/ML: prompt injection, jailbreak, inversão de modelo, envenenamento de dados. MITRE ATLAS. |
| `adversarial-reviewer` | Code review adversarial que quebra viés de auto-revisão. Força perspectivas de reviewers hostis para encontrar pontos cegos. |

## Engenharia Core (5)

| Skill | Resumo |
|-------|--------|
| `senior-architect` | Design de arquitetura, ADRs, avaliação de stack, análise de dependências e diagramas (Mermaid, PlantUML). |
| `senior-backend` | APIs REST, microserviços, bancos de dados, autenticação e segurança. Node.js/Express/Fastify e PostgreSQL. |
| `code-reviewer` | Code review multi-linguagem (TS, JS, Python, Go, Rust, etc.). Análise de complexidade, SOLID e code smells. |
| `senior-qa` | Testes unitários, integração e E2E para React/Next.js. Jest, React Testing Library, Playwright e MSW. |
| `epic-design` | Design épico de funcionalidades complexas, planejamento de implementação e decomposição de requisitos. |

## DevOps & Qualidade (3)

| Skill | Resumo |
|-------|--------|
| `senior-devops` | CI/CD, infraestrutura como código, containers e cloud (AWS, GCP, Azure). Deploy e monitoramento. |
| `tdd-guide` | Desenvolvimento guiado por testes (red-green-refactor). Jest, Pytest, JUnit, Vitest, Mocha. |
| `saas-scaffolder` | Gera boilerplate SaaS completo: Next.js 14+ App Router, TypeScript, Tailwind, shadcn/ui, Drizzle ORM e Stripe. |

## Pagamentos (1)

| Skill | Resumo |
|-------|--------|
| `stripe-integration-expert` | Integrações Stripe produção: assinaturas, checkouts, webhooks idempotentes, portal do cliente e billing. |

---

## Skills do Marketplace (prefixadas)

Disponíveis sem instalação local (já carregadas pelo plugin marketplace):

**engenharia:** `engineering-skills:aws-solution-architect`, `engineering-skills:azure-cloud-architect`, `engineering-skills:gcp-cloud-architect`, `engineering-skills:senior-secops`, `engineering-skills:incident-response`, `engineering-skills:incident-commander`, `engineering-skills:senior-ml-engineer`, `engineering-skills:senior-data-engineer`, `engineering-skills:senior-data-scientist`, `engineering-skills:senior-prompt-engineer`, `engineering-skills:senior-computer-vision`, `engineering-skills:red-team`, `engineering-skills:email-template-builder`, `engineering-skills:ms365-tenant-manager`, `engineering-skills:tech-stack-evaluator`

**produto:** `product-skills:product-manager-toolkit`, `product-skills:product-strategist`, `product-skills:product-analytics`, `product-skills:product-discovery`, `product-skills:experiment-designer`, `product-skills:competitive-teardown`, `product-skills:spec-to-repo`, `product-skills:roadmap-communicator`

**marketing:** `marketing-skills:seo-audit`, `marketing-skills:content-creator`, `marketing-skills:copywriting`, `marketing-skills:brand-guidelines`, `marketing-skills:landing-page-cro`, `marketing-skills:social-media-manager` e mais 40+ skills de marketing.

**built-in:** `init`, `review`, `security-review`
