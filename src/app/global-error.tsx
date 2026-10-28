"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

import { readSentryDsn } from "@/lib/observability/sentry-env";

export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    if (!readSentryDsn({ NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN })) return;
    const digest = typeof error === "object" && error && "digest" in error ? String(error.digest ?? "") : "";
    Sentry.withScope((scope) => {
      if (digest) scope.setTag("digest", digest.slice(0, 80));
      Sentry.captureException(error);
    });
  }, [error]);

  return (
    <html lang="pt-BR">
      <head>
        <title>Erro | MatchCV</title>
      </head>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#fafafa",
          color: "#171717",
        }}
      >
        <main style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>Algo deu errado</h1>
          <p style={{ lineHeight: 1.5 }}>Recarregue a página. Se continuar, tente de novo em instantes.</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              marginTop: 16,
              border: 0,
              borderRadius: 8,
              padding: "10px 16px",
              background: "#171717",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Tentar de novo
          </button>
        </main>
      </body>
    </html>
  );
}
