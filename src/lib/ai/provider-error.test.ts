import { APICallError } from "@ai-sdk/provider";
import { RetryError } from "ai";
import { describe, expect, it } from "vitest";

import { providerRateLimitMessage, readProviderHttpFailure } from "./provider-error";

function rateLimit(headers?: Record<string, string>) {
  return new APICallError({
    message: "too many requests",
    url: "https://generativelanguage.googleapis.com/v1beta/models",
    requestBodyValues: { contents: [] },
    statusCode: 429,
    responseHeaders: headers,
    isRetryable: true,
  });
}

describe("readProviderHttpFailure", () => {
  it("lê 429 direto e o Retry-After do provedor", () => {
    expect(readProviderHttpFailure(rateLimit({ "retry-after": "8" }))).toEqual({
      statusCode: 429,
      retryAfterSec: 8,
    });
    expect(providerRateLimitMessage(8)).toBe("Limite do plano grátis do provedor. Tentando de novo em 8 s");
  });

  it("desembrulha AI_RetryError que guarda o 429", () => {
    const wrapped = new RetryError({
      message: "Failed after 2 attempts",
      reason: "maxRetriesExceeded",
      errors: [rateLimit({ "Retry-After": "15" })],
    });
    expect(readProviderHttpFailure(wrapped)).toEqual({ statusCode: 429, retryAfterSec: 15 });
  });

  it("reconhece o erro pelo nome quando não é a instância da classe", () => {
    const duck = {
      name: "AI_RetryError",
      lastError: { name: "AI_APICallError", statusCode: 429, responseHeaders: { "retry-after": "3" } },
    };
    expect(readProviderHttpFailure(duck)).toEqual({ statusCode: 429, retryAfterSec: 3 });
  });

  it("ignora falhas que não são HTTP do provedor", () => {
    expect(readProviderHttpFailure(new Error("rede"))).toBeNull();
    expect(readProviderHttpFailure(rateLimit())).toEqual({ statusCode: 429, retryAfterSec: undefined });
  });
});
