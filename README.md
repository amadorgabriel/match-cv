# MatchCV

Produção: https://match-cv-app.vercel.app/

Plataforma web **sem login** para candidaturas a vagas de TI. O usuário envia o currículo em PDF e a descrição da vaga, escolhe um provedor de IA gratuito, informa a própria API key e recebe cinco materiais:

1. **CV em PDF compatível com ATS**, alinhado à vaga
2. **E-mail** para a empresa (com botão de copiar)
3. **Cover letter** (com botão de copiar e conversão para PDF)
4. **Roteiro de entrevista** em seções expansíveis
5. **Faixa salarial** estimada, com as fontes citadas e um link para o Glassdoor

O modelo é BYOK (*bring your own key*): cada usuário paga o próprio uso de IA. A chave, o currículo e o perfil extraído ficam só na memória do navegador.

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
| Telemetria | `@vercel/otel` e, se configurado, `@langfuse/otel` |
| Testes | Vitest |
| Hospedagem | Vercel |

## Estrutura de pastas

```
MatchCV/
├─ .env.example
├─ favicon.ico                # pedido na raiz; o Next não serve este arquivo sozinho
├─ next.config.ts             # headers de segurança e proxyTimeout
├─ src/
│  ├─ instrumentation.ts      # OpenTelemetry no runtime Node
│  ├─ proxy.ts                # CSP com nonce
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

As chamadas de saída para OpenAI, Anthropic, Google, Together e OpenRouter ficam de fora do tracing de `fetch`, para os headers de autorização não virarem span.

## Deploy na Vercel

1. Importe o repositório em https://vercel.com/new.
2. Para IA real, cadastre `MATCHCV_ENABLE_AI=true`. As variáveis do Langfuse são opcionais.
3. Para o rate limit durável, crie o Redis Upstash no Marketplace e conecte a este projeto. O passo a passo está na seção seguinte. Sem essas variáveis o limite continua em memória.
4. Use Node.js 24.

O plano Hobby é gratuito e vale para uso pessoal e não comercial.

## Segurança

- CSP com nonce em `src/proxy.ts` (`connect-src 'self'`, `frame-src 'self' blob:`, `object-src blob:`). `style-src` ainda tem `unsafe-inline`. Os outros headers de segurança ficam em `next.config.ts`.
- A saída do modelo é texto puro, sem `dangerouslySetInnerHTML`.
- Rate limit por IP em todas as rotas de API. Com Upstash Redis a janela deslizante vale entre instâncias. Sem as variáveis, ou se o Redis falha, o limite em memória desta instância assume.
- `logApiError` e `logApiWarning` mascaram `sk-`, `sk-ant-`, `sk-or-`, `AIza`, `Bearer`, `app_key` e os segredos passados na chamada. A resposta de erro não devolve a chave nem o corpo.

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

Num disparo seguido, com a janela anterior vazia, o pedido da última coluna recebe 429. Perto da fronteira da janela, o peso da janela anterior também conta.

## Fora deste código

- Login, banco e chave de API persistida.
- DOCX e PDF escaneado. O app aceita só PDF com texto e responde "Por enquanto só aceitamos CV em PDF." ou, no PDF sem texto, que o arquivo parece escaneado.
- Provedores pagos no seletor. OpenAI, Anthropic e Together permanecem ocultos enquanto `FREE_TIER_ONLY` estiver ligado.
