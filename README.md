# MatchCV

Produção: https://match-cv-app.vercel.app/

Plataforma web para candidaturas a vagas de TI. Dá para usar **sem login**. O usuário envia o currículo em PDF e a descrição da vaga, escolhe um provedor de IA gratuito, informa a própria API key e recebe cinco materiais:

1. **CV em PDF compatível com ATS**, alinhado à vaga
2. **E-mail** para a empresa (com botão de copiar)
3. **Cover letter** (com botão de copiar e conversão para PDF)
4. **Roteiro de entrevista** em seções expansíveis
5. **Faixa salarial** estimada, com as fontes citadas e um link para o Glassdoor

O modelo é BYOK (*bring your own key*): cada usuário paga o próprio uso de IA. Sem conta, a chave fica na memória da página (ou, se o usuário pedir, num cookie cifrado). Com conta, a chave e as candidaturas podem ir para o Postgres. A arquitetura está em [`docs/auth-architecture.md`](docs/auth-architecture.md).

Por padrão só o **CV** vem marcado. E-mail, cover letter, entrevista e faixa salarial são gerados pelo botão **Gerar** de cada aba. O usuário ainda pode marcar mais de um antes de começar.

## Stack

| Camada | Escolha |
|---|---|
| Framework | Next.js 16 (App Router, Route Handlers em `src/app/api`) |
| UI | React 19, TypeScript, Tailwind CSS 4, shadcn/ui (Base UI), lucide-react |
| Runtime | Node.js 24 LTS (mínimo 22, exigido pelo AI SDK 7) |
| IA | Vercel AI SDK 7 (`ai`) com `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google` e `@ai-sdk/openai-compatible` |
| Schemas | Zod 4 + `Output.object` |
| Leitura do CV | `unpdf` (só PDF com texto) |
| PDF | `@react-pdf/renderer` no navegador, com prévia em blob |
| Salário | Busca nativa do provedor na web pública e link de referência do Glassdoor |
| Telemetria | `@vercel/otel`, `@langfuse/otel` opcional e `@sentry/nextjs` opcional |
| Conta | Better Auth + Drizzle sobre Postgres, só quando `DATABASE_URL` e `BETTER_AUTH_SECRET` existem |
| Testes | Vitest |
| Hospedagem | Vercel |

## Estrutura de pastas

```
MatchCV/
├─ .env.example
├─ favicon.ico                # pedido na raiz; o Next não serve este arquivo sozinho
├─ next.config.ts             # headers de segurança e proxyTimeout
├─ src/
│  ├─ instrumentation.ts      # OpenTelemetry no Node e init do Sentry
│  ├─ instrumentation-client.ts
│  ├─ sentry.server.config.ts
│  ├─ sentry.edge.config.ts
│  ├─ proxy.ts                # CSP com nonce; /monitoring fica de fora
│  ├─ app/
│  │  ├─ favicon.ico          # ícone que o Next serve
│  │  ├─ icon.png
│  │  ├─ apple-icon.png
│  │  ├─ page.tsx             # Home
│  │  ├─ gerar/page.tsx       # formulário, processamento e resultados
│  │  └─ api/
│  │     ├─ key/validate/
│  │     ├─ parse/
│  │     ├─ brief/            # perfil curto do CV e resumo da vaga
│  │     ├─ generate/[artifact]/
│  │     ├─ cv/pdf/
│  │     └─ salary/
│  ├─ components/matchcv/
│  ├─ lib/
│  │  ├─ ai/                  # catálogo, buildModel, telemetria
│  │  ├─ client/
│  │  ├─ pdf/
│  │  ├─ salary/
│  │  ├─ schemas/
│  │  ├─ security/
│  │  └─ text/
│  └─ prompts/
└─ vitest.config.mts
```

O `favicon.ico` da raiz do repositório **não é servido pelo Next**. O ícone da aba é o de `src/app/favicon.ico` (os mesmos bytes: 16, 32, 48, 64 e 256). A arte parte de `src/lib/brand/mark.svg`.

## Como rodar localmente

Pré-requisitos: **Node.js 24** (o `.nvmrc` aponta para ele; o mínimo é 22) e npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abra http://localhost:3000.

| Comando | O que faz |
|---|---|
| `npm run lint` | ESLint |
| `npm run typecheck` | Gera os tipos de rota e roda o `tsc` |
| `npm test` | Vitest |
| `npm run build` / `npm start` | Build e servidor de produção |

## Como as chaves de IA funcionam

As chaves de IA **não ficam no `.env`**. Cada usuário digita a própria chave no formulário.

