import { registerOTel } from "@vercel/otel";

import { redactSecrets } from "@/lib/security/redact";

/** Só o span criado por nós, identificado pelo artefato. */
export function isMatchcvSpan(attributes: Record<string, unknown> | undefined): boolean {
  return typeof attributes?.["matchcv.artifact"] === "string";
}

/** Mascara chave que tenha vazado para um atributo de texto. */
export function maskTelemetryData(data: unknown): unknown {
  return typeof data === "string" ? redactSecrets(data) : data;
}

/**
 * OpenTelemetry da Vercel. O exporter do Langfuse só é criado quando
 * LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY e LANGFUSE_BASEURL existem.
 */
export async function registerNodeTelemetry(): Promise<void> {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const baseUrl = process.env.LANGFUSE_BASEURL;
  const spanProcessors = [];
  if (publicKey && secretKey && baseUrl) {
    const { LangfuseSpanProcessor } = await import("@langfuse/otel");
    spanProcessors.push(
      new LangfuseSpanProcessor({
        publicKey,
        secretKey,
        baseUrl,
        exportMode: "immediate",
        shouldExportSpan: ({ otelSpan }) => isMatchcvSpan(otelSpan.attributes),
        mask: ({ data }) => maskTelemetryData(data),
      }),
    );
  }
  registerOTel({
    serviceName: "matchcv",
    spanProcessors,
    instrumentations: ["fetch"],
    instrumentationConfig: {
      fetch: {
        ignoreUrls: [
          /api\.adzuna\.com/,
          /api\.openai\.com/,
          /api\.anthropic\.com/,
          /generativelanguage\.googleapis\.com/,
          /api\.together\.xyz/,
          /openrouter\.ai/,
        ],
      },
    },
  });
}
