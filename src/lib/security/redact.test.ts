import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { logApiError, logApiWarning, logModelUsage, redactSecrets } from "./redact";

describe("redactSecrets", () => {
  it("esconde sk-, AIza, Bearer, app_key e a chave do request", () => {
    const key = "chave-do-usuario-123456";
    const text = [
      `falhou com ${key}`,
      "Authorization: Bearer sk-abcDEF1234567890",
      "sk-ant-api03-abcdefghijklmnopqrstuvwxyz",
      "sk-or-v1-abcdefghijklmnopqrstuvwxyz",
      "AIzaSyA1234567890abcdefghij",
      "app_key=segredo-aplicacao",
      "x-goog-api-key: AIzaSyOutraChave1234567890",
    ].join(" ");
    const clean = redactSecrets(text, [key]);
    expect(clean).not.toContain(key);
    expect(clean).not.toContain("sk-abc");
    expect(clean).not.toContain("sk-ant-");
    expect(clean).not.toContain("sk-or-");
    expect(clean).not.toContain("AIza");
    expect(clean).not.toContain("segredo-aplicacao");
    expect(clean).toContain("[redacted]");
  });

  it("mascara DATABASE_URL, BETTER_AUTH_SECRET e KEY_ENCRYPTION_SECRET", () => {
    const password = "db-password-should-hide";
    const authSecret = "better-auth-secret-should-hide";
    const kek = "key-encryption-secret-should-hide";
    const text = [
      `DATABASE_URL=postgres://matchcv:${password}@db.example:5432/matchcv`,
      `BETTER_AUTH_SECRET=${authSecret}`,
      `KEY_ENCRYPTION_SECRET=${kek}`,
    ].join(" ");
    const clean = redactSecrets(text, [password, authSecret, kek]);
    expect(clean).not.toContain(password);
    expect(clean).not.toContain(authSecret);
    expect(clean).not.toContain(kek);
    expect(clean).not.toContain("postgres://");
  });
});

describe("logModelUsage", () => {
  it("registra só os tokens e o contexto anônimo", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    const cv = "Currículo secreto da Ana com TypeScript, React e a empresa Alfa desde 2020.";
    const key = "sk-or-v1-abcdefghijklmnopqrstuvwxyz";
    logModelUsage({
      sessionId: "not-a-uuid",
      provider: "openrouter",
      model: `openrouter/free ${key}`,
      artifact: "email",
      attempt: "2",
      inputTokens: 120,
      outputTokens: 40,
      totalTokens: 160,
      resumeText: cv,
      apiKey: key,
      jobDescription: "Vaga secreta na empresa Alfa com salário de 10 mil.",
    });
    const line = String(spy.mock.calls[0]?.[0]);
    expect(line).toContain('"event":"model_usage"');
    expect(line).toContain('"sessionId":"none"');
    expect(line).toContain('"attempt":"2"');
    expect(line).toContain('"inputTokens":120');
    expect(line).not.toContain(cv);
    expect(line).not.toContain("Vaga secreta");
    expect(line).not.toContain("sk-or-");
    expect(line).not.toContain("apiKey");
    spy.mockRestore();
  });
});

describe("logApiWarning", () => {
  it("mascara o segredo antes do console.warn", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const token = "upstash-token-super-secret-value";
    logApiWarning(`redis down token=${token}`, [token]);
    const line = String(spy.mock.calls[0]?.[0]);
    expect(line).toContain("[redacted]");
    expect(line).not.toContain(token);
    spy.mockRestore();
  });
});

describe("logApiError", () => {
  it("loga rota, status e a mensagem já redigida", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await logApiError({
      route: "/api/generate/cv",
      error: new Error("provider said sk-live-abcdefghijklmnopqrstuvwxyz"),
      statusCode: 429,
      provider: "google",
      model: "gemini-3.8-flash",
      artifact: "cv",
      durationMs: 40,
      secrets: ["sk-live-abcdefghijklmnopqrstuvwxyz"],
    });
    const line = String(spy.mock.calls[0]?.[0]);
    expect(line).toContain('"/api/generate/cv"');
    expect(line).toContain('"statusCode":429');
    expect(line).toContain('"provider":"google"');
    expect(line).not.toContain("sk-live-");
    spy.mockRestore();
  });
});
