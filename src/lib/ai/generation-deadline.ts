/**
 * O proxy do `next dev` fecha a conexão aos 30s (ERR_EMPTY_RESPONSE) se a
 * rota não responder. O prazo da geração fica abaixo do proxyTimeout (130s)
 * e do maxDuration (120s), para a rota ainda devolver JSON.
 */
export const GENERATION_DEADLINE_MS = 100_000;

export const PROVIDER_SLOW_MESSAGE =
  "O modelo gratuito demorou demais ou atingiu o limite. Tente outro modelo.";

export function generationDeadlineMs(): number {
  const raw = Number(process.env.MATCHCV_GENERATION_DEADLINE_MS);
  if (Number.isFinite(raw) && raw >= 0) return raw;
  return GENERATION_DEADLINE_MS;
}

/** Aborta no prazo ou quando o cliente cancela. `timedOut` só é o prazo nosso. */
export function withGenerationDeadline(parent?: AbortSignal, ms = generationDeadlineMs()): {
  signal: AbortSignal;
  timedOut: () => boolean;
} {
  const controller = new AbortController();
  let fromDeadline = false;
  const timer = setTimeout(() => {
    fromDeadline = true;
    controller.abort(timeoutError());
  }, ms);
  const onParent = () => controller.abort(parent?.reason);
  const stop = () => {
    clearTimeout(timer);
    parent?.removeEventListener("abort", onParent);
  };
  controller.signal.addEventListener("abort", stop, { once: true });
  if (parent?.aborted) onParent();
  else parent?.addEventListener("abort", onParent, { once: true });
  return {
    signal: controller.signal,
    timedOut: () => fromDeadline && !parent?.aborted,
  };
}

export function isProviderTimeout(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = (error as { name?: string }).name;
  if (name === "TimeoutError") return true;
  const message = `${(error as { message?: string }).message ?? ""} ${(error as { cause?: { code?: string; message?: string } }).cause?.code ?? ""} ${(error as { cause?: { message?: string } }).cause?.message ?? ""}`;
  return /timeout|timed out|ECONNRESET|EPIPE|socket hang up|other side closed|fetch failed|UND_ERR_HEADERS_TIMEOUT|UND_ERR_BODY_TIMEOUT|UND_ERR_SOCKET/i.test(
    message,
  );
}

function timeoutError(): Error {
  const error = new Error("generation_deadline");
  error.name = "TimeoutError";
  return error;
}
