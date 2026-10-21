/**
 * Contexto anônimo de uma chamada de modelo.
 * Só estes campos podem ir para span, metadata ou log. Nunca o CV, a vaga, a chave ou o IP.
 */

export const SESSION_HEADER = "x-matchcv-session";
export const ATTEMPT_HEADER = "x-matchcv-attempt";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ModelCallContext {
  sessionId: string;
  provider: string;
  model: string;
  artifact: string;
  attempt: string;
}

export function isSessionId(value: string): boolean {
  return UUID_RE.test(value);
}

function clip(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const clean = value.replace(/[\r\n]/g, " ").trim().slice(0, 80);
  return clean || fallback;
}

/** Descarta qualquer campo além dos cinco permitidos. */
export function sanitizeModelCallContext(input: object): ModelCallContext {
  const record = input as Record<string, unknown>;
  const session = typeof record.sessionId === "string" && UUID_RE.test(record.sessionId) ? record.sessionId.toLowerCase() : "none";
  const attempt = typeof record.attempt === "string" && /^[1-9]\d?$/.test(record.attempt) ? record.attempt : "1";
  return {
    sessionId: session,
    provider: clip(record.provider, "unknown"),
    model: clip(record.model, "unknown"),
    artifact: clip(record.artifact, "unknown"),
    attempt,
  };
}

export function readModelCallContext(
  req: Request,
  fallback: { provider: string; model: string; artifact: string },
): ModelCallContext {
  return sanitizeModelCallContext({
    sessionId: req.headers.get(SESSION_HEADER) ?? "",
    attempt: req.headers.get(ATTEMPT_HEADER) ?? "",
    provider: fallback.provider,
    model: fallback.model,
    artifact: fallback.artifact,
  });
}

export function modelSpanAttributes(input: object): Record<string, string> {
  const safe = sanitizeModelCallContext(input);
  return {
    "matchcv.session_id": safe.sessionId,
    "matchcv.provider": safe.provider,
    "matchcv.model": safe.model,
    "matchcv.artifact": safe.artifact,
    "matchcv.attempt": safe.attempt,
  };
}

/**
 * Opções do AI SDK. `metadata` viaja no objeto (o SDK 7 não declara o campo)
 * e os mesmos cinco valores vão em runtimeContext, que o SDK sabe filtrar.
 * recordInputs e recordOutputs ficam desligados para o prompt e a resposta
 * não entrarem na telemetria.
 */
export function modelTelemetry(input: object) {
  const metadata = sanitizeModelCallContext(input);
  const telemetry = {
    isEnabled: true as const,
    recordInputs: false as const,
    recordOutputs: false as const,
    functionId: `matchcv.${metadata.artifact}`,
    metadata,
    includeRuntimeContext: {
      sessionId: true,
      provider: true,
      model: true,
      artifact: true,
      attempt: true,
    },
  };
  const runtimeContext: Record<string, string> = { ...metadata };
  return {
    experimental_telemetry: telemetry,
    telemetry,
    runtimeContext,
  };
}
