import type { DataCollection, ErrorEvent, TransactionEvent } from "@sentry/core";

import { redactSecrets } from "@/lib/security/secrets";

import { SENTRY_TUNNEL_PATH } from "./sentry-tunnel";

/**
 * O SDK 11 removeu `sendDefaultPii`. Este objeto é o equivalente a
 * `sendDefaultPii: false`: sem IP, cookies, corpos, query sensível nem texto de IA.
 */
export const sentryDataCollection = {
  userInfo: false,
  cookies: false,
  httpHeaders: {
    deny: ["authorization", "cookie", "set-cookie", "x-api-key", "x-goog-api-key"],
  },
  httpBodies: [],
  urlQueryParams: { deny: ["app_key", "api_key", "apikey", "key", "token"] },
  genAI: { inputs: false, outputs: false },
  stackFrameVariables: false,
  databaseQueryData: false,
  queues: false,
} satisfies DataCollection;

const EMBEDDED_FIELD =
  /"(?:resumeText|resume_text|jobDescription|job_description|achievements|achievementsDocument|apiKey|api_key|app_key|authorization|x-api-key|x-goog-api-key)"\s*:\s*"(?:\\.|[^"\\])*"/gi;

const SENSITIVE_KEY =
  /^(?:authorization|proxy-authorization|x-api-key|x-goog-api-key|api[-_]?key|app[-_]?key|cookie|cookies|set-cookie|resume[-_]?text|job[-_]?description|achievements(?:[-_]?document)?|password|secret|database[-_]?url|better[-_]?auth[-_]?secret|key[-_]?encryption[-_]?secret(?:[-_](?:previous|v\d+))?)$/i;

const SENSITIVE_ATTRIBUTE =
  /(authorization|x-api-key|x-goog-api-key|api[_-]?key|app[_-]?key|cookie|set-cookie|resume[_-]?text|job[_-]?description|achievements|gen_ai\.(?:prompt|input|output)|ai\.prompt|http\.request\.body|http\.request\.header\.(?:authorization|cookie|x-api-key|x-goog-api-key))/i;

const REQUEST_DROP = new Set(["data", "body", "cookies", "cookie"]);

export function scrubString(text: string, secrets: Array<string | undefined> = []): string {
  EMBEDDED_FIELD.lastIndex = 0;
  return redactSecrets(text.replace(EMBEDDED_FIELD, '"[redacted]"'), secrets);
}

export function isSensitiveKey(key: string): boolean {
  if (key.startsWith("matchcv.")) return false;
  return SENSITIVE_KEY.test(key) || SENSITIVE_ATTRIBUTE.test(key);
}

export function collectSecrets(value: unknown, found: string[] = []): string[] {
  if (typeof value === "string") return found;
  if (Array.isArray(value)) {
    for (const item of value) collectSecrets(item, found);
    return found;
  }
  if (!value || typeof value !== "object") return found;
  for (const [key, child] of Object.entries(value)) {
    if (isSensitiveKey(key) && typeof child === "string") found.push(child);
    else collectSecrets(child, found);
  }
  return found;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function rebuild(value: unknown, secrets: string[]): unknown {
  if (typeof value === "string") return scrubString(value, secrets);
  if (Array.isArray(value)) return value.map((item) => rebuild(item, secrets));
  if (!isRecord(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (isSensitiveKey(key)) continue;
    out[key] = rebuild(child, secrets);
  }
  return out;
}

function scrubHeaders(headers: Record<string, unknown>, secrets: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (isSensitiveKey(key)) continue;
    out[key] = rebuild(value, secrets);
  }
  return out;
}

function scrubRequest(request: Record<string, unknown>, secrets: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(request)) {
    if (REQUEST_DROP.has(key) || isSensitiveKey(key)) continue;
    if (key === "headers" && isRecord(value)) {
      out.headers = scrubHeaders(value, secrets);
      continue;
    }
    out[key] = rebuild(value, secrets);
  }
  return out;
}

/** Tira chave, cookie, corpo, CV e vaga de um evento ou transação do Sentry. */
export function scrubSentryEvent<T>(event: T): T {
  if (!isRecord(event)) return event;
  const secrets = collectSecrets(event).filter((secret) => secret.length >= 6);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(event)) {
    if (key === "user" || key === "cookies") continue;
    if (key === "request" && isRecord(value)) {
      out.request = scrubRequest(value, secrets);
      continue;
    }
    if (isSensitiveKey(key)) continue;
    out[key] = rebuild(value, secrets);
  }
  return out as T;
}

export function scrubSentryErrorEvent(event: ErrorEvent): ErrorEvent | null {
  return scrubSentryEvent(event);
}

export function scrubSentryTransaction(event: TransactionEvent): TransactionEvent | null {
  return scrubSentryEvent(event);
}

export function scrubAttributes(attributes: Record<string, unknown>, secrets: string[] = collectSecrets(attributes)): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (isSensitiveKey(key)) continue;
    if (typeof value === "string") out[key] = scrubString(value, secrets);
    else if (Array.isArray(value)) {
      out[key] = value.map((item) => (typeof item === "string" ? scrubString(item, secrets) : item));
    } else out[key] = value;
  }
  return out;
}

interface ScrubbableSpan {
  name?: string;
  description?: string;
  attributes?: Record<string, unknown>;
  data?: Record<string, unknown>;
}

/** Span do modo stream (beforeSendSpan) e atributos soltos. */
export function scrubSentrySpan<T extends ScrubbableSpan>(span: T): T {
  const secrets = collectSecrets(span).filter((secret) => secret.length >= 6);
  const next: T = { ...span };
  if (typeof span.name === "string") next.name = scrubString(span.name, secrets);
  if (typeof span.description === "string") next.description = scrubString(span.description, secrets);
  if (span.attributes) next.attributes = scrubAttributes(span.attributes, secrets);
  if (span.data) next.data = scrubAttributes(span.data, secrets);
  return next;
}

export function mentionsSentryTunnel(value: string): boolean {
  return value.includes(SENTRY_TUNNEL_PATH);
}
