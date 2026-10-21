import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/**
 * Redis em memória. O `@upstash/ratelimit` chama EVALSHA e, no NOSCRIPT,
 * o EVAL do script da janela deslizante. O mock executa essa conta.
 */
const redisState = vi.hoisted(() => {
  type Entry = { value: number; expiresAt: number };

  const state: {
    mode: "ok" | "throw" | "hang";
    hangMs: number;
    instances: Array<{ opts: { url: string; token: string }; keys: string[] }>;
    FakeRedis: new (opts: { url: string; token: string }) => { opts: { url: string; token: string }; keys: string[] };
  } = {
    mode: "ok",
    hangMs: 300,
    instances: [],
    FakeRedis: class {
      opts: { url: string; token: string };
      keys: string[] = [];
      constructor(opts: { url: string; token: string }) {
        this.opts = opts;
      }
    },
  };

  class FakeRedis {
    keys: string[] = [];
    private store = new Map<string, Entry>();

    constructor(public opts: { url: string; token: string }) {
      state.instances.push(this);
    }

    async evalsha(): Promise<never> {
      throw new Error("NOSCRIPT No matching script");
    }

    async eval(script: string, keys: string[], args: Array<string | number>): Promise<[number, number]> {
      this.keys.push(...keys);
      if (!script.includes("requestsInCurrentWindow")) throw new Error("script inesperado para a janela deslizante");
      if (state.mode === "throw") {
        throw new Error(`redis down token=${this.opts.token} url=${this.opts.url}`);
      }
      if (state.mode === "hang") await new Promise((resolve) => setTimeout(resolve, state.hangMs));

      const [currentKey, previousKey] = keys;
      const tokens = Number(args[0]);
      const now = Number(args[1]);
      const windowMs = Number(args[2]);
      const incrementBy = Number(args[3] ?? 1);
      const current = this.read(currentKey, now);
      const previous = this.read(previousKey, now);
      const percentageInCurrent = (now % windowMs) / windowMs;
      const weightedPrev = Math.floor((1 - percentageInCurrent) * previous);
      if (incrementBy > 0 && weightedPrev + current >= tokens) return [-1, tokens];
      const newValue = this.incr(currentKey, incrementBy, windowMs * 2 + 1000, now);
      return [tokens - (newValue + weightedPrev), tokens];
    }

    async get(): Promise<null> {
      return null;
    }

    async set(): Promise<string> {
      return "OK";
    }

    private read(key: string, now: number): number {
      const entry = this.store.get(key);
      if (!entry || entry.expiresAt <= now) return 0;
      return entry.value;
    }

    private incr(key: string, by: number, ttlMs: number, now: number): number {
      const next = this.read(key, now) + by;
      const existing = this.store.get(key);
      const expiresAt = next === by || !existing || existing.expiresAt <= now ? now + ttlMs : existing.expiresAt;
      this.store.set(key, { value: next, expiresAt });
      return next;
    }
  }

  state.FakeRedis = FakeRedis;
  return state;
});

vi.mock("@upstash/redis", () => ({
  Redis: redisState.FakeRedis,
}));

import { checkRateLimit } from "./http";
import { hashClientIp, resetRateLimitForTests } from "./rate-limit";

const TOKEN = "upstash-token-super-secret-value";
const KV_URL = "https://kv.example.upstash.io";
const UPSTASH_URL = "https://upstash.example.upstash.io";
const IP = "203.0.113.10";

const ENV_KEYS = [
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "RATE_LIMIT_IP_SALT",
] as const;

function clearEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}

function useKv() {
  process.env.KV_REST_API_URL = KV_URL;
  process.env.KV_REST_API_TOKEN = TOKEN;
}

function request(ip?: string, header = "x-forwarded-for") {
  const headers = new Headers();
  if (ip) headers.set(header, ip);
  return new Request("http://localhost/api/salary", { method: "POST", headers });
}

function warnings(spy: { mock: { calls: unknown[][] } }): string[] {
  return spy.mock.calls
    .map((call) => call.map(String).join(" "))
    .filter((line) => line.includes("rate_limit_fallback"));
}

async function expectLimited(res: Response | null) {
  expect(res).not.toBeNull();
  if (!res) return;
  expect(res.status).toBe(429);
  expect(res.headers.get("Retry-After")).toMatch(/^[1-9]\d*$/);
  expect(res.headers.get("Cache-Control")).toContain("no-store");
  await expect(res.json()).resolves.toEqual({
    error: { code: "rate_limited", message: "Muitas requisições. Tente de novo em instantes." },
  });
}

