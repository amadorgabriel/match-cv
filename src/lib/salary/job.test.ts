import { describe, expect, it } from "vitest";

import { analyzeJob, buildSalaryQueries, queryMatchesExactly, salaryProgressMessages } from "./job";

const zucchetti = `
Full Stack Developer Analyst Pleno
Empresa: Zucchetti
Local: São Paulo - SP
Atuar com React e Node no produto.
`;

describe("analyzeJob", () => {
  it("normaliza o cargo da Zucchetti e separa empresa, local e senioridade", () => {
    const job = analyzeJob({ jobDescription: zucchetti });
    expect(job.normalizedTitle).toBe("desenvolvedor full stack");
    expect(job.seniority).toBe("pleno");
    expect(job.company).toBe("Zucchetti");
    expect(job.location).toContain("São Paulo");
    expect(job.remote).toBe(false);
    expect(job.anchor).toBe("full stack");
  });

  it("tira o nome da empresa e palavras de senioridade do título", () => {
    const job = analyzeJob({ jobDescription: "Desenvolvedor Front-end Sênior na Nubank\nRemoto" });
    expect(job.normalizedTitle).toBe("desenvolvedor front-end");
    expect(job.seniority).toBe("sênior");
    expect(job.company).toBe("Nubank");
    expect(job.remote).toBe(true);
  });

  it("mantém analista de dados como cargo, sem reduzir a desenvolvedor", () => {
    const job = analyzeJob({ jobTitle: "Analista de Dados Pleno" });
    expect(job.normalizedTitle).toBe("analista de dados");
    expect(job.seniority).toBe("pleno");
  });
});

describe("buildSalaryQueries", () => {
  it("cai do título com local até a senioridade próxima, usando what, what_or e what_and", () => {
    const job = analyzeJob({ jobDescription: zucchetti });
    const queries = buildSalaryQueries(job);
    expect(queries.map((query) => query.kind)).toEqual(["exact_location", "title", "family", "related_seniority"]);
    expect(queries[0]).toMatchObject({ what: "desenvolvedor full stack", where: job.location });
    expect(queries[1].what).toBe("desenvolvedor full stack");
    expect(queries[1].where).toBeUndefined();
    expect(queries[2].whatOr).toContain("desenvolvedor full stack");
    expect(queries[2].whatOr).toContain("full stack developer");
    expect(queries[3].whatOr).toContain("desenvolvedor júnior full stack");
    expect(queries[3].whatAnd).toBe("full stack");
    expect(queryMatchesExactly(job, "title")).toBe(false);
    expect(queryMatchesExactly({ ...job, seniority: undefined }, "title")).toBe(true);
  });

  it("não filtra cidade quando a vaga é remota", () => {
    const queries = buildSalaryQueries(analyzeJob({ jobDescription: "Backend Developer\n100% remoto" }));
    expect(queries.map((query) => query.kind)).toEqual(["title", "family", "related_seniority"]);
    expect(queries.every((query) => !query.where)).toBe(true);
  });
});

describe("salaryProgressMessages", () => {
  it("cita a empresa e o cargo na etapa da web", () => {
    const messages = salaryProgressMessages(analyzeJob({ jobDescription: zucchetti }));
    expect(messages[0]).toBe("Consultando Adzuna…");
    expect(messages[1]).toBe("Buscando na web por Zucchetti + desenvolvedor full stack…");
    expect(messages[2]).toBe("Comparando fontes…");
  });
});
