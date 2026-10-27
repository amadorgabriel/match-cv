import { describe, expect, it } from "vitest";

import { combineSalary, confidenceFor, rangesOverlap, toMonthlyBrl, type SalaryObservation } from "./combine";
import { analyzeJob } from "./job";

const job = analyzeJob({ jobDescription: "Full Stack Developer Analyst Pleno\nEmpresa: Zucchetti\nLocal: São Paulo" });

function observation(patch: Partial<SalaryObservation> & Pick<SalaryObservation, "min" | "max">): SalaryObservation {
  return {
    origin: "web",
    currency: "BRL",
    period: "year",
    roleFound: "desenvolvedor full stack",
    exact: false,
    sources: [{ name: "Levels.fyi", url: "https://www.levels.fyi/companies/zucchetti" }],
    ...patch,
  };
}

describe("toMonthlyBrl", () => {
  it("divide o anual por 12 e converte dólar com o câmbio aproximado", () => {
    expect(toMonthlyBrl({ min: 120000, max: 180000, currency: "BRL", period: "year" })).toMatchObject({ min: 10000, max: 15000, fx: false });
    expect(toMonthlyBrl({ min: 120000, max: 120000, currency: "USD", period: "year" }).min).toBe(Math.round((120000 * 5.5) / 12));
  });
});

describe("confidenceFor", () => {
  it("sobe para alta com duas faixas que se cruzam ou com duas páginas na mesma faixa", () => {
    expect(confidenceFor({
      ranges: [{ min: 10000, max: 15000 }, { min: 11000, max: 16000 }],
      sources: [{ name: "Levels.fyi", url: "https://www.levels.fyi/companies/zucchetti" }],
    })).toBe("alta");
    expect(confidenceFor({
      ranges: [{ min: 10000, max: 15000 }],
      sources: [
        { name: "Levels.fyi", url: "https://www.levels.fyi/companies/zucchetti" },
        { name: "Robert Half", url: "https://www.roberthalf.com/br/guia" },
      ],
    })).toBe("alta");
  });

  it("fica em média com uma página citada e em baixa sem página", () => {
    expect(confidenceFor({
      ranges: [{ min: 9000, max: 14000 }],
      sources: [{ name: "Levels.fyi", url: "https://www.levels.fyi/companies/zucchetti" }],
    })).toBe("media");
    expect(confidenceFor({ ranges: [{ min: 9000, max: 14000 }], sources: [] })).toBe("baixa");
  });
});

describe("combineSalary", () => {
  it("marca confiança alta quando duas faixas da web se cruzam", () => {
    const salary = combineSalary(job, [
      observation({ min: 120000, median: 150000, max: 180000, sampleSize: 20, matchedQuery: "busca na web" }),
      observation({
        min: 11000,
        max: 16000,
        period: "month",
        currency: "BRL",
        exact: true,
        matchedQuery: "busca na web",
        sources: [{ name: "Robert Half", url: "https://www.roberthalf.com/br/guia" }],
      }),
    ], ["ok"]);
    expect(salary.confidence).toBe("alta");
    expect(salary.period).toBe("month");
    expect(salary.available).toBe(true);
    expect(salary.min).toBeGreaterThan(9000);
    expect(salary.max).toBeLessThan(20000);
    expect(rangesOverlap({ min: 10000, max: 15000 }, { min: 11000, max: 16000 })).toBe(true);
    expect(salary.disclaimer).toMatch(/busca pública na web/);
    expect(salary.disclaimer).toMatch(/divididos por 12/);
  });

  it("marca média com uma fonte citada e baixa sem fonte", () => {
    expect(combineSalary(job, [observation({ min: 9000, max: 14000, period: "month" })], []).confidence).toBe("media");
    expect(combineSalary(job, [observation({ min: 9000, max: 14000, period: "month", sources: [] })], []).confidence).toBe("baixa");
  });

  it("explica o cargo parecido e não trata ausência de número como faixa", () => {
    const partial = combineSalary(
      job,
      [observation({ min: 96000, max: 144000, roleFound: "desenvolvedor júnior full stack" })],
      ["Busca na web sem faixa numérica."],
    );
    expect(partial.similarRoleNote).toBe(
      "Não encontramos a faixa de pleno para esse cargo, mas temos a de desenvolvedor júnior full stack, apesar de não ser a mesma vaga.",
    );
    expect(partial.query.comparedRole).toBe("desenvolvedor júnior full stack");
    const empty = combineSalary(job, [], ["Busca na web sem resposta utilizável.", "Busca na web sem faixa numérica."]);
    expect(empty.available).toBe(false);
    expect(empty.min).toBeUndefined();
    expect(empty.disclaimer).toMatch(/Faixa não disponível/);
    expect(empty.tried).toHaveLength(2);
  });

  it("avisa quando as fontes públicas divergem e usa a média", () => {
    const salary = combineSalary(job, [
      observation({ min: 5000, max: 7000, period: "month", sources: [{ name: "A", url: "https://a.example/salario" }] }),
      observation({ min: 20000, max: 30000, period: "month", sources: [{ name: "B", url: "https://b.example/salario" }] }),
    ], []);
    expect(salary.confidence).toBe("media");
    expect(salary.min).toBe(12500);
    expect(salary.max).toBe(18500);
    expect(salary.disclaimer).toMatch(/fontes públicas divergem/);
  });
});
