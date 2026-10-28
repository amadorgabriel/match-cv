import { SimpleSpanProcessor, type SpanProcessor } from "@opentelemetry/sdk-trace-base";
import { OTLPHttpJsonTraceExporter, registerOTel } from "@vercel/otel";

import { RedactingSpanProcessor } from "@/lib/observability/redacting-span-processor";
import { readSentryDsn, readTracesSampleRate } from "@/lib/observability/sentry-env";
import { redactSecrets } from "@/lib/security/secrets";

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
async function sentrySpanProcessor(): Promise<SpanProcessor | undefined> {
  const dsn = readSentryDsn();
  if (!dsn) return undefined;
  const { getOtlpTracesEndpoint } = await import("@sentry/nextjs");
  const endpoint = getOtlpTracesEndpoint(dsn);
  if (!endpoint) return undefined;
  return new RedactingSpanProcessor(
    new SimpleSpanProcessor(new OTLPHttpJsonTraceExporter({ url: endpoint.url, headers: endpoint.headers })),
    readTracesSampleRate(),
  );
}

/**
 * Um único tracer provider. `"auto"` mantém o exporter da Vercel.
 * O Sentry só entra como mais um processor, e só com DSN válido.
 * O init do SDK vem depois, com enableOpenTelemetrySetup desligado,
 * para não registrar um segundo provider nem desligar o fetch do Next.
 */
export async function registerNodeTelemetry(): Promise<void> {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const baseUrl = process.env.LANGFUSE_BASEURL;
  const spanProcessors: Array<SpanProcessor | "auto"> = ["auto"];
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
  const sentry = await sentrySpanProcessor();
  if (sentry) spanProcessors.push(sentry);
  registerOTel({
    serviceName: "matchcv",
    spanProcessors,
    instrumentations: ["fetch"],
    instrumentationConfig: {
      fetch: {
        ignoreUrls: [
          /api\.openai\.com/,
          /api\.anthropic\.com/,
          /generativelanguage\.googleapis\.com/,
          /api\.together\.xyz/,
          /openrouter\.ai/,
          /sentry\.io/,
        ],
      },
    },
  });
}
