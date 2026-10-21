import "server-only";

/**
 * Rate limit simples por IP, em memória (janela fixa).
 *
 * Limitação: cada instância serverless tem a própria memória. O limite é
 * aproximado, zera no cold start e não se soma entre instâncias.
 * Um limite durável precisaria de um store pago (Upstash, Vercel KV) ou de
 * 'use cache: remote', que também cobra taxa de plataforma. Por isso o
 * limite continua só em memória.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
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

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown").trim();
}
