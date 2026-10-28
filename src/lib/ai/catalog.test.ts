import { describe, expect, it } from "vitest";

import {
  FREE_TIER_ONLY,
  PROVIDERS,
  defaultSelectableProvider,
  isFreeModel,
  selectableModels,
  selectableProviders,
} from "./catalog";

describe("catálogo com modelos gratuitos e pagos", () => {
  it("mantém o Google gratuito como padrão e mostra os cinco provedores", () => {
    expect(FREE_TIER_ONLY).toBe(false);
    expect(defaultSelectableProvider()).toBe("google");
    expect(PROVIDERS.google.defaultModel).toBe("gemini-3.8-flash");
    expect(isFreeModel(PROVIDERS.google.models[0]!)).toBe(true);
    expect(selectableProviders().map((provider) => provider.id)).toEqual([
      "openai",
      "anthropic",
      "google",
      "together",
      "openrouter",
    ]);
  });

  it("marca cada modelo como gratuito ou pago e deixa o filtro esconder os pagos", () => {
    for (const provider of Object.values(PROVIDERS)) {
      expect(provider.models.length).toBeGreaterThan(0);
      for (const model of provider.models) {
        expect(model.free).toBe(model.tier === "free");
        expect(model.tier === "free" || model.tier === "paid").toBe(true);
      }
    }
    expect(selectableModels(PROVIDERS.google).map((model) => model.id)).toContain("gemini-4-argon");
    expect(selectableModels(PROVIDERS.google, { freeOnly: true }).every((model) => model.free)).toBe(true);
    expect(selectableModels(PROVIDERS.openai, { freeOnly: true })).toEqual([]);
    expect(selectableProviders({ freeOnly: true }).map((provider) => provider.id)).toEqual(["google", "openrouter"]);
    expect(PROVIDERS.openrouter.models.some((model) => model.id.endsWith(":free"))).toBe(true);
    expect(PROVIDERS.openrouter.models.some((model) => model.tier === "paid")).toBe(true);
    expect(PROVIDERS.together.models.every((model) => model.tier === "paid")).toBe(true);
  });
});
