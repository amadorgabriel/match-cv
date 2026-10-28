import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { buildApiErrorReport } from "./api-error-report";
import { RedactingSpanProcessor, traceIsSampled } from "./redacting-span-processor";
import { readSentryDsn, readTracesSampleRate } from "./sentry-env";
import { scrubAttributes, scrubSentryEvent } from "./sentry-scrub";

const KEY = "chave-do-usuario-123456";
const SK = "sk-ant-api03-abcdefghijklmnopqrstuvwxyz";
const AIZA = "AIzaSyA1234567890abcdefghij";
const APP_KEY = "segredo-adzuna";
const CV = "Currículo secreto da Ana com TypeScript, React e a empresa Alfa desde 2020.";
const JOB = "Vaga secreta na empresa Alfa com salário de 10 mil.";

describe("readSentryDsn", () => {
  it("fica desligado sem um DSN https", () => {
    expect(readSentryDsn({})).toBeUndefined();
    expect(readSentryDsn({ SENTRY_DSN: "" })).toBeUndefined();
    expect(readSentryDsn({ SENTRY_DSN: "not-a-dsn" })).toBeUndefined();
    expect(readSentryDsn({ NEXT_PUBLIC_SENTRY_DSN: "https://abc@o1.ingest.sentry.io/1" })).toBe(
      "https://abc@o1.ingest.sentry.io/1",
    );
  });
});

describe("readTracesSampleRate", () => {
  it("usa 0.1 e aceita override limitado entre 0 e 1", () => {
    expect(readTracesSampleRate({})).toBe(0.1);
    expect(readTracesSampleRate({ SENTRY_TRACES_SAMPLE_RATE: "0.25" })).toBe(0.25);
    expect(readTracesSampleRate({ NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: "1" })).toBe(1);
    expect(readTracesSampleRate({ SENTRY_TRACES_SAMPLE_RATE: "9" })).toBe(1);
    expect(readTracesSampleRate({ SENTRY_TRACES_SAMPLE_RATE: "-1" })).toBe(0);
    expect(readTracesSampleRate({ SENTRY_TRACES_SAMPLE_RATE: "abc" })).toBe(0.1);
  });
});

describe("scrubSentryEvent", () => {
  it("não deixa chave, cookie, corpo, CV nem vaga no evento", () => {
    const event = {
      message: `falhou com ${KEY} e ${SK}`,
      user: { ip_address: "203.0.113.5", email: "ana@example.com" },
      tags: { route: "/api/generate/cv", artifact: "cv", provider: "google", model: "gemini-3.8-flash" },
      request: {
        url: `https://matchcv.local/api/salary?app_key=${APP_KEY}&app_id=publico`,
        headers: {
          Authorization: `Bearer ${SK}`,
          "x-api-key": KEY,
          "x-goog-api-key": AIZA,
          cookie: "session=secret-cookie",
          accept: "application/json",
        },
        cookies: { session: "secret-cookie" },
        data: {
          apiKey: KEY,
          app_key: APP_KEY,
          resumeText: CV,
          jobDescription: JOB,
          provider: "google",
        },
      },
      extra: {
        apiKey: KEY,
        resumeText: CV,
        note: `o modelo devolveu ${AIZA}`,
        provider: "google",
      },
      breadcrumbs: [{ message: `header x-goog-api-key: ${AIZA}`, data: { app_key: APP_KEY, ok: true } }],
      exception: {
        values: [{ type: "Error", value: `provider said ${SK} ${CV}` }],
      },
    };

    const clean = scrubSentryEvent(event);
    const blob = JSON.stringify(clean);
    expect(blob).not.toContain(KEY);
    expect(blob).not.toContain(SK);
    expect(blob).not.toContain("sk-");
    expect(blob).not.toContain(AIZA);
    expect(blob).not.toContain("AIza");
    expect(blob).not.toContain(APP_KEY);
    expect(blob).not.toContain(CV);
    expect(blob).not.toContain(JOB);
    expect(blob).not.toContain("secret-cookie");
    expect(blob).not.toContain("203.0.113.5");
    expect(blob).not.toContain("ana@example.com");
    expect(blob).not.toContain("apiKey");
    expect(blob).not.toContain("resumeText");
    expect(clean.request && "data" in clean.request).toBe(false);
    expect(clean.tags).toEqual(event.tags);
    expect(clean.extra).toMatchObject({ provider: "google" });
    const headers = clean.request?.headers as Record<string, string>;
    expect(headers.accept).toBe("application/json");
    expect(headers.Authorization).toBeUndefined();
  });
});

