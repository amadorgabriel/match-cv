import { describe, expect, it } from "vitest";

import { PROVIDERS, selectableModels } from "./catalog";

describe("catálogo do Gemini", () => {
  it("mantém o Flash como padrão e deixa o Argon só como aviso de plano pago", () => {
    const google = PROVIDERS.google;
    expect(google.defaultModel).toBe("gemini-3.8-flash");
    const argon = google.models.find((model) => model.id === "gemini-4-argon");
    expect(argon?.paidOnly).toBe(true);
    expect(argon?.label).toContain("pago — exige chave com faturamento");
    expect(selectableModels(google).map((model) => model.id)).toEqual(["gemini-3.8-flash"]);
  });
});
