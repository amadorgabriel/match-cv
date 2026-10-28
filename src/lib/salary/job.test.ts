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

  it("não deixa menção solta de QA substituir o cargo do cabeçalho", () => {
    const job = analyzeJob({
      jobDescription: `
Engenheiro de Software Back-end
Sobre a vaga
Você irá atuar com QA e Product Owner no discovery.
Responsabilidades
Desenvolver APIs.
`,
    });
    expect(job.normalizedTitle.toLowerCase()).not.toMatch(/product|qualidade/);
    expect(job.normalizedTitle.toLowerCase()).toMatch(/back-end|software|engenheiro/);
  });

  it("mantém analista de segurança e ignora empresa geográfica ou de time", () => {
    const job = analyzeJob({
      jobDescription: `
Sobre a vaga
Analista de Segurança da Informação
Atuação na América Latina, no Brasil.
Empresa: Nossa Equipe
Time de Engenharia
`,
    });
    expect(job.normalizedTitle.toLowerCase()).toContain("analista");
    expect(job.normalizedTitle.toLowerCase()).toContain("segurança");
    expect(job.company).toBeUndefined();
    expect(analyzeJob({ company: "América Latina", jobDescription: "Vaga na América Latina" }).company).toBeUndefined();
    expect(analyzeJob({ company: "Time de Engenharia", jobDescription: "Sobre nós" }).company).toBeUndefined();
    expect(analyzeJob({ company: "Área de Produto", jobDescription: "no Brasil" }).company).toBeUndefined();
    expect(analyzeJob({ company: "Scale", jobDescription: "Desenvolvedor at Scale" }).company).toBeUndefined();
    expect(analyzeJob({ company: "Itaú", jobDescription: "na América Latina" }).company).toBe("Itaú");
  });

  it("prioriza cargo, senioridade, empresa e local vindos do brief", () => {
    const job = analyzeJob({
      jobDescription: "Atuar com QA e Product Owner na América Latina",
      normalizedSearchTitle: "Engenheiro de Software Back-end",
      jobTitle: "Pessoa Engenheira",
      seniority: "sênior",
      candidateSeniority: "pleno",
      company: "Itaú",
      location: "São Paulo",
      workModel: "hibrido",
    });
    expect(job.normalizedTitle).toBe("Engenheiro de Software Back-end");
    expect(job.rawTitle).toBe("Pessoa Engenheira");
    expect(job.seniority).toBe("sênior");
    expect(job.company).toBe("Itaú");
    expect(job.location).toContain("São Paulo");
    expect(job.remote).toBe(false);
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