describe("buildApiErrorReport", () => {
  it("manda rota, artefato, provedor e modelo, sem a chave e sem o currículo", () => {
    const report = buildApiErrorReport({
      route: "/api/generate/cv",
      error: new Error(`provider said ${SK}`),
      statusCode: 502,
      provider: "google",
      model: `gemini-3.8-flash ${KEY}`,
      artifact: "cv",
      secrets: [KEY, SK],
    });
    const blob = JSON.stringify(report);
    expect(blob).not.toContain(KEY);
    expect(blob).not.toContain(SK);
    expect(blob).not.toContain("sk-");
    expect(report.tags).toMatchObject({
      route: "/api/generate/cv",
      artifact: "cv",
      provider: "google",
    });
    expect(report.tags.model).not.toContain(KEY);
    expect(report.level).toBe("error");

    const dumped = buildApiErrorReport({
      route: "/api/brief",
      error: new Error(CV.repeat(20)),
      statusCode: 401,
      provider: "openrouter",
      model: "openrouter/free",
      artifact: "brief",
    });
    expect(JSON.stringify(dumped)).not.toContain("Currículo secreto");
    expect(dumped.message).toContain("[mensagem omitida]");
    expect(dumped.level).toBe("warning");
  });
});

describe("RedactingSpanProcessor", () => {
  it("mascara o span amostrado e descarta o túnel", () => {
    const traceId = "ab".repeat(16);
    expect(traceIsSampled(traceId, 1)).toBe(true);
    expect(traceIsSampled(traceId, 0)).toBe(false);
    expect(traceIsSampled("not-a-trace", 1)).toBe(false);

    const ended: unknown[] = [];
    const inner = {
      onStart: () => {},
      onEnd: (span: unknown) => ended.push(span),
      shutdown: async () => {},
      forceFlush: async () => {},
    };
    const processor = new RedactingSpanProcessor(inner, 1);
    const span = {
      name: "matchcv.cv",
      attributes: {
        "matchcv.artifact": "cv",
        "matchcv.model": "gemini",
        apiKey: KEY,
        "gen_ai.prompt": CV,
        "http.url": `https://api.adzuna.com/jobs?app_key=${APP_KEY}&what=dev`,
      },
      spanContext: () => ({ traceId, spanId: "cd".repeat(8) }),
    };
    processor.onEnd(span as never);
    expect(ended).toHaveLength(1);
    const attrs = (ended[0] as { attributes: Record<string, string> }).attributes;
    const blob = JSON.stringify(attrs);
    expect(blob).not.toContain(KEY);
    expect(blob).not.toContain(CV);
    expect(blob).not.toContain(APP_KEY);
    expect(blob).not.toContain("apiKey");
    expect(blob).not.toContain("gen_ai.prompt");
    expect(attrs["matchcv.artifact"]).toBe("cv");
    expect(attrs["http.url"]).toContain("[redacted]");

    const tunnel = {
      name: "POST /monitoring",
      attributes: { "http.route": "/monitoring" },
      spanContext: () => ({ traceId, spanId: "cd".repeat(8) }),
    };
    processor.onEnd(tunnel as never);
    expect(ended).toHaveLength(1);
  });
});

describe("proxy matcher", () => {
  it("não deixa o proxy interceptar /monitoring", () => {
    const source = readFileSync(new URL("../../proxy.ts", import.meta.url), "utf8");
    const match = source.match(/source:\s*"([^"]+)"/);
    expect(match?.[1]).toContain("monitoring");
    const re = new RegExp(`^${match?.[1]}$`);
    expect(re.test("/monitoring")).toBe(false);
    expect(re.test("/monitoring/envelope")).toBe(false);
    expect(re.test("/api/generate/cv")).toBe(false);
    expect(re.test("/gerar")).toBe(true);
    expect(re.test("/")).toBe(true);
  });
});

describe("scrubAttributes", () => {
  it("apaga o campo da chave e redige o valor que sobrou no texto", () => {
    const clean = scrubAttributes({
      apiKey: KEY,
      "matchcv.provider": "google",
      note: `falhou ${SK}`,
    });
    expect(clean.apiKey).toBeUndefined();
    expect(clean["matchcv.provider"]).toBe("google");
    expect(String(clean.note)).not.toContain("sk-");
  });

  it("remove TYPESAFE_API_KEY do evento", () => {
    const secret = "ts_live_VERIFICATION_SECRET_99";
    const clean = scrubSentryEvent({
      message: `jev falhou com ${secret}`,
      extra: { TYPESAFE_API_KEY: secret, ok: true },
    });
    expect(JSON.stringify(clean)).not.toContain(secret);
  });
});
