import { APICallError } from "@ai-sdk/provider";
import { RetryError } from "ai";

import { parseRetryAfterValue } from "@/lib/async/pool";

export interface ProviderHttpFailure {
  statusCode: number;
  retryAfterSec?: number;
}

/**
 * Lê o status HTTP de um AI_APICallError, inclusive quando vem dentro
 * de um AI_RetryError. Não lê o corpo: ele pode ecoar a chave.
 */
export function readProviderHttpFailure(error: unknown): ProviderHttpFailure | null {
  const api = findApiCall(error, 0);
  if (!api || api.statusCode === undefined) return null;
  return {
    statusCode: api.statusCode,
    retryAfterSec: retryAfterFromHeaders(api.responseHeaders),
  };
}

/** Mensagem de 429 em pt-BR. `seconds` sempre entra no texto. */
export function providerRateLimitMessage(seconds: number): string {
  return `Limite do plano grátis do provedor. Tentando de novo em ${seconds} s`;
}

function findApiCall(error: unknown, depth: number): APICallError | null {
  if (depth > 5 || error == null || typeof error !== "object") return null;
  if (APICallError.isInstance(error)) return error;
  if (isApiCallShape(error)) return error as APICallError;
  if (RetryError.isInstance(error) || isRetryShape(error)) {
    const retry = error as { lastError?: unknown; errors?: unknown[]; cause?: unknown };
    const fromLast = findApiCall(retry.lastError, depth + 1);
    if (fromLast) return fromLast;
    for (const nested of retry.errors ?? []) {
      const found = findApiCall(nested, depth + 1);
      if (found) return found;
    }
  }
  if ("cause" in error) return findApiCall((error as { cause?: unknown }).cause, depth + 1);
  return null;
}

function isApiCallShape(error: object): boolean {
  const candidate = error as { name?: string; statusCode?: unknown };
  return candidate.name === "AI_APICallError" && typeof candidate.statusCode === "number";
}

function isRetryShape(error: object): boolean {
  return (error as { name?: string }).name === "AI_RetryError";
}

function retryAfterFromHeaders(headers?: Record<string, string>): number | undefined {
  if (!headers) return undefined;
  const raw = headers["retry-after"] ?? headers["Retry-After"];
  return parseRetryAfterValue(raw);
}
