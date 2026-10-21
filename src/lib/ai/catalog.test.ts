import { describe, expect, it } from "vitest";

import {
  FREE_TIER_ONLY,
  PROVIDERS,
  defaultSelectableProvider,
  selectableModels,
  selectableProviders,
} from "./catalog";

describe("catálogo só com modelos de chave gratuita", () => {
  it("mostra os Flash grátis do Google e todos os :free da OpenRouter", () => {
    expect(FREE_TIER_ONLY).toBe(true);
    expect(defaultSelectableProvider()).toBe("google");
    expect(PROVIDERS.google.defaultModel).toBe("gemini-3.8-flash");
    expect(selectableModels(PROVIDERS.google).map((model) => model.id)).toEqual([
      "gemini-3.8-flash",
      "gemini-3.6-flash",
      "gemini-3.5-flash-lite",
      "gemini-3.1-flash-lite",
    ]);
    const openrouter = selectableModels(PROVIDERS.openrouter);
    expect(openrouter.every((model) => model.id === "openrouter/free" || model.id.endsWith(":free"))).toBe(true);
    expect(openrouter.map((model) => model.id)).toContain("openrouter/free");
    expect(openrouter.map((model) => model.id)).toContain("nvidia/nemotron-3-super-120b-a12b:free");
    expect(openrouter.length).toBeGreaterThanOrEqual(18);
    expect(selectableProviders().map((provider) => provider.id)).toEqual(["google", "openrouter"]);
  });

  it("esconde OpenAI, Anthropic e Together e mantém os modelos pagos no catálogo", () => {
    for (const id of ["openai", "anthropic", "together"] as const) {
      expect(PROVIDERS[id].free).toBe(false);
      expect(PROVIDERS[id].models.length).toBeGreaterThan(0);
      expect(PROVIDERS[id].models.every((model) => model.paidOnly)).toBe(true);
      expect(selectableModels(PROVIDERS[id])).toEqual([]);
    }
    const visible = selectableProviders().map((provider) => provider.id);
    expect(visible).not.toContain("openai");
    expect(visible).not.toContain("anthropic");
    expect(visible).not.toContain("together");
  });
});
