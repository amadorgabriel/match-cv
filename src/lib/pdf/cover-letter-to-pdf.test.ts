import { extractText, getDocumentProxy } from "unpdf";
import { describe, expect, it } from "vitest";

import { coverLetterToPdf } from "./cover-letter-to-pdf";

describe("coverLetterToPdf", () => {
  it("gera PDF com o texto da carta e acentos", async () => {
    const bytes = await coverLetterToPdf({
      body: "Escrevo de São Paulo.\n\nTenho experiência com TypeScript.",
      fullName: "Gabriel Rodrigues",
      company: "Ênfases",
    });
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("%PDF");

    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    expect(text).toMatch(/Gabriel Rodrigues/);
    expect(text).toMatch(/Ênfases/);
    expect(text).toMatch(/Cover letter/);
    expect(text).toMatch(/São Paulo/);
    expect(text).toMatch(/TypeScript/);
  });
});
