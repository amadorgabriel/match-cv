import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildWebSearchRequest, supportsNativeWebSearch } from "./providers";

describe("busca nativa na web", () => {
  it("só liga a ferramenta nos provedores que têm busca", () => {
    expect(supportsNativeWebSearch("openai")).toBe(true);
    expect(supportsNativeWebSearch("anthropic")).toBe(true);
    expect(supportsNativeWebSearch("google")).toBe(true);
    expect(supportsNativeWebSearch("together")).toBe(false);
    expect(supportsNativeWebSearch("openrouter")).toBe(false);
    expect(buildWebSearchRequest("together", "Qwen/Qwen3.8-2.4T-A95B", "together-test-key")).toBeNull();
    expect(buildWebSearchRequest("openrouter", "qwen/qwen3.8-max", "sk-or-test-key")).toBeNull();
    expect(buildWebSearchRequest("openai", "id inválido", "sk-test-key-1234")).toBeNull();
  });

  it("monta a ferramenta de cada provedor sem disparar a rede", () => {
    expect(buildWebSearchRequest("openai", "gpt-6.1-sol", "sk-test-key-1234")?.tools).toHaveProperty("web_search");
    expect(buildWebSearchRequest("anthropic", "claude-sonnet-5-5", "sk-ant-test-key")?.tools).toHaveProperty("web_search");
    expect(buildWebSearchRequest("google", "gemini-3.8-flash", "AIza-test-key-123456")?.tools).toHaveProperty("google_search");
  });
});
