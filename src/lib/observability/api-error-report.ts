import { sanitizeModelCallContext } from "@/lib/ai/telemetry-context";
import { redactSecrets } from "@/lib/security/secrets";

import { clipErrorMessage } from "./sentry-env";
import { scrubString } from "./sentry-scrub";

export interface ApiErrorInput {
  route: string;
  error: unknown;
  statusCode?: number;
  provider?: string;
  model?: string;
  artifact?: string;
  durationMs?: number;
  secrets?: Array<string | undefined>;
}

export interface ApiErrorReport {
  name: string;
  message: string;
  stack?: string;
  level: "error" | "warning";
  tags: {
    route: string;
    artifact: string;
    provider: string;
    model: string;
    status_code: string;
  };
}

function tag(value: string, secrets: Array<string | undefined>): string {
  return redactSecrets(value, secrets).replace(/[\r\n]/g, " ").trim().slice(0, 80) || "unknown";
}

/** Payload que vai para o Sentry. Não inclui a chave, o CV nem a vaga. */
export function buildApiErrorReport(input: ApiErrorInput): ApiErrorReport {
  const context = sanitizeModelCallContext({
    provider: input.provider,
    model: input.model,
    artifact: input.artifact,
  });
  const name = input.error instanceof Error ? input.error.name : "Error";
  const raw = input.error instanceof Error ? input.error.message : String(input.error);
  const secrets = input.secrets ?? [];
  const message = clipErrorMessage(scrubString(`${name}: ${raw}`, secrets));
  const omitted = message.endsWith("[mensagem omitida]");
  const stack =
    !omitted && input.error instanceof Error && input.error.stack
      ? scrubString(input.error.stack, secrets).slice(0, 2_000)
      : undefined;
  const status = input.statusCode;
  return {
    name,
    message,
    stack,
    level: status !== undefined && status < 500 ? "warning" : "error",
    tags: {
      route: tag(input.route, secrets),
      artifact: tag(context.artifact, secrets),
      provider: tag(context.provider, secrets),
      model: tag(context.model, secrets),
      status_code: status === undefined ? "unknown" : String(status),
    },
  };
}
