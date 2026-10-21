import { describe, expect, it } from "vitest";

import { ANTI_AI_RULES } from "@/prompts/anti-ai-rules";
import { ACHIEVEMENTS_DOCUMENT_HEADING } from "@/prompts/achievements-document";
import { buildCoverLetterPrompt, COVER_LETTER_SYSTEM } from "@/prompts/cover-letter";
import { buildCvPrompt, CV_SYSTEM } from "@/prompts/cv";
import { buildEmailPrompt, EMAIL_SYSTEM } from "@/prompts/email";
import { buildInterviewPrompt, INTERVIEW_SYSTEM } from "@/prompts/interview";

import {
  DEFAULT_OUTPUT_SELECTION,
  GenerateRequestSchema,
  LIMITS,
  OutputSelectionSchema,
  processingStepsFor,
  type OutputSelection,
} from "./requests";

const none: OutputSelection = {
  cv: false,
  email: false,
  "cover-letter": false,
  interview: false,
  salary: false,
};

describe("seleção de materiais", () => {
  it("vem só com o CV marcado e inclui a leitura do PDF", () => {
    expect(DEFAULT_OUTPUT_SELECTION).toEqual({
      cv: true,
      email: false,
      "cover-letter": false,
      interview: false,
      salary: false,
    });
    expect(OutputSelectionSchema.parse(DEFAULT_OUTPUT_SELECTION)).toEqual(DEFAULT_OUTPUT_SELECTION);
    expect(processingStepsFor(DEFAULT_OUTPUT_SELECTION)).toEqual(["parse", "cv"]);
  });

  it("inclui a análise da vaga, o e-mail, a carta e a entrevista quando esses itens estão marcados", () => {
    expect(
      processingStepsFor({
        cv: false,
        email: true,
        "cover-letter": true,
        interview: true,
        salary: false,
      }),
    ).toEqual(["parse", "brief", "email", "cover-letter", "interview"]);
  });

  it("só consulta /api/salary quando a faixa salarial é o único material", () => {
    expect(processingStepsFor({ ...none, salary: true })).toEqual(["salary"]);
  });

  it("lê o currículo apenas quando há texto de IA para gerar", () => {
    expect(processingStepsFor({ ...none, email: true })).toEqual(["parse", "brief", "email"]);
    expect(processingStepsFor({ ...none, salary: true })).not.toContain("parse");
    expect(processingStepsFor({ ...none, cv: true })).toEqual(["parse", "cv"]);
  });

  it("analisa a vaga só para e-mail, carta ou entrevista", () => {
    expect(processingStepsFor({ ...none, cv: true, salary: true })).toEqual(["parse", "cv", "salary"]);
    expect(processingStepsFor({ ...none, cv: true, email: true })).toEqual(["parse", "brief", "cv", "email"]);
    expect(processingStepsFor({ ...none, salary: true })).not.toContain("brief");
    expect(processingStepsFor(DEFAULT_OUTPUT_SELECTION)).not.toContain("brief");
  });

  it("exige pelo menos um material", () => {
    const parsed = OutputSelectionSchema.safeParse(none);
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0]?.message).toBe("Selecione ao menos um material.");
  });
});

describe("documento de conquistas", () => {
  const request = {
    provider: "openai" as const,
    model: "gpt-6.1-sol",
    apiKey: "sk-test-key-1234",
    resumeText: "Currículo com experiência em TypeScript, React e Node.js ao longo de cinco anos.",
    jobDescription: "Vaga de desenvolvedor full stack com React, Node.js e experiência em produção.",
  };

  it("aceita o texto do PDF e assume vazio quando o campo não vem", () => {
    expect(GenerateRequestSchema.parse(request).achievementsDocument).toBe("");
    expect(
      GenerateRequestSchema.parse({ ...request, achievementsDocument: "Na Empresa Alfa, aumentei a conversão em 8%." })
        .achievementsDocument,
    ).toContain("Empresa Alfa");
  });

  it("recusa documento maior que o limite do currículo", () => {
    expect(
      GenerateRequestSchema.safeParse({ ...request, achievementsDocument: "x".repeat(LIMITS.maxResumeChars + 1) }).success,
    ).toBe(false);
  });

  it("delimita o PDF como fonte factual e mantém o campo de texto", () => {
    const input = {
      resumeText: "Currículo original.",
      jobDescription: "Descrição da vaga com requisitos de backend e frontend para o time.",
      achievements: "reduzi o tempo de deploy em 40%",
      achievementsDocument: "Na Empresa Alfa, aumentei a conversão em 8%.",
    };
    for (const build of [buildCvPrompt, buildEmailPrompt, buildCoverLetterPrompt, buildInterviewPrompt]) {
      const prompt = build(input);
      expect(prompt).toContain("reduzi o tempo de deploy em 40%");
      expect(prompt).toContain(ACHIEVEMENTS_DOCUMENT_HEADING);
      expect(prompt).toContain("Nunca invente");
      expect(prompt).toContain("---\nNa Empresa Alfa, aumentei a conversão em 8%.\n---");
      expect(prompt.indexOf("CONQUISTAS E NÚMEROS")).toBeLessThan(prompt.indexOf(ACHIEVEMENTS_DOCUMENT_HEADING));
      expect(build({ ...input, achievementsDocument: "  " })).not.toContain(ACHIEVEMENTS_DOCUMENT_HEADING);
    }
  });

  it("mantém as regras anti-IA no CV, no e-mail e na cover letter", () => {
    expect(CV_SYSTEM).toContain(ANTI_AI_RULES);
    expect(EMAIL_SYSTEM).toContain(ANTI_AI_RULES);
    expect(COVER_LETTER_SYSTEM).toContain(ANTI_AI_RULES);
    expect(INTERVIEW_SYSTEM).not.toContain(ANTI_AI_RULES);
    expect(CV_SYSTEM).toContain("Não invente experiência, empresa, cargo, data, tecnologia ou número");
  });
});