describe("rate limit", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    clearEnv();
    redisState.mode = "ok";
    redisState.hangMs = 300;
    redisState.instances.length = 0;
    resetRateLimitForTests();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    clearEnv();
    resetRateLimitForTests();
  });

  describe("memória, sem Redis", () => {
    it("libera até o limite e responde 429 com Retry-After", async () => {
      const req = request(IP);
      for (let i = 0; i < 5; i++) expect(await checkRateLimit(req, "salary", 5)).toBeNull();
      await expectLimited(await checkRateLimit(req, "salary", 5));
      expect(redisState.instances).toHaveLength(0);
      expect(warnings(warnSpy)).toHaveLength(1);
      expect(warnings(warnSpy)[0]).toContain("unconfigured");
    });

    it("avisa a falta de credencial uma vez", async () => {
      const req = request(IP);
      await checkRateLimit(req, "salary", 5);
      await checkRateLimit(req, "salary", 5);
      expect(warnings(warnSpy)).toHaveLength(1);
    });

    it("separa rotas, IPs e o primeiro hop de x-forwarded-for", async () => {
      expect(await checkRateLimit(request(`${IP}, 10.0.0.8`), "salary", 1)).toBeNull();
      await expectLimited(await checkRateLimit(request(`${IP}, 10.0.0.9`), "salary", 1));
      expect(await checkRateLimit(request("203.0.113.11, 10.0.0.9"), "salary", 1)).toBeNull();
      expect(await checkRateLimit(request(IP), "generate", 1)).toBeNull();
      expect(await checkRateLimit(request("198.51.100.7", "x-real-ip"), "parse", 1)).toBeNull();
      await expectLimited(await checkRateLimit(request("198.51.100.7", "x-real-ip"), "parse", 1));
    });

    it("ignora um par de credenciais incompleto", async () => {
      process.env.UPSTASH_REDIS_REST_URL = UPSTASH_URL;
      expect(await checkRateLimit(request(IP), "brief", 1)).toBeNull();
      expect(redisState.instances).toHaveLength(0);
    });
  });

  describe("Redis", () => {
    it("usa janela deslizante, prefixo por rota e o hash do IP", async () => {
      useKv();
      process.env.RATE_LIMIT_IP_SALT = "sal-de-teste";
      const hash = hashClientIp(IP);
      const req = request(IP);

      for (let i = 0; i < 5; i++) expect(await checkRateLimit(req, "salary", 5)).toBeNull();
      await expectLimited(await checkRateLimit(req, "salary", 5));
      expect(await checkRateLimit(req, "brief", 5)).toBeNull();

      const salaryKeys = redisState.instances[0]?.keys.filter((key) => key.startsWith("matchcv:rl:salary:")) ?? [];
      expect(salaryKeys.length).toBeGreaterThan(0);
      for (const key of redisState.instances[0]?.keys ?? []) {
        expect(key).not.toContain(IP);
        expect(key.startsWith("matchcv:rl:salary:") || key.startsWith("matchcv:rl:brief:")).toBe(true);
      }
      expect(salaryKeys[0]).toContain(hash);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      expect(hash).not.toContain(IP);
      expect(warnings(warnSpy)).toHaveLength(0);
      expect(redisState.instances[0]?.opts).toEqual({ url: KV_URL, token: TOKEN });
    });

    it("prefere KV_REST_API_* e aceita o par UPSTASH_REDIS_REST_*", async () => {
      useKv();
      process.env.UPSTASH_REDIS_REST_URL = UPSTASH_URL;
      process.env.UPSTASH_REDIS_REST_TOKEN = "outro-token-que-nao-deve-entrar";
      await checkRateLimit(request(IP), "parse", 5);
      expect(redisState.instances[0]?.opts.url).toBe(KV_URL);

      clearEnv();
      resetRateLimitForTests();
      redisState.instances.length = 0;
      process.env.UPSTASH_REDIS_REST_URL = UPSTASH_URL;
      process.env.UPSTASH_REDIS_REST_TOKEN = TOKEN;
      await checkRateLimit(request(IP), "parse", 5);
      expect(redisState.instances[0]?.opts).toEqual({ url: UPSTASH_URL, token: TOKEN });
    });

    it("troca o hash quando o sal muda", async () => {
      useKv();
      process.env.RATE_LIMIT_IP_SALT = "sal-a";
      const hashA = hashClientIp(IP);
      await checkRateLimit(request(IP), "cv-pdf", 5);
      process.env.RATE_LIMIT_IP_SALT = "sal-b";
      const hashB = hashClientIp(IP);
      await checkRateLimit(request(IP), "cv-pdf", 5);
      const keys = redisState.instances[0]?.keys ?? [];
      expect(hashA).not.toBe(hashB);
      expect(keys.some((key) => key.includes(hashA))).toBe(true);
      expect(keys.some((key) => key.includes(hashB))).toBe(true);
    });
  });

  describe("fallback", () => {
    it("cai na memória quando o Redis rejeita a chamada e mascara o token", async () => {
      useKv();
      redisState.mode = "throw";
      const req = request(IP);
      expect(await checkRateLimit(req, "generate", 1)).toBeNull();
      await expectLimited(await checkRateLimit(req, "generate", 1));
      const logged = warnings(warnSpy).join("\n");
      expect(logged).toContain("rate_limit_fallback error");
      expect(logged).toContain("[redacted]");
      expect(logged).not.toContain(TOKEN);
      expect(logged).not.toContain(KV_URL);
      expect(logged).not.toContain(IP);
    });

    it("cai na memória quando o Redis estoura o prazo", async () => {
      useKv();
      redisState.mode = "hang";
      redisState.hangMs = 300;
      resetRateLimitForTests({ timeoutMs: 50 });
      const req = request(IP);
      expect(await checkRateLimit(req, "salary", 1, 60_000)).toBeNull();
      await expectLimited(await checkRateLimit(req, "salary", 1, 60_000));
      const logged = warnings(warnSpy).join("\n");
      expect(logged).toContain("rate_limit_fallback timeout");
      expect(logged).not.toContain(TOKEN);
      expect(logged).not.toContain(IP);
      await new Promise((resolve) => setTimeout(resolve, redisState.hangMs + 50));
    });
  });
});
