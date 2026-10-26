import { describe, expect, it } from "vitest";

import { analyzeJob, salaryProgressMessages } from "./job";

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
    expect(job.family).toBe("desenvolvedor full stack");
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

describe("salaryProgressMessages", () => {
  it("cita a empresa e o cargo na busca pública, sem fonte proprietária", () => {
    const messages = salaryProgressMessages(analyzeJob({ jobDescription: zucchetti }));
    expect(messages).toEqual([
      "Buscando na web por Zucchetti + desenvolvedor full stack…",
      "Comparando fontes públicas…",
      "Preparando o link do Glassdoor…",
    ]);
  });
});
