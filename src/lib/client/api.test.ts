import { describe, expect, it } from "vitest";

import { PROVIDER_SLOW_MESSAGE } from "@/lib/ai/generation-deadline";

import { ApiError, errorFromFailedFetch, isRetryableClientError } from "./api";

describe("erro de geração no cliente", () => {
  it("não repete timeout e traduz conexão vazia", () => {
    const timeout = new ApiError(PROVIDER_SLOW_MESSAGE, 504, "provider_timeout");
    expect(isRetryableClientError(timeout)).toBe(false);
    expect(isRetryableClientError(new ApiError(PROVIDER_SLOW_MESSAGE, 0, "provider_timeout"))).toBe(false);
    expect(isRetryableClientError(new ApiError("limite", 429, "provider_rate_limited"))).toBe(true);
    expect(isRetryableClientError(new ApiError("falhou", 502, "generation_failed"))).toBe(true);

    const dropped = errorFromFailedFetch(new TypeError("Failed to fetch"));
    expect(dropped).toMatchObject({ message: PROVIDER_SLOW_MESSAGE, code: "provider_timeout" });

    const controller = new AbortController();
    controller.abort();
    expect(errorFromFailedFetch(new TypeError("Failed to fetch"), controller.signal)).toBeInstanceOf(TypeError);
  });
});
