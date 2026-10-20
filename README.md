# MatchCV

Plataforma web **sem login** para ajudar em candidaturas a vagas de TI. O usuário envia o currículo em PDF e a descrição da vaga, escolhe um provedor de IA, informa a própria API key e recebe cinco materiais:

1. **CV em PDF compatível com ATS**, alinhado à vaga
2. **E-mail** para a empresa (com botão de copiar)
3. **Cover letter** (com botão de copiar)
4. **Roteiro de entrevista** em seções expansíveis
5. **Faixa salarial** estimada, com a fonte (Adzuna)

O modelo é BYOK (*bring your own key*): cada usuário paga o próprio uso de IA. Nada é armazenado no servidor.

> **Estado atual (v0.1.0):** as 4 telas funcionam de ponta a ponta, com **dados de exemplo** nas rotas de IA. A leitura do PDF (unpdf), o validador anti-IA, o PDF do CV e o cliente da Adzuna já funcionam. A chamada real aos modelos já está escrita, mas fica desligada até ser testada (veja [Como as chaves de IA funcionam](#como-as-chaves-de-ia-funcionam)).

## Stack

| Camada | Escolha |
|---|---|
| Framework | Next.js 16 (App Router, Route Handlers em `src/app/api`, sem backend separado) |
| UI | React 19, TypeScript, Tailwind CSS 4, shadcn/ui (Base UI), lucide-react |
| Runtime | Node.js 24 LTS (mínimo 22, exigido pelo AI SDK 7) |
| IA | Vercel AI SDK 7 (`ai`) com `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google` e `@ai-sdk/openai-compatible` (Qwen 3 e outros abertos via Together e OpenRouter) |
| Schemas | Zod 4 + `Output.object` |
| Leitura do CV | `unpdf` |
| PDF do CV | Gerador simples próprio (placeholder). Plano A: Typst. Plano B: `@react-pdf/renderer` |
| Salário | Adzuna API (`/jobs/br/histogram`) |
| Testes | Vitest |
| Hospedagem | Vercel |

## Estrutura de pastas

```
MatchCV/
├─ .env.example               # variáveis de ambiente (Adzuna e flag de IA)
├─ next.config.ts             # headers de segurança e CSP
├─ src/
│  ├─ app/
│  │  ├─ page.tsx             # Tela 1: Home
│  │  ├─ gerar/page.tsx       # Telas 2 a 4: formulário, processamento, resultados
│  │  └─ api/
│  │     ├─ key/validate/     # POST: testa a chave do usuário
│  │     ├─ parse/            # POST: extrai texto do PDF
│  │     ├─ generate/[artifact]/  # POST: cv | email | cover-letter | interview
│  │     ├─ cv/pdf/           # POST: JSON do CV -> PDF ATS
│  │     └─ salary/           # POST: faixa salarial (Adzuna)
│  ├─ components/
│  │  ├─ matchcv/             # componentes das telas
│  │  └─ ui/                  # componentes shadcn/ui
│  ├─ lib/
│  │  ├─ ai/                  # catálogo de modelos, buildModel(), geração
│  │  ├─ client/              # chamadas do navegador e sessionStorage
│  │  ├─ mock/                # dados de exemplo
│  │  ├─ pdf/                 # gerador de PDF (placeholder)
│  │  ├─ salary/adzuna.ts     # cliente da Adzuna
│  │  ├─ schemas/             # schemas Zod de entrada e saída
│  │  ├─ security/            # rate limit e respostas seguras
│  │  └─ text/                # validador anti-IA e frases banidas
│  └─ prompts/                # prompts versionados (CV, cover letter, e-mail, entrevista, salário)
└─ vitest.config.mts
```

## Como rodar localmente

Pré-requisitos: **Node.js 24** (o `.nvmrc` já aponta para ele; o mínimo é 22) e npm.

```bash
npm install
cp .env.example .env.local   # no Windows (PowerShell): Copy-Item .env.example .env.local
npm run dev
```

Abra http://localhost:3000.

Outros scripts:

| Comando | O que faz |
|---|---|
| `npm run lint` | ESLint |
| `npm run typecheck` | Gera os tipos de rota e roda o `tsc` |
| `npm test` | Testes do validador anti-IA e do cliente da Adzuna |
| `npm run build` / `npm start` | Build e servidor de produção |

## Como as chaves de IA funcionam

As chaves de IA **não ficam no `.env`**. Cada usuário digita a própria chave na tela do formulário.

- **Provedores suportados:** OpenAI, Anthropic, Google Gemini, open source via Together AI (Qwen 3, GLM) e OpenRouter (uma chave para vários modelos). A lista de modelos fica em `src/lib/ai/catalog.ts`. Os IDs marcados como "a confirmar" precisam ser checados no `/models` do provedor.
- **No navegador:** a chave fica só no estado do React. A opção "Lembrar nesta aba" usa `sessionStorage`, que some ao fechar a aba. O app nunca usa `localStorage`.
- **No envio:** a chave vai no corpo de um POST para as rotas `/api` do próprio app (HTTPS na Vercel), nunca na URL.
- **No servidor:** `buildModel(provider, modelId, apiKey)` em `src/lib/ai/providers.ts` cria o provider **dentro do handler, a cada request**, e a chave é descartada em seguida. Ela nunca é logada, persistida ou devolvida. As `baseURL` de Together e OpenRouter são fixas no servidor (allowlist), então o cliente não consegue apontar o app para outra URL.
- **Modo de exemplo:** por padrão as rotas devolvem dados fictícios. Para ligar as chamadas reais (geração e validação da chave), defina no `.env.local`:

  ```
  MATCHCV_ENABLE_AI=true
  ```

### Regras anti-IA

Os prompts de CV, cover letter e e-mail (`src/prompts/`) incluem as regras de `src/prompts/anti-ai-rules.ts`: sem travessão nem meia-risca, sem `~` antes de números (usar "em média X" ou "cerca de X"), sem frases clichê, sem inventar experiência, frases com tamanhos variados e sem emojis. Depois de cada geração, `src/lib/text/humanize-validator.ts`:

1. corrige o que é seguro corrigir (travessão por vírgula, `~20` por "cerca de 20");
2. se ainda sobrar violação, gera de novo uma vez com a lista dos problemas;
3. se continuar, a tela de resultados mostra os trechos para revisão.

## Como configurar a Adzuna (faixa salarial)

1. Crie uma conta em https://developer.adzuna.com e registre um app para receber o `app_id` e a `app_key`.
2. Preencha no `.env.local`:

   ```
   ADZUNA_APP_ID=seu_app_id
   ADZUNA_APP_KEY=sua_app_key
   ```

3. Reinicie o `npm run dev`. Sem essas variáveis, `/api/salary` devolve dados de exemplo.

Observações:

- As credenciais da Adzuna são **do servidor** e nunca vão para o navegador. Por isso a rota `/api/salary` tem rate limit mais apertado.
- **Atribuição obrigatória:** os termos exigem exibir "Adzuna" com link. Estimativas salariais levam o selo "Adzuna Jobsworth". A tela de resultados já mostra os dois.
- A chave gratuita é para avaliação e uso pessoal. Uso comercial exige acordo por escrito com a Adzuna. Confirme os limites de chamadas dentro da sua conta.
- O Glassdoor **não** é usado: os termos dele proíbem scraping.

## Deploy na Vercel

1. Suba o repositório para o GitHub e importe o projeto em https://vercel.com/new (o framework Next.js é detectado sozinho).
2. Em *Settings > Environment Variables*, cadastre `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` e, quando quiser IA real, `MATCHCV_ENABLE_AI=true`.
3. Em *Settings > General*, escolha Node.js 24.

O plano Hobby é gratuito, mas só vale para uso pessoal e não comercial.

## Segurança (MVP)

- CSP e headers de segurança em `next.config.ts` (`connect-src 'self'`, `frame-ancestors 'none'`, `nosniff`, HSTS).
- Saída do modelo renderizada como texto puro, nunca com `dangerouslySetInnerHTML`.
- Rate limit por IP em todas as rotas. É em memória, então em serverless o limite é aproximado. Para algo mais forte, use Upstash Redis ou o Vercel Firewall.
- Respostas de erro genéricas, sem ecoar a chave ou o corpo do request.

## Pós-MVP (não implementado)

Estas funcionalidades ficam para uma fase separada e **não fazem parte deste código**:

- **Login** (Supabase Auth ou Better Auth).
- **Dashboard de vagas aplicadas:** empresa, vaga, data, status e acesso aos materiais gerados.
- **API key persistente e criptografada:** envelope encryption (AES-256-GCM com KMS) ou Supabase Vault, com mascaramento, troca, exclusão e validação ao salvar.
- Banco e storage com Supabase (Postgres + Storage) e Drizzle.
- Exclusão de conta e dados (LGPD).

## Próximos passos

- Testar e ligar a geração real (`MATCHCV_ENABLE_AI=true`) com cada provedor e fechar a lista de modelos do seletor.
- Etapa de análise da vaga (cargo, senioridade, localidade e palavras-chave) para alimentar a Adzuna e os prompts.
- Checagem de fidelidade do CV (empresas, cargos e datas contra o currículo original).
- Trocar o gerador de PDF provisório pelo template Typst (ou `@react-pdf/renderer`).
- Suporte a DOCX (`mammoth`) e fallback para PDF escaneado.
- Streaming de progresso por etapa.