- **No seletor:** só modelos gratuitos. Hoje isso é Google Gemini (`gemini-3.8-flash` e as variantes Flash-Lite) e OpenRouter (`openrouter/free` e os modelos `:free`). OpenAI, Anthropic e Together continuam no código para `buildModel`, mas ficam fora do seletor porque não têm chave gratuita. A lista está em `src/lib/ai/catalog.ts`.
- **No navegador:** a chave fica no estado do React. "Lembrar nesta aba" usa `sessionStorage` e some ao fechar a aba. O app não usa `localStorage`. Um UUID anônimo separado (`matchcv:anon-session`) identifica a sessão na telemetria.
- **No envio:** a chave vai no corpo de um POST para as rotas `/api` do próprio app, nunca na URL.
- **No servidor:** `buildModel(provider, modelId, apiKey)` cria o provider dentro do handler, a cada request. As `baseURL` de Together e OpenRouter são fixas. A chave não é logada, persistida nem devolvida.
- **Modo de exemplo:** com `MATCHCV_ENABLE_AI` diferente de `true`, as rotas devolvem dados fictícios. Para ligar as chamadas reais:

  ```
  MATCHCV_ENABLE_AI=true
  ```

As gerações de texto rodam com concorrência 2 (1 no Google), retry em 429 e 5xx, e um prazo de 100 s. Se o modelo gratuito estoura o prazo, a rota devolve JSON 504 com a mensagem "O modelo gratuito demorou demais ou atingiu o limite. Tente outro modelo."

### Perfil reaproveitado

Na primeira geração de e-mail, cover letter ou entrevista, `POST /api/brief` extrai uma vez um perfil curto do currículo e um resumo da vaga. O resultado fica no estado do fluxo, no navegador, e as gerações seguintes da mesma sessão reutilizam esse objeto. Nada disso é gravado no servidor.

O CV ATS continua recebendo o texto bruto do currículo. O perfil curto não guarda empresas, datas e bullets com a fidelidade que o PDF precisa repetir.

### Regras anti-IA

Os prompts de CV, cover letter e e-mail incluem `src/prompts/anti-ai-rules.ts`. Depois da geração, `src/lib/text/humanize-validator.ts` corrige o que é seguro e, se ainda houver violação, pede uma reescrita. A entrevista não passa por esse validador.

## Faixa salarial

1. A descrição da vaga é normalizada (cargo, senioridade, empresa, local).
2. Com a IA ligada, se o provedor tiver busca nativa, uma chamada com a ferramenta do modelo estima a faixa e cita só URLs que a ferramenta devolveu.
3. Sem números, a rota responde 200 com "faixa não disponível". Não é erro.
4. O link do Glassdoor aparece sempre. É uma busca por palavra-chave em `glassdoor.com.br` (`Salários/<termo>-salário-SRCH_KO0,N.htm`), com o cargo na frente da empresa. O app não raspa o Glassdoor e não busca o id interno da empresa.
5. Com `MATCHCV_ENABLE_AI` diferente de `true`, `/api/salary` devolve um exemplo e não consulta a web.

## Telemetria

Cada `generateText` liga `experimental_telemetry` com `recordInputs` e `recordOutputs` desligados. Não há `streamText` no app. O span e o log levam só cinco campos: sessão anônima, provedor, modelo, artefato e tentativa. Currículo, vaga, chave e IP não entram.

A sessão vai no header `x-matchcv-session`. A tentativa vai em `x-matchcv-attempt`.

`src/instrumentation.ts` registra o OpenTelemetry com `@vercel/otel`. Na Vercel, os spans aparecem em **Observability**. O uso de tokens sai no log da função como uma linha JSON com `"event":"model_usage"`. Dá para filtrar por esse texto em **Logs**.

O Langfuse só é criado se `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY` e `LANGFUSE_BASEURL` existirem. Sem as três, o exporter não sobe. Quando sobe, mascara padrões de chave e só exporta spans com o atributo `matchcv.artifact`.

As chamadas de saída para OpenAI, Anthropic, Google, Together, OpenRouter e Sentry ficam de fora do tracing de `fetch`, para os headers de autorização não virarem span.

## Sentry

O Sentry é opcional. Sem `SENTRY_DSN` e `NEXT_PUBLIC_SENTRY_DSN`, o SDK não inicializa e o app funciona como antes. O build não precisa de `SENTRY_AUTH_TOKEN`: o upload de source maps só acontece quando o token existe.

O `@vercel/otel` continua dono do tracing no Node. O Sentry não registra um segundo provider (`enableOpenTelemetrySetup: false`) e não define `tracesSampleRate` nesse runtime, para não duplicar span. Com DSN, os spans que o OpenTelemetry já cria seguem também para o Sentry por OTLP, na taxa `SENTRY_TRACES_SAMPLE_RATE` (padrão `0.1`). No browser e no edge a mesma taxa vai em `tracesSampleRate`. Não há Session Replay.

