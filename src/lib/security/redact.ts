import "server-only";

import { sanitizeModelCallContext } from "@/lib/ai/telemetry-context";
import type { ApiErrorInput } from "@/lib/observability/api-error-report";
import { isSentryEnabled } from "@/lib/observability/sentry-env";
import { redactSecrets } from "./secrets";

export { redactSecrets };

function tokenCount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Uso de tokens por chamada. O objeto de entrada pode ter outros campos; eles não entram no log. */
export function logModelUsage(input: object): void {
  const safe = sanitizeModelCallContext(input);
  const record = input as Record<string, unknown>;
  const line = redactSecrets(
    JSON.stringify({
      event: "model_usage",
      sessionId: safe.sessionId,
      provider: safe.provider,
      model: safe.model,
      artifact: safe.artifact,
      attempt: safe.attempt,
      inputTokens: tokenCount(record.inputTokens),
      outputTokens: tokenCount(record.outputTokens),
      totalTokens: tokenCount(record.totalTokens),
    }),
  );
  console.info(line);
}

/** Aviso operacional. A mensagem passa pelo mesmo mascaramento dos erros. */
export function logApiWarning(message: string, secrets: Array<string | undefined> = []): void {
  console.warn(redactSecrets(message, secrets));
}

export async function logApiError(input: ApiErrorInput): Promise<void> {
  const name = input.error instanceof Error ? input.error.name : "Error";
  const raw = input.error instanceof Error ? input.error.message : String(input.error);
  const message = redactSecrets(`${name}: ${raw}`, input.secrets);
  console.error(
    JSON.stringify({
      route: input.route,
      statusCode: input.statusCode ?? null,
      provider: input.provider ?? null,
      model: input.model ?? null,
      artifact: input.artifact ?? null,
      durationMs: input.durationMs ?? null,
      message,
    }),
  );
  if (!isSentryEnabled()) return;
  const { reportApiError } = await import("@/lib/observability/report-api-error");
  await reportApiError(input);
}
