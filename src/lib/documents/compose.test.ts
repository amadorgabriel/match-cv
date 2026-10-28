import { describe, expect, it } from "vitest";

import { LIMITS, GenerateRequestSchema, SalaryRequestSchema } from "@/lib/schemas/requests";

import { composeDocuments, validateDocuments, type DocumentDraft } from "./compose";

const request = {
  provider: "openrouter" as const,
  model: "openrouter/free",
  apiKey: "sk-test-key-1234",
  resumeText: "Currículo com experiência em TypeScript, React e Node.js ao longo de cinco anos.",
  jobDescription: "Vaga de desenvolvedor full stack com React, Node.js e experiência em produção.",
};

describe("documentos unificados", () => {
  it("junta currículo, conquistas e contexto sem passar dos limites da API", () => {
    const composed = composeDocuments([
      { kind: "cv", source: "text", text: "Currículo colado com TypeScript e React em produção por cinco anos." },
      { kind: "cv", source: "pdf", extracted: "Segundo PDF do currículo com Node.js." },
      { kind: "achievements", source: "text", text: "Reduzi o tempo de deploy em 40%." },
      { kind: "achievements", source: "pdf", extracted: "Na Empresa Alfa, aumentei a conversão em 8%." },
      { kind: "portfolio", source: "text", text: "Repositório público com estudos de caso." },
    ]);
    expect(composed.cvText).toContain("Currículo colado");
    expect(composed.cvText).toContain("Segundo PDF");
    expect(composed.resumeText).toBe(composed.cvText);
    expect(composed.achievements).toContain("deploy em 40%");
    expect(composed.achievements).toContain("Repositório público");
    expect(composed.achievementsDocument).toContain("Empresa Alfa");
    expect(composed.achievementsText).toContain("deploy em 40%");
    expect(composed.achievementsText).toContain("Empresa Alfa");
    expect(composed.cvText.length).toBeLessThanOrEqual(LIMITS.maxResumeChars);
    expect(composed.achievements.length).toBeLessThanOrEqual(LIMITS.maxAchievementsChars);

    const parsed = GenerateRequestSchema.parse({
      ...request,
      resumeText: composed.resumeText,
      achievements: composed.achievements,
      achievementsDocument: composed.achievementsDocument,
    });
    expect(parsed.resumeText).toBe(composed.cvText);
    expect(parsed.achievements).toContain("deploy em 40%");
    expect(
      SalaryRequestSchema.parse({
        jobDescription: request.jobDescription,
        cvText: composed.cvText,
        achievementsText: composed.achievementsText,
      }).cvText,
    ).toBe(composed.cvText);
  });

  it("aceita os nomes cvText e achievementsText no lugar dos campos antigos", () => {
    const parsed = GenerateRequestSchema.parse({
      ...request,
      resumeText: undefined,
      cvText: request.resumeText,
      achievementsText: "Liderei a migração de 12 serviços.",
    });
    expect(parsed.resumeText).toBe(request.resumeText);
    expect(parsed.achievements).toBe("Liderei a migração de 12 serviços.");
    expect(GenerateRequestSchema.parse(request).achievements).toBe("");
  });

  it("exige um currículo e recusa PDF inválido", () => {
    const pdf = new File([new Uint8Array([1, 2, 3])], "cv.pdf", { type: "application/pdf" });
    const entries: DocumentDraft[] = [
      { id: "cv", kind: "cv", source: "pdf", text: "", file: pdf },
      { id: "extra", kind: "portfolio", source: "text", text: "cases", file: null },
    ];
    expect(validateDocuments(entries)).toEqual({});
    expect(validateDocuments([{ id: "vazio", kind: "cv", source: "text", text: "curto", file: null }]).documents).toMatch(/currículo/i);
    const docx = new File([new Uint8Array([1])], "cv.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    expect(validateDocuments([{ id: "docx", kind: "cv", source: "pdf", text: "", file: docx }]).docx).toMatch(/PDF/);
  });
});
