import { describe, expect, it } from "vitest";

import { combineSalary, rangesOverlap, toMonthlyBrl, type SalaryObservation } from "./combine";
import { analyzeJob } from "./job";

const job = analyzeJob({ jobDescription: "Full Stack Developer Analyst Pleno\nEmpresa: Zucchetti\nLocal: São Paulo" });

function observation(patch: Partial<SalaryObservation> & Pick<SalaryObservation, "origin" | "min" | "max">): SalaryObservation {
  return {
    currency: "BRL",
    period: "year",
    roleFound: "desenvolvedor full stack",
    exact: false,
    sources: [{ name: patch.origin === "adzuna" ? "Adzuna" : "Levels.fyi", url: patch.origin === "adzuna" ? "https://www.adzuna.com.br" : "https://www.levels.fyi/companies/zucchetti" }],
    ...patch,
  };
}

describe("toMonthlyBrl", () => {
  it("divide o anual por 12 e converte dólar com o câmbio aproximado", () => {
    expect(toMonthlyBrl({ min: 120000, max: 180000, currency: "BRL", period: "year" })).toMatchObject({ min: 10000, max: 15000, fx: false });
    expect(toMonthlyBrl({ min: 120000, max: 120000, currency: "USD", period: "year" }).min).toBe(Math.round((120000 * 5.5) / 12));
  });
});

describe("combineSalary", () => {
  it("marca confiança alta quando Adzuna e web se cruzam", () => {
    const salary = combineSalary(job, [
      observation({ origin: "adzuna", min: 120000, median: 150000, max: 180000, sampleSize: 20, matchedQuery: "Adzuna: título" }),
      observation({ origin: "web", min: 11000, max: 16000, period: "month", currency: "BRL", exact: true, matchedQuery: "busca na web" }),
    ], ["ok"]);
    expect(salary.confidence).toBe("alta");
    expect(salary.period).toBe("month");
    expect(salary.available).toBe(true);
    expect(salary.min).toBeGreaterThan(9000);
    expect(salary.max).toBeLessThan(20000);
    expect(rangesOverlap({ min: 10000, max: 15000 }, { min: 11000, max: 16000 })).toBe(true);
  });

  it("marca média só com a Adzuna e baixa só com a web", () => {
    expect(combineSalary(job, [observation({ origin: "adzuna", min: 120000, max: 180000 })], []).confidence).toBe("media");
    expect(combineSalary(job, [observation({ origin: "web", min: 9000, max: 14000, period: "month" })], []).confidence).toBe("baixa");
  });

  it("explica o cargo parecido e não trata ausência de número como faixa", () => {
    const partial = combineSalary(
      job,
      [observation({ origin: "adzuna", min: 96000, max: 144000, roleFound: "desenvolvedor júnior full stack" })],
      ["Adzuna título: sem dados"],
    );
    expect(partial.similarRoleNote).toBe(
      "Não encontramos a faixa de pleno para esse cargo, mas temos a de desenvolvedor júnior full stack, apesar de não ser a mesma vaga.",
    );
    const empty = combineSalary(job, [], ["Adzuna título: sem dados", "Busca na web sem faixa numérica."]);
    expect(empty.available).toBe(false);
    expect(empty.min).toBeUndefined();
    expect(empty.disclaimer).toMatch(/Faixa não disponível/);
    expect(empty.tried).toHaveLength(2);
  });
});
