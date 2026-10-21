import { extractText, getDocumentProxy } from "unpdf";
import { describe, expect, it } from "vitest";

import { MOCK_OUTPUTS } from "@/lib/mock/outputs";

import { cvToPdf } from "./cv-to-pdf";

describe("cvToPdf", () => {
  it("gera PDF com texto selecionável e acentos de pt-BR", async () => {
    const bytes = await cvToPdf(MOCK_OUTPUTS.cv);
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("%PDF");

    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    expect(text).toMatch(/Experiência/);
    expect(text).toMatch(/Formação/);
    expect(text).toMatch(/São Paulo/);
    expect(text).toMatch(/Ciência/);
    expect(text).toMatch(/Inglês/);
    expect(text).toMatch(/Desenvolvedor Full Stack/);
  });
});
