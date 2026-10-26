import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { searchWebSalary } = vi.hoisted(() => ({ searchWebSalary: vi.fn() }));

vi.mock("./web", () => {
  class WebSearchRateLimitError extends Error {
    readonly retryAfterSec: number;

    constructor(retryAfterSec: number) {
      super("web_search_rate_limited");
      this.name = "WebSearchRateLimitError";
      this.retryAfterSec = retryAfterSec;
    }
  }
  return { searchWebSalary, WebSearchRateLimitError };
});

import { clearSalaryCache } from "./cache";
import { glassdoorSalarySearchUrl } from "./glassdoor";
import { lookupSalary, SalaryRateLimitError } from "./search";
import { WebSearchRateLimitError } from "./web";

const webInput = {
  jobTitle: "Desenvolvedor",
  jobDescription: "Desenvolvedor na Nubank",
  provider: "google" as const,
  model: "gemini-3.8-flash",
  apiKey: "chave-teste-123456",
  realAi: true,
};

beforeEach(() => {
  searchWebSalary.mockReset();
  clearSalaryCache();
});

describe("lookupSalary", () => {
  it("devolve o exemplo e não consulta a web quando a IA real está desligada", async () => {
    const salary = await lookupSalary({ jobTitle: "Desenvolvedor Full Stack", location: "São Paulo", realAi: false });
    expect(salary.isMock).toBe(true);
    expect(salary.available).toBe(true);
    expect(salary.query.jobTitle).toBe("desenvolvedor full stack");
    expect(salary.sources).toEqual([]);
    expect(salary.disclaimer).toMatch(/busca pública na web/);
    expect(salary.disclaimer).toMatch(/Glassdoor/);
    expect(searchWebSalary).not.toHaveBeenCalled();
  });

  it("estima a faixa pela busca na web e registra o link do Glassdoor", async () => {
    searchWebSalary.mockResolvedValue({
      found: true,
      sources: [{ name: "Levels.fyi", url: "https://www.levels.fyi/companies/nubank" }],
      observation: {
        origin: "web",
        min: 10000,
        max: 15000,
        currency: "BRL",
        period: "month",
        roleFound: "desenvolvedor",
        exact: true,
        matchedQuery: "busca na web",
        sources: [{ name: "Levels.fyi", url: "https://www.levels.fyi/companies/nubank" }],
      },
    });
    const salary = await lookupSalary(webInput);
    expect(searchWebSalary).toHaveBeenCalledOnce();
    expect(salary.available).toBe(true);
    expect(salary.isMock).toBe(false);
    expect(salary.confidence).toBe("media");
    expect(salary.min).toBe(10000);
    expect(salary.tried).toContain("Busca na web com fontes citadas.");
    expect(salary.tried?.some((item) => item.includes("Glassdoor"))).toBe(true);
    expect(glassdoorSalarySearchUrl({ company: salary.query.company, jobTitle: salary.query.jobTitle })).toMatch(/glassdoor\.com\.br/);
  });

  it("sobe o limite do provedor quando a busca na web responde 429", async () => {
    searchWebSalary.mockRejectedValue(new WebSearchRateLimitError(15));
    await expect(lookupSalary(webInput)).rejects.toMatchObject({ name: "SalaryRateLimitError", retryAfterSec: 15 });
    await expect(lookupSalary({ ...webInput, jobTitle: "Analista de Dados" })).rejects.toBeInstanceOf(SalaryRateLimitError);
  });

  it("responde faixa indisponível quando o provedor não busca na web", async () => {
    const salary = await lookupSalary({ ...webInput, provider: "openrouter", model: "openrouter/free" });
    expect(searchWebSalary).not.toHaveBeenCalled();
    expect(salary.available).toBe(false);
    expect(salary.isMock).toBe(false);
    expect(salary.tried).toContain("Busca na web ignorada: este provedor não tem ferramenta de busca.");
  });
});
