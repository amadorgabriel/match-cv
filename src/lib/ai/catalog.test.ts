import { describe, expect, it } from "vitest";

import {
  FREE_TIER_ONLY,
  PROVIDERS,
  defaultSelectableProvider,
  selectableModels,
  selectableProviders,
} from "./catalog";

describe("catálogo só com modelos de chave gratuita", () => {
  it("mostra Gemini Flash e modelos :free da OpenRouter", () => {
    expect(FREE_TIER_ONLY).toBe(true);
    expect(defaultSelectableProvider()).toBe("google");
    expect(PROVIDERS.google.defaultModel).toBe("gemini-3.8-flash");
    expect(PROVIDERS.google.models.map((model) => model.id)).toEqual(["gemini-3.8-flash"]);
    expect(PROVIDERS.openrouter.models.every((model) => model.id === "openrouter/free" || model.id.endsWith(":free"))).toBe(
      true,
    );
    expect(selectableProviders().map((provider) => provider.id)).toEqual(["google", "openrouter"]);
    expect(selectableModels(PROVIDERS.google).map((model) => model.id)).toEqual(["gemini-3.8-flash"]);
  });

  it("esconde OpenAI, Anthropic e Together sem apagar o catálogo do servidor", () => {
    for (const id of ["openai", "anthropic", "together"] as const) {
      expect(PROVIDERS[id].free).toBe(false);
      expect(PROVIDERS[id].models.length).toBeGreaterThan(0);
    }
    const visible = selectableProviders().map((provider) => provider.id);
    expect(visible).not.toContain("openai");
    expect(visible).not.toContain("anthropic");
    expect(visible).not.toContain("together");
    expect(visible).not.toContain("gemini-4-argon");
  });
});
