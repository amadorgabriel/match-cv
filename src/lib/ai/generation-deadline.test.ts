import { describe, expect, it } from "vitest";

import { isProviderTimeout, PROVIDER_SLOW_MESSAGE, withGenerationDeadline } from "./generation-deadline";

describe("withGenerationDeadline", () => {
  it("aborta no prazo e marca timedOut", async () => {
    const deadline = withGenerationDeadline(undefined, 15);
    await new Promise((resolve) => deadline.signal.addEventListener("abort", resolve));
    expect(deadline.timedOut()).toBe(true);
    expect(deadline.signal.reason).toMatchObject({ name: "TimeoutError" });
  });

  it("não trata o cancelamento do cliente como timeout do modelo", () => {
    const parent = new AbortController();
    const deadline = withGenerationDeadline(parent.signal, 10_000);
    parent.abort();
    expect(deadline.signal.aborted).toBe(true);
    expect(deadline.timedOut()).toBe(false);
  });
});

describe("isProviderTimeout", () => {
  it("reconhece queda de conexão do provedor", () => {
    expect(isProviderTimeout(Object.assign(new Error("fetch failed"), { cause: { code: "ECONNRESET" } }))).toBe(true);
    expect(isProviderTimeout(new Error("schema"))).toBe(false);
    expect(PROVIDER_SLOW_MESSAGE).toMatch(/demorou demais/);
  });
});