O browser envia eventos para `/monitoring` no próprio app (`tunnelRoute`). A CSP permanece `connect-src 'self'`. O `src/proxy.ts` não intercepta essa rota.

`beforeSend`, `beforeSendTransaction` e `beforeSendSpan` removem `Authorization`, `x-api-key`, `x-goog-api-key`, `apiKey`, `app_key`, cookies, o corpo do request e o texto do CV e da vaga, com o mesmo `redactSecrets` dos logs. O SDK 11 não tem mais `sendDefaultPii`; `dataCollection` deixa IP, cookies, corpos e texto de IA desligados.

Erros das rotas `/api/generate`, `/api/brief`, `/api/salary`, `/api/parse`, `/api/cv/pdf` e `/api/key/validate` passam por `logApiError`, que envia ao Sentry as tags `route`, `artifact`, `provider` e `model`. A chave não entra. `src/app/global-error.tsx` captura erro de render do App Router.

### Projeto no sentry.io

O projeto já existe na org `amador-gabriel-rc`, com o nome `match-cv` (SaaS, sentry.io). `SENTRY_DSN` e `NEXT_PUBLIC_SENTRY_DSN` já estão na Vercel. Para o `npm run dev` local, copie o DSN do projeto para o `.env.local`:

```
SENTRY_DSN=https://…@….ingest.sentry.io/…
NEXT_PUBLIC_SENTRY_DSN=https://…@….ingest.sentry.io/…
SENTRY_ORG=amador-gabriel-rc
SENTRY_PROJECT=match-cv
```

`withSentryConfig` usa `SENTRY_ORG` e `SENTRY_PROJECT` quando existem. Sem elas, o fallback é `amador-gabriel-rc` e `match-cv`. O DSN e o `SENTRY_AUTH_TOKEN` não ficam no código.

1. Opcional: em **Settings → Auth Tokens**, crie um token com `project:releases` e `org:read` e defina `SENTRY_AUTH_TOKEN` para o build enviar source maps. Sem o token, `npm run build` termina do mesmo jeito e só não publica os mapas.
2. Opcional: `SENTRY_TRACES_SAMPLE_RATE=0.1` e `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.1`.
3. Reinicie o `npm run dev`.

### Disparar um erro de teste

Com o DSN preenchido, o erro precisa nascer no app. O console do navegador não conta.

No cliente, um botão temporário em qualquer componente com `"use client"`:

```tsx
<button type="button" onClick={() => { throw new Error("Sentry Test Error"); }}>
  Testar Sentry
</button>
```

No servidor, um `throw new Error("Sentry server test")` temporário dentro de um route handler. Erros já capturados pelas rotas de API aparecem com as tags de rota, artefato, provedor e modelo. Tire o código de teste antes de commitar. O evento deve chegar em **Issues** sem a chave, sem cookie e sem o texto do CV.

## Deploy na Vercel

1. Importe o repositório em https://vercel.com/new.
2. Para IA real, cadastre `MATCHCV_ENABLE_AI=true`. Langfuse é opcional. O Sentry liga com `SENTRY_DSN` e `NEXT_PUBLIC_SENTRY_DSN` (já presentes na Vercel). `SENTRY_ORG` e `SENTRY_PROJECT` são opcionais: sem elas o build usa `amador-gabriel-rc` e `match-cv`. `SENTRY_AUTH_TOKEN` só entra se o build for enviar source maps.
3. Para o rate limit durável, crie o Redis Upstash no Marketplace e conecte a este projeto. O passo a passo está na seção seguinte. Sem essas variáveis o limite continua em memória.
4. Use Node.js 24.

O plano Hobby é gratuito e vale para uso pessoal e não comercial.

## Segurança

- CSP com nonce em `src/proxy.ts` (`connect-src 'self'`, `frame-src 'self' blob:`, `object-src blob:`). `style-src` ainda tem `unsafe-inline`. O túnel `/monitoring` do Sentry fica fora do proxy. Os outros headers de segurança ficam em `next.config.ts`.
- A saída do modelo é texto puro, sem `dangerouslySetInnerHTML`.
- Rate limit por IP em todas as rotas de API. Com Upstash Redis a janela deslizante vale entre instâncias. Sem as variáveis, ou se o Redis falha, o limite em memória desta instância assume.
- `logApiError` e `logApiWarning` mascaram `sk-`, `sk-ant-`, `sk-or-`, `AIza`, `Bearer`, `app_key`, URLs `postgres://` e os valores de `DATABASE_URL`, `BETTER_AUTH_SECRET` e `KEY_ENCRYPTION_SECRET`, além dos segredos passados na chamada. A resposta de erro não devolve a chave nem o corpo.

