import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const generateArtifact = vi.fn();
vi.mock("@/lib/ai/generate", () => ({
  generateArtifact: (...args: unknown[]) => generateArtifact(...args),
}));

import { PROVIDER_SLOW_MESSAGE } from "@/lib/ai/generation-deadline";

import { POST } from "./route";

const body = {
  provider: "openrouter",
  model: "openrouter/free",
  apiKey: "sk-or-test-key-value",
  resumeText: "Currículo de Ana com TypeScript, React e Node.js em São Paulo desde 2020.",
  jobDescription: "Vaga de desenvolvedor full stack pleno. Empresa: Ênfases. Requisitos: TypeScript e React.",
  achievements: "",
  achievementsDocument: "",
};

function request() {
  return new Request("http://localhost/api/generate/cv", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/generate/cv", () => {
  beforeEach(() => {
    generateArtifact.mockReset();
    process.env.MATCHCV_GENERATION_DEADLINE_MS = "30";
  });

  it("devolve JSON quando o modelo estoura o prazo", async () => {
    generateArtifact.mockImplementation((_artifact: unknown, _input: unknown, options: { abortSignal?: AbortSignal }) => {
      return new Promise((_resolve, reject) => {
        const signal = options.abortSignal;
        const fail = () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        if (signal?.aborted) fail();
        else signal?.addEventListener("abort", fail, { once: true });
      });
    });

    const response = await POST(request(), { params: Promise.resolve({ artifact: "cv" }) });
    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toEqual({
      error: { code: "provider_timeout", message: PROVIDER_SLOW_MESSAGE },
    });
  });

  it("devolve JSON quando o provedor fecha a conexão", async () => {
    process.env.MATCHCV_GENERATION_DEADLINE_MS = "10000";
    generateArtifact.mockRejectedValue(Object.assign(new Error("fetch failed"), { cause: { code: "ECONNRESET" } }));

    const response = await POST(request(), { params: Promise.resolve({ artifact: "cv" }) });
    expect(response.status).toBe(504);
    const payload = (await response.json()) as { error: { code: string; message: string } };
    expect(payload.error.code).toBe("provider_timeout");
    expect(payload.error.message).toBe(PROVIDER_SLOW_MESSAGE);
    expect(JSON.stringify(payload)).not.toContain(body.apiKey);
  });
});
