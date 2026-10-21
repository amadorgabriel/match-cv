/**
 * Concorrência limitada e retry do fluxo "Gerar tudo".
 * Puro: sem chave, sem fetch e sem dependência de servidor.
 */

/** Chamadas de geração ao mesmo tempo. O salário entra na mesma fila. */
export const GENERATE_CONCURRENCY = 2;

/** O plano grátis do Gemini recusa rajadas. Uma chamada por vez. */
export const GENERATE_CONCURRENCY_GOOGLE = 1;

/** Tentativas totais, incluindo a primeira. */
export const RETRY_ATTEMPTS = 3;

const MAX_RETRY_WAIT_MS = 120_000;

export function concurrencyForProvider(provider: string): number {
  return provider === "google" ? GENERATE_CONCURRENCY_GOOGLE : GENERATE_CONCURRENCY;
}

/**
 * Espera antes da próxima tentativa.
 * Com Retry-After, usa o valor do provedor. Sem ele, backoff exponencial
 * (1s, 2s, 4s...) mais até 25% de jitter.
 */
export function retryDelayMs(failedAttempt: number, retryAfterSec?: number, random: () => number = Math.random): number {
  if (retryAfterSec !== undefined && Number.isFinite(retryAfterSec) && retryAfterSec >= 0) {
    return Math.min(MAX_RETRY_WAIT_MS, Math.round(retryAfterSec * 1000));
  }
  const base = 1000 * 2 ** Math.max(0, failedAttempt - 1);
  const jitter = Math.floor(random() * Math.max(1, Math.round(base * 0.25)));
  return Math.min(MAX_RETRY_WAIT_MS, base + jitter);
}

/** Segundos de um header Retry-After (delta ou data HTTP). */
export function parseRetryAfterValue(raw: string | null | undefined, now = Date.now()): number | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const seconds = Number(trimmed);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const date = Date.parse(trimmed);
  if (Number.isFinite(date)) return Math.max(0, Math.ceil((date - now) / 1000));
  return undefined;
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError(signal));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError(signal));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function abortError(signal?: AbortSignal): Error {
  if (signal?.reason instanceof Error) return signal.reason;
  const error = new Error("Aborted");
  error.name = "AbortError";
  return error;
}

export interface RetryNotice {
  /** Tentativa que acabou de falhar (1 = primeira). */
  attempt: number;
  nextAttempt: number;
  delayMs: number;
  error: unknown;
}

export async function retryAsync<T>(
  fn: (attempt: number) => Promise<T>,
  options: {
    attempts?: number;
    signal?: AbortSignal;
    shouldRetry: (error: unknown, attempt: number) => boolean;
    delayMs: (error: unknown, attempt: number) => number;
    onRetry?: (notice: RetryNotice) => void;
    sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  },
): Promise<T> {
  const attempts = options.attempts ?? RETRY_ATTEMPTS;
  const wait = options.sleep ?? sleep;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !options.shouldRetry(error, attempt)) throw error;
      const delayMs = options.delayMs(error, attempt);
      options.onRetry?.({ attempt, nextAttempt: attempt + 1, delayMs, error });
      await wait(delayMs, options.signal);
    }
  }
  throw lastError;
}

/**
 * Executa `fn` com no máximo `limit` promessas em voo e devolve os
 * resultados na ordem de entrada.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (limit < 1) throw new Error("concurrency_limit");
  const results = new Array<R>(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index] as T, index);
    }
  }

  const workers = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}