## Rate limit com Upstash Redis

As rotas `/api` contam pedidos por IP no Upstash Redis (REST, `@upstash/redis` e `@upstash/ratelimit`) quando as credenciais existem. A janela é deslizante e o contador é o mesmo em todas as instâncias. A chave é `matchcv:rl:<rota>:<hash>`. O IP em claro não vai para o Redis: o que entra é o SHA-256, com o sal `RATE_LIMIT_IP_SALT` quando ele existe.

A chamada sai da Vercel Function. A CSP da página continua com `connect-src 'self'`. A URL do Upstash não entra nela.

### Criar o banco no Marketplace

1. No projeto da Vercel, abra Storage (ou Integrations) e escolha Upstash Redis no Marketplace. Pelo CLI: `vercel integration add upstash`.
2. Conecte o banco a este projeto, em Production e Preview. A integração grava as variáveis.
3. O app lê o par `KV_REST_API_URL` e `KV_REST_API_TOKEN`, que é o nome usado pela integração do Marketplace. Se esse par não estiver completo, lê `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`. Um par não completa o outro.
4. Opcional: defina `RATE_LIMIT_IP_SALT` com uma string longa e aleatória. Sem ela o hash ainda acontece, só que sem sal.
5. Faça um novo deploy. No ambiente local, copie as variáveis para o `.env.local` se quiser exercitar o Redis. Sem elas, `npm run dev` e os testes usam o limite em memória.

Se o Redis falhar ou não responder em 1,5 s, a rota continua no ar. O limite em memória desta instância entra no lugar e o log recebe um aviso `rate_limit_fallback`, já passado pelo mascaramento.

Ao estourar o limite a resposta é HTTP 429, com header `Retry-After` e o JSON `{ "error": { "code": "rate_limited", "message": "Muitas requisições. Tente de novo em instantes." } }`.

| Rota | Prefixo | Pedidos na janela de 60 s | O próximo responde 429 |
|---|---|---|---|
| `/api/salary` | `matchcv:rl:salary` | 5 | 6º |
| `/api/parse` | `matchcv:rl:parse` | 20 | 21º |
| `/api/brief` | `matchcv:rl:brief` | 20 | 21º |
| `/api/generate/[artifact]` | `matchcv:rl:generate` | 30 | 31º |
| `/api/cv/pdf` | `matchcv:rl:cv-pdf` | 30 | 31º |
| `/api/key/validate` | `matchcv:rl:key-validate` | 10 | 11º |
| `/api/keys` | `matchcv:rl:keys` | 20 | 21º |
| `/api/applications` | `matchcv:rl:applications` | 30 | 31º |
| `/api/account` | `matchcv:rl:account` | 10 no DELETE, 30 no GET | o seguinte |
| `/api/auth` | `matchcv:rl:auth` | 30 | 31º |

Num disparo seguido, com a janela anterior vazia, o pedido da última coluna recebe 429. Perto da fronteira da janela, o peso da janela anterior também conta.

## Conta, dashboard e chave cifrada

Opcional. Sem as variáveis, `npm run dev` e os testes seguem no modo anônimo.

- **Better Auth** (magic link, GitHub e Google) e **Drizzle** sobre Postgres quando `DATABASE_URL` e `BETTER_AUTH_SECRET` existem. O schema está em `src/lib/db/schema.ts`. `npm run db:push` aplica as tabelas.
- **Chave salva** com envelope AES-256-GCM. O navegador só vê provedor, últimos 4 caracteres e status. A decifragem fica no handler (`useSavedKey: true`). Sem banco, a chave vai para o cookie `HttpOnly` `matchcv_key_vault`.
- **Dashboard** em `/dashboard`: empresa, vaga, data, status (`aplicado`, `entrevista`, `oferta`, `recusado`), busca, anotações, os cinco materiais e exclusão. Sem sessão, a lista fica em `localStorage`.
- **LGPD:** o menu Conta tem "Excluir conta e todos os dados (LGPD)". `DELETE /api/account` apaga usuário, sessões, chaves e candidaturas no banco e limpa o cofre local.

Variáveis: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `KEY_ENCRYPTION_SECRET`, `KEY_ENCRYPTION_KEK_VERSION`, `KEY_ENCRYPTION_SECRET_PREVIOUS`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`. O exemplo está no `.env.example`.

## Fora deste código

- DOCX e PDF escaneado. O app aceita só PDF com texto e responde "Por enquanto só aceitamos CV em PDF." ou, no PDF sem texto, que o arquivo parece escaneado.
- Provedores pagos no seletor. OpenAI, Anthropic e Together permanecem ocultos enquanto `FREE_TIER_ONLY` estiver ligado.
