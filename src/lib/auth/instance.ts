import "server-only";

import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";

import { appBaseUrl, authProviderFlags } from "@/lib/auth/env";
import { rememberDevMagicLink } from "@/lib/auth/dev-magic-link";
import { getDb } from "@/lib/db";
import { betterAuthSchema } from "@/lib/db/schema";
import { logApiError } from "@/lib/security/redact";

async function deliverMagicLink(email: string, url: string): Promise<void> {
  rememberDevMagicLink(email, url);
  const flags = authProviderFlags();
  if (!flags.emailDelivery) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Envio de e-mail não configurado.");
    }
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: "Seu link de acesso ao MatchCV",
      text: `Use este link para entrar no MatchCV. Ele expira em alguns minutos.\n\n${url}\n`,
    }),
  });
  if (!response.ok && process.env.NODE_ENV === "production") {
    throw new Error("Não foi possível enviar o e-mail de acesso.");
  }
}

export function createAuth() {
  const db = getDb();
  const secret = process.env.BETTER_AUTH_SECRET?.trim();
  if (!db || !secret) throw new Error("Auth não configurada.");

  const flags = authProviderFlags();
  const baseURL = appBaseUrl();
  const github = flags.github
    ? { clientId: process.env.GITHUB_CLIENT_ID!.trim(), clientSecret: process.env.GITHUB_CLIENT_SECRET!.trim() }
    : null;
  const google = flags.google
    ? { clientId: process.env.GOOGLE_CLIENT_ID!.trim(), clientSecret: process.env.GOOGLE_CLIENT_SECRET!.trim() }
    : null;

  return betterAuth({
    appName: "MatchCV",
    baseURL,
    secret,
    trustedOrigins: [baseURL, "http://localhost:3000"],
    database: drizzleAdapter(db, { provider: "pg", schema: betterAuthSchema }),
    socialProviders: {
      ...(github ? { github } : {}),
      ...(google ? { google } : {}),
    },
    rateLimit: { window: 60, max: 20 },
    plugins: [
      magicLink({
        expiresIn: 60 * 10,
        sendMagicLink: async ({ email, url }) => {
          try {
            await deliverMagicLink(email, url);
          } catch (error) {
            await logApiError({
              route: "/api/auth/magic-link",
              error,
              statusCode: 502,
              secrets: [process.env.RESEND_API_KEY, url],
            });
            throw new Error("Não foi possível enviar o link de acesso.");
          }
        },
      }),
      nextCookies(),
    ],
  });
}

export type AuthInstance = ReturnType<typeof createAuth>;
