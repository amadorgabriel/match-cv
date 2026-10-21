import "server-only";

import { createHash } from "node:crypto";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { logApiWarning } from "./redact";

/**
 * Limite por IP. Com Redis (Upstash via REST) a janela é deslizante e vale
 * entre instâncias. Sem credencial, ou se o Redis falha ou estoura o prazo,
 * vale o limite em memória desta instância: a rota continua de pé.
 *
 * O IP só entra na chave como SHA-256. A chamada ao Redis sai do servidor,
 * então a CSP do navegador (`connect-src 'self'`) não muda.
 */
const DEFAULT_TIMEOUT_MS = 1_500;
const WARN_INTERVAL_MS = 15_000;

const buckets = new Map<string, { count: number; resetAt: number }>();
const limiters = new Map<string, Ratelimit>();
const lastWarningAt = new Map<string, number>();

let timeoutMs = DEFAULT_TIMEOUT_MS;
let redisClient: { key: string; redis: Redis } | null = null;

type RedisCreds = { url: string; token: string };

function nonEmpty(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Par da integração (KV_*) ou o par padrão do cliente Upstash. Nunca mistura os dois. */
function readRedisCreds(): RedisCreds | null {
  const kvUrl = nonEmpty(process.env.KV_REST_API_URL);
  const kvToken = nonEmpty(process.env.KV_REST_API_TOKEN);
  if (kvUrl && kvToken) return { url: kvUrl, token: kvToken };

  const upstashUrl = nonEmpty(process.env.UPSTASH_REDIS_REST_URL);
  const upstashToken = nonEmpty(process.env.UPSTASH_REDIS_REST_TOKEN);
  if (upstashUrl && upstashToken) return { url: upstashUrl, token: upstashToken };

  return null;
}

/** SHA-256 do IP. Com `RATE_LIMIT_IP_SALT`, o sal entra no material. */
export function hashClientIp(ip: string): string {
  const salt = nonEmpty(process.env.RATE_LIMIT_IP_SALT) ?? "";
  const material = salt ? `${salt}:${ip}` : ip;
  return createHash("sha256").update(material).digest("hex");
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown").trim();
}

function memoryRateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10_000) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    }
    return { ok: true, retryAfterSec: 0 };
  }
  bucket.count += 1;
  return { ok: bucket.count <= limit, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) };
}

function warnFallback(kind: string, message: string, secrets: Array<string | undefined>): void {
  const now = Date.now();
  const previous = lastWarningAt.get(kind) ?? 0;
  if (now - previous < WARN_INTERVAL_MS) return;
  lastWarningAt.set(kind, now);
  logApiWarning(message, secrets);
}

function redis(): Redis | null {
  const creds = readRedisCreds();
  if (!creds) return null;
  const key = `${creds.url}\0${creds.token}`;
  if (!redisClient || redisClient.key !== key) {
    redisClient = { key, redis: new Redis({ url: creds.url, token: creds.token }) };
    limiters.clear();
  }
  return redisClient.redis;
}

function limiterFor(route: string, limit: number, windowMs: number, client: Redis): Ratelimit {
  const cacheKey = `${route}:${limit}:${windowMs}:${timeoutMs}`;
  const existing = limiters.get(cacheKey);
  if (existing) return existing;
  const created = new Ratelimit({
    redis: client,
    limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms` as `${number} ms`),
    prefix: `matchcv:rl:${route}`,
    analytics: false,
    ephemeralCache: false,
    enableProtection: false,
    enableTelemetry: false,
    timeout: timeoutMs,
  });
  limiters.set(cacheKey, created);
  return created;
}

export async function rateLimit(
  route: string,
  ip: string,
  limit: number,
  windowMs: number,
): Promise<{ ok: boolean; retryAfterSec: number }> {
  const hashed = hashClientIp(ip);
  const memoryKey = `${route}:${hashed}`;
  const creds = readRedisCreds();
  const client = creds ? redis() : null;
  if (!creds || !client) {
    warnFallback(
      "unconfigured",
      "rate_limit_fallback unconfigured: Redis sem credenciais. Usando limite em memória.",
      [],
    );
    return memoryRateLimit(memoryKey, limit, windowMs);
  }

  try {
    const result = await limiterFor(route, limit, windowMs, client).limit(hashed);
    if (result.reason === "timeout") {
      warnFallback(
        "timeout",
        `rate_limit_fallback timeout route=${route}: Redis não respondeu a tempo. Usando limite em memória.`,
        [creds.url, creds.token, ip],
      );
      return memoryRateLimit(memoryKey, limit, windowMs);
    }
    if (!result.success) {
      const retryAfterSec = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
      return { ok: false, retryAfterSec };
    }
    return { ok: true, retryAfterSec: 0 };
  } catch (err) {
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : "Error";
    warnFallback("error", `rate_limit_fallback error route=${route}: ${detail}`, [creds.url, creds.token, ip]);
    return memoryRateLimit(memoryKey, limit, windowMs);
  }
}

/** Limpa contadores e o cliente em cache. Usado pelos testes. */
export function resetRateLimitForTests(options?: { timeoutMs?: number }): void {
  buckets.clear();
  limiters.clear();
  lastWarningAt.clear();
  redisClient = null;
  timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
}
