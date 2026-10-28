import { generateText, Output } from "ai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("server-only", () => ({}));

import { PROVIDER_IDS, type ProviderId } from "./catalog";
import { buildModel } from "./providers";

const KEYS: Record<ProviderId, string> = {
  openai: "sk-test-key-1234567890",
  anthropic: "sk-ant-test-key-1234567890",
  google: "AIzaSyTestKey1234567890abcd",
  together: "together-test-key-1234567890",
  openrouter: "sk-or-v1-test-key-1234567890",
};

const MODELS: Record<ProviderId, string> = {
  openai: "gpt-6.1-sol",
  anthropic: "claude-sonnet-5-5",
  google: "gemini-3.8-flash",
  together: "Qwen/Qwen3.8-2.4T-A95B",
  openrouter: "openrouter/free",
};

const ORIGINS: Record<ProviderId, string> = {
  openai: "https://api.openai.com/",
  anthropic: "https://api.anthropic.com/",
  google: "https://generativelanguage.googleapis.com/",
  together: "https://api.together.xyz/v1/",
  openrouter: "https://openrouter.ai/api/v1/",
};

const schema = z.object({ ok: z.literal(true) });

function fakeBody(url: string): unknown {
  const json = JSON.stringify({ ok: true });
  if (url.includes("generativelanguage.googleapis.com")) {
    return {
      candidates: [{ content: { role: "model", parts: [{ text: json }] }, finishReason: "STOP" }],
      usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2, totalTokenCount: 5 },
    };
  }
  if (url.includes("api.anthropic.com")) {
    return {
      id: "msg_test",
      type: "message",
      role: "assistant",
      content: [{ type: "text", text: json }],
      stop_reason: "end_turn",
      usage: { input_tokens: 3, output_tokens: 2 },
    };
  }
  if (url.includes("api.openai.com")) {
    return {
      id: "resp_test",
      output: [
        {
          type: "message",
          role: "assistant",
          id: "msg_test",
          content: [{ type: "output_text", text: json, annotations: [] }],
        },
      ],
      usage: { input_tokens: 3, output_tokens: 2 },
    };
  }
  return {
    id: "chatcmpl-test",
    choices: [{ index: 0, message: { role: "assistant", content: json }, finish_reason: "stop" }],
    usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("buildModel e Output.object", () => {
  it.each(PROVIDER_IDS)("chama %s na baseURL fixa, sem vazar a chave, e lê o objeto", async (provider) => {
    const key = KEYS[provider];
    const calls: Array<{ url: string; headers: Headers; body: string }> = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      calls.push({
        url,
        headers,
        body: typeof init?.body === "string" ? init.body : "",
      });
      return new Response(JSON.stringify(fakeBody(url)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const result = await generateText({
      model: buildModel(provider, MODELS[provider], key),
      prompt: "Responda no schema.",
      output: Output.object({ schema }),
      maxRetries: 0,
    });

    expect(result.output).toEqual({ ok: true });
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call.url.startsWith(ORIGINS[provider])).toBe(true);
      expect(call.url).not.toContain(key);
      expect(call.body).not.toContain(key);
      const headerBlob = [...call.headers.entries()].map(([name, value]) => `${name}: ${value}`).join("\n");
      expect(headerBlob).toContain(key);
    }
  });
});
