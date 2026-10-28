# Arquitetura de autenticação e dados

Escolha: **Better Auth** com **Drizzle ORM** sobre **Postgres** (Supabase Postgres ou Neon). O modo anônimo do MVP continua sendo o caminho padrão.

## Quando cada modo vale

| Ambiente | O que acontece |
|---|---|
| Sem `DATABASE_URL` | Login desligado. Candidaturas em `localStorage`. Chave de IA num cookie `HttpOnly` cifrado com AES-256-GCM. |
| `DATABASE_URL` + `BETTER_AUTH_SECRET` (32+ caracteres) | Better Auth ativo: magic link por e-mail e OAuth GitHub/Google quando os client ids existem. |
| Usuário autenticado com banco | Chaves em `saved_api_keys` e candidaturas em `job_applications`. |
| Banco configurado, mas a conexão falha | A sessão não é exigida. O app volta ao cofre local e ao `localStorage` para não derrubar o fluxo anônimo. |

## Better Auth

- Rotas em `/api/auth/*` (`src/app/api/auth/[...all]/route.ts`).
- Tabelas `users`, `sessions`, `accounts` e `verifications`, com os campos que o Better Auth espera e nomes SQL em snake_case.
- Magic link: `POST /api/auth/sign-in/magic-link`. Com `RESEND_API_KEY` e `EMAIL_FROM`, o link sai por e-mail. Fora de produção, sem SMTP, `GET /api/auth/dev/magic-link?email=` devolve o link para teste. Em produção essa rota responde 404 e o link não é logado.
- OAuth: GitHub e Google só entram na configuração quando o par de client id/secret existe. A UI mostra o botão desabilitado quando o provedor não está configurado.
- `DELETE /api/account` faz hard delete do usuário. As FKs `ON DELETE CASCADE` apagam sessões, contas ligadas, chaves e candidaturas. Verificações saem pelo e-mail. O cookie do cofre e os cookies de sessão são limpos. O navegador também apaga `localStorage` e a chave da aba.

## Chave de API

Envelope encryption em `src/lib/security/envelope-encryption.ts`:

1. Uma DEK aleatória de 256 bits cifra a API key com AES-256-GCM (IV de 12 bytes e auth tag de 16 bytes).
2. A DEK é embrulhada com a KEK derivada por HKDF-SHA256.
3. A KEK vem de `KEY_ENCRYPTION_SECRET`. Sem ela, o desenvolvimento usa `BETTER_AUTH_SECRET`. Sem os dois, fora de produção há um fallback local só para o recurso funcionar; em produção salvar a chave responde 503.
4. `KEY_ENCRYPTION_KEK_VERSION` marca a versão. `KEY_ENCRYPTION_SECRET_Vn` ou `KEY_ENCRYPTION_SECRET_PREVIOUS` leem envelopes antigos.

`GET`, `POST` e `DELETE /api/keys` devolvem só `id`, `provider`, `last4`, `status` (`active` ou `invalid`), `createdAt` e `updatedAt`. A chave é validada com a mesma checagem de `/api/key/validate` antes de gravar ou trocar. Excluir é hard delete. Cada decifragem, gravação e exclusão gera um log `key_audit` com `userId`, `provider` e `last4`.

A decifragem acontece no handler quando o corpo traz `useSavedKey: true`. Sem Postgres, o cofre é o cookie `matchcv_key_vault`, cifrado de novo com AES-256-GCM e marcado `HttpOnly`.

## Candidaturas

`src/lib/applications/store.ts` é a camada híbrida. Com sessão e `DATABASE_URL`, `/api/applications` grava no Postgres. Sem sessão, o navegador usa `localStorage` (`matchcv:applications`) e, ao entrar numa conta, copia esses itens para o banco. O dashboard em `/dashboard` lista empresa, vaga, data e status (`aplicado`, `entrevista`, `oferta`, `recusado`), filtra, busca, edita status e anotações, abre os cinco materiais e exclui a candidatura. O PDF do CV e da cover letter é gerado na hora a partir do JSON salvo, então a exclusão da conta não deixa arquivo órfão.
