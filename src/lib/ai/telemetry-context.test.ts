import { AlwaysOnSampler, InMemorySpanExporter, SimpleSpanProcessor, TracerProvider } from "@opentelemetry/sdk-trace";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { withModelSpan } from "./model-span";
import { isMatchcvSpan, maskTelemetryData } from "./otel-register";
import { modelSpanAttributes, modelTelemetry, readModelCallContext } from "./telemetry-context";

const CV = "Currículo secreto da Ana com TypeScript, React e a empresa Alfa desde 2020.";
const KEY = "sk-or-v1-abcdefghijklmnopqrstuvwxyz";
const SESSION = "11111111-1111-4111-8111-111111111111";

describe("telemetria do modelo", () => {
  it("não coloca CV nem chave no span, na metadata nem no log mascarado", async () => {
    const exporter = new InMemorySpanExporter();
    const provider = new TracerProvider({
      sampler: new AlwaysOnSampler(),
      spanProcessors: [new SimpleSpanProcessor({ exporter })],
    });
    const tracer = provider.getTracer("matchcv");

    const dirty = {
      sessionId: SESSION,
      provider: "openrouter",
      model: "openrouter/free",
      artifact: "cv",
      attempt: "2",
      resumeText: CV,
      jobDescription: "Vaga secreta na empresa Alfa.",
      apiKey: KEY,
    };

    const telemetry = modelTelemetry(dirty);
    const packed = JSON.stringify({ telemetry, attributes: modelSpanAttributes(dirty) });
    expect(packed).toContain(SESSION);
    expect(packed).toContain("matchcv.cv");
    expect(packed).not.toContain(CV);
    expect(packed).not.toContain("Vaga secreta");
    expect(packed).not.toContain(KEY);
    expect(telemetry.experimental_telemetry.recordInputs).toBe(false);
    expect(telemetry.experimental_telemetry.recordOutputs).toBe(false);

    await withModelSpan(dirty, async () => "ok", tracer);
    const spans = exporter.getFinishedSpans().map((span) => ({ name: span.name, attributes: span.attributes }));
    const dumped = JSON.stringify(spans);
    expect(dumped).toContain("matchcv.cv");
    expect(dumped).toContain(SESSION);
    expect(dumped).not.toContain(CV);
    expect(dumped).not.toContain(KEY);
    expect(spans[0]?.attributes["matchcv.attempt"]).toBe("2");

    expect(maskTelemetryData(`falhou ${KEY} e ${CV}`)).not.toContain(KEY);
    expect(isMatchcvSpan({ "matchcv.artifact": "cv" })).toBe(true);
    expect(isMatchcvSpan({ "http.url": `https://api.example.com?app_key=${KEY}` })).toBe(false);
  });

  it("aceita só um UUID no header de sessão", () => {
    const req = new Request("http://localhost/api/generate/cv", {
      headers: { "x-matchcv-session": SESSION, "x-matchcv-attempt": "3" },
    });
    expect(readModelCallContext(req, { provider: "google", model: "gemini-3.8-flash", artifact: "cv" })).toEqual({
      sessionId: SESSION,
      provider: "google",
      model: "gemini-3.8-flash",
      artifact: "cv",
      attempt: "3",
    });
    const rejected = new Request("http://localhost/api/generate/cv", {
      headers: { "x-matchcv-session": CV, "x-matchcv-attempt": "0" },
    });
    expect(readModelCallContext(rejected, { provider: "google", model: "gemini-3.8-flash", artifact: "cv" }).sessionId).toBe("none");
  });
});
