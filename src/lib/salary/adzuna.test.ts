import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheLife: () => {} }));

import { adzunaHistogramArgs, guessJobTitle, histogramPercentile, normalizeHistogram, searchAdzuna } from "./adzuna";
import { analyzeJob } from "./job";

describe("histogramPercentile", () => {
  const h = { "60000": 2, "80000": 5, "100000": 2, "120000": 1 };
  it("calcula percentis ponderados", () => {
    expect(histogramPercentile(h, 0.1)).toBe(60000);
    expect(histogramPercentile(h, 0.5)).toBe(80000);
    expect(histogramPercentile(h, 0.9)).toBe(100000);
  });
  it("retorna undefined sem dados", () => {
    expect(histogramPercentile({}, 0.5)).toBeUndefined();
  });
});

describe("guessJobTitle", () => {
  it("usa a primeira linha sem o prefixo", () => {
    expect(guessJobTitle("\nVaga: Desenvolvedor Backend Sênior\nRequisitos...")).toBe("Desenvolvedor Backend Sênior");
  });
});

describe("searchAdzuna", () => {
  const creds = { appId: "app", appKey: "secret" };
  const job = analyzeJob({ jobDescription: "Full Stack Developer Analyst Pleno\nEmpresa: Zucchetti\nLocal: São Paulo - SP" });

  it("não chama a rede sem credencial", async () => {
    const fetchImpl = vi.fn();
    const result = await searchAdzuna(job, { credentials: null, fetchImpl });
    expect(result.configured).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("avança para o título sem local e registra a query que achou dados", async () => {
    const calls: URL[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      calls.push(url);
      const where = url.searchParams.get("where");
      const histogram = where ? {} : { "120000": "4", "180000": 2 };
      return new Response(JSON.stringify({ histogram }), { status: 200 });
    });
    const result = await searchAdzuna(job, { credentials: creds, fetchImpl });
    expect(result.match?.query.kind).toBe("title");
    expect(result.match?.sampleSize).toBe(6);
    expect(result.match?.min).toBe(120000);
    expect(calls).toHaveLength(2);
    expect(calls[0]?.searchParams.get("what")).toBe("desenvolvedor full stack");
    expect(calls[0]?.searchParams.get("where")).toContain("São Paulo");
    expect(calls[1]?.searchParams.has("where")).toBe(false);
    expect(calls.some((url) => url.searchParams.get("app_key") !== "secret")).toBe(false);
  });

  it("usa what_or na família e what_and na senioridade próxima", async () => {
    const seen: Array<Record<string, string>> = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      seen.push(Object.fromEntries(url.searchParams.entries()));
      const hasOr = url.searchParams.has("what_or");
      const hasAnd = url.searchParams.has("what_and");
      const histogram = hasOr && hasAnd ? { "80000": 3 } : {};
      return new Response(JSON.stringify({ histogram }), { status: 200 });
    });
    const result = await searchAdzuna(job, { credentials: creds, fetchImpl });
    expect(result.match?.query.kind).toBe("related_seniority");
    expect(seen[2]?.what_or).toContain("full stack developer");
    expect(seen[3]?.what_and).toBe("full stack");
    expect(seen[3]?.what_or).toContain("desenvolvedor júnior full stack");
    expect(normalizeHistogram({ "80000": "3" })).toEqual({ "80000": 3 });
  });
});

describe("adzunaHistogramArgs", () => {
  it("não coloca credencial na chave do cache", () => {
    const args = adzunaHistogramArgs({ what: "desenvolvedor full stack", where: "São Paulo" }, "br");
    const serialized = JSON.stringify(args);
    expect(serialized).not.toMatch(/app_id|app_key/);
    expect(args).toEqual({
      what: "desenvolvedor full stack",
      whatAnd: "",
      whatOr: "",
      where: "São Paulo",
      country: "br",
    });
    expect(Object.keys(args).sort()).toEqual(["country", "what", "whatAnd", "whatOr", "where"]);
  });
});
