import { describe, expect, it } from "vitest";

import { contentDisposition, coverLetterPdfFilename, cvPdfFilename } from "./filename";

describe("pdf filenames", () => {
  it("junta nome e empresa e preserva acentos e espaços", () => {
    expect(cvPdfFilename("Gabriel Rodrigues", "Ênfases")).toBe("Gabriel Rodrigues - Ênfases.pdf");
  });

  it("omite a empresa quando ela não foi identificada", () => {
    expect(cvPdfFilename("Gabriel Rodrigues")).toBe("Gabriel Rodrigues.pdf");
    expect(cvPdfFilename("Gabriel Rodrigues", "   ")).toBe("Gabriel Rodrigues.pdf");
  });

  it("usa Currículo quando o nome está vazio", () => {
    expect(cvPdfFilename("")).toBe("Currículo.pdf");
    expect(cvPdfFilename("", "Ênfases")).toBe("Currículo - Ênfases.pdf");
  });

  it("troca caracteres ilegais por espaço", () => {
    expect(cvPdfFilename('Gabriel/Rodrigues: "A"', "X*Y?")).toBe("Gabriel Rodrigues A - X Y.pdf");
  });

  it("nomeia a cover letter com o sufixo pedido", () => {
    expect(coverLetterPdfFilename("Gabriel Rodrigues", "Ênfases")).toBe(
      "Gabriel Rodrigues - Ênfases - Cover letter.pdf",
    );
    expect(coverLetterPdfFilename(undefined)).toBe("Currículo - Cover letter.pdf");
  });

  it("publica o nome UTF-8 no Content-Disposition", () => {
    const header = contentDisposition("Gabriel Rodrigues - Ênfases.pdf");
    expect(header).toContain('filename="Gabriel Rodrigues - Enfases.pdf"');
    expect(header).toContain(`filename*=UTF-8''${encodeURIComponent("Gabriel Rodrigues - Ênfases.pdf")}`);
  });
});
