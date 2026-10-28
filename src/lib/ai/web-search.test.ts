import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildWebSearchRequest, openRouterWebModelId, supportsNativeWebSearch, supportsSalaryWebSearch } from "./providers";

describe("busca nativa na web", () => {
  it("só liga a ferramenta nativa nos provedores que têm busca", () => {
    expect(supportsNativeWebSearch("openai")).toBe(true);
    expect(supportsNativeWebSearch("anthropic")).toBe(true);
    expect(supportsNativeWebSearch("google")).toBe(true);
    expect(supportsNativeWebSearch("together")).toBe(false);
    expect(supportsNativeWebSearch("openrouter")).toBe(false);
    expect(supportsSalaryWebSearch("openrouter")).toBe(true);
    expect(supportsSalaryWebSearch("together")).toBe(false);
    expect(buildWebSearchRequest("together", "Qwen/Qwen3.8-2.4T-A95B", "together-test-key")).toBeNull();
    expect(buildWebSearchRequest("openai", "id inválido", "sk-test-key-1234")).toBeNull();
  });

  it("liga a busca salarial do OpenRouter com o sufixo :online e a baseURL fixa", () => {
    expect(openRouterWebModelId("google/gemma-4-31b-it:free")).toBe("google/gemma-4-31b-it:free:online");
    expect(openRouterWebModelId("openrouter/free:online")).toBe("openrouter/free:online");
    const request = buildWebSearchRequest("openrouter", "openrouter/free", "sk-or-v1-test-key-123456");
    expect(request?.tools).toBeUndefined();
    const model = request?.model;
    if (!model || typeof model === "string") throw new Error("modelo do OpenRouter não foi criado");
    expect(model.modelId).toBe("openrouter/free:online");
    const config = (model as { config?: { url?: (args: { path: string; modelId: string }) => string } }).config;
    const url = config?.url?.({ path: "/chat/completions", modelId: "openrouter/free:online" });
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(url).not.toContain("sk-or-");
    expect(JSON.stringify({ provider: model.provider, modelId: model.modelId })).not.toContain("sk-or-");
  });

  it("monta a ferramenta de cada provedor sem disparar a rede", () => {
    expect(buildWebSearchRequest("openai", "gpt-6.1-sol", "sk-test-key-1234")?.tools).toHaveProperty("web_search");
    expect(buildWebSearchRequest("anthropic", "claude-sonnet-5-5", "sk-ant-test-key")?.tools).toHaveProperty("web_search");
    expect(buildWebSearchRequest("google", "gemini-3.8-flash", "AIza-test-key-123456")?.tools).toHaveProperty("google_search");
  });
});
