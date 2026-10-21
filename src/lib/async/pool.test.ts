import { describe, expect, it } from "vitest";

import { mapWithConcurrency, parseRetryAfterValue, retryAsync, retryDelayMs } from "./pool";

describe("mapWithConcurrency", () => {
  it("preserva a ordem e não passa do limite", async () => {
    let active = 0;
    let maxActive = 0;
    const results = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (item) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active -= 1;
      return item * 10;
    });
    expect(results).toEqual([10, 20, 30, 40, 50]);
    expect(maxActive).toBeLessThanOrEqual(2);
    expect(maxActive).toBe(2);
  });

  it("propaga a falha de um item", async () => {
    await expect(
      mapWithConcurrency([1, 2], 2, async (item) => {
        if (item === 2) throw new Error("falhou");
        return item;
      }),
    ).rejects.toThrow("falhou");
  });
});

describe("retryAsync", () => {
  it("repete 429 honrando Retry-After e para ao sucesso", async () => {
    const waits: number[] = [];
    let calls = 0;
    const value = await retryAsync(
      async () => {
        calls += 1;
        if (calls < 3) {
          const error = new Error("limite") as Error & { status: number; retryAfterSec: number };
          error.status = 429;
          error.retryAfterSec = 4;
          throw error;
        }
        return "ok";
      },
      {
        attempts: 3,
        shouldRetry: (error) => (error as { status?: number }).status === 429,
        delayMs: (error, attempt) => retryDelayMs(attempt, (error as { retryAfterSec?: number }).retryAfterSec, () => 0.99),
        sleep: async (ms) => {
          waits.push(ms);
        },
      },
    );
    expect(value).toBe("ok");
    expect(calls).toBe(3);
    expect(waits).toEqual([4000, 4000]);
  });

  it("usa backoff exponencial com jitter quando não há Retry-After", () => {
    expect(retryDelayMs(1, undefined, () => 0)).toBe(1000);
    expect(retryDelayMs(2, undefined, () => 0)).toBe(2000);
    expect(retryDelayMs(3, undefined, () => 1)).toBe(4000 + 1000);
  });

  it("desiste depois de 3 tentativas em 5xx e não repete 400", async () => {
    let serverErrors = 0;
    await expect(
      retryAsync(
        async () => {
          serverErrors += 1;
          const error = new Error("indisponível") as Error & { status: number };
          error.status = 503;
          throw error;
        },
        {
          attempts: 3,
          shouldRetry: (error) => (error as { status?: number }).status === 503,
          delayMs: (_error, attempt) => retryDelayMs(attempt, undefined, () => 0),
          sleep: async () => {},
        },
      ),
    ).rejects.toThrow("indisponível");
    expect(serverErrors).toBe(3);

    let clientErrors = 0;
    await expect(
      retryAsync(
        async () => {
          clientErrors += 1;
          const error = new Error("inválido") as Error & { status: number };
          error.status = 400;
          throw error;
        },
        {
          attempts: 3,
          shouldRetry: (error) => {
            const status = (error as { status?: number }).status ?? 0;
            return status === 429 || status >= 500;
          },
          delayMs: () => 0,
          sleep: async () => {},
        },
      ),
    ).rejects.toThrow("inválido");
    expect(clientErrors).toBe(1);
  });
});

describe("parseRetryAfterValue", () => {
  it("lê segundos e data HTTP", () => {
    expect(parseRetryAfterValue("12")).toBe(12);
    expect(parseRetryAfterValue("0")).toBe(0);
    const now = Date.parse("2026-10-21T00:00:00Z");
    expect(parseRetryAfterValue("Wed, 21 Oct 2026 00:00:20 GMT", now)).toBe(20);
    expect(parseRetryAfterValue("não é data")).toBeUndefined();
  });
});
