import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { guessJobTitle, histogramPercentile } from "./adzuna";

describe("histogramPercentile", () => {
  const h = { "60000": 2, "80000": 5, "100000": 2, "120000": 1 };
  it("calcula percentis ponderados", () => {
    expect(histogramPercentile(h, 0.1)).toBe(60000);
    expect(histogramPercentile(h, 0.5)).toBe(80000);
    expect(histogramPercentile(h, 0.9)).toBe(100000);
  });
  it("retorna undefined sem dados", () => {
    expect(histogramPercentile({}, 0.5)).toBeUndefined();
  });
});

describe("guessJobTitle", () => {
  it("usa a primeira linha sem o prefixo", () => {
    expect(guessJobTitle("\nVaga: Desenvolvedor Backend Sênior\nRequisitos...")).toBe("Desenvolvedor Backend Sênior");
  });
});
