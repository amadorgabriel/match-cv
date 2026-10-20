import { describe, expect, it } from "vitest";

import { autoFix, countWords, humanize, validateHumanText } from "./humanize-validator";

describe("validateHumanText", () => {
  it("aprova texto limpo", () => {
    const text =
      "Reduzi o tempo de deploy em 40% migrando 12 serviços para Kubernetes. Hoje o time publica em média 20 vezes por semana.";
    expect(validateHumanText(text)).toEqual([]);
  });

  it("detecta travessão e meia-risca", () => {
    const rules = validateHumanText("Trabalhei com Go — e gostei. Período 2020–2023.").map((v) => v.rule);
    expect(rules.filter((r) => r === "dash")).toHaveLength(2);
  });

  it("detecta til antes de número", () => {
    expect(validateHumanText("Atendi ~20 clientes").map((v) => v.rule)).toContain("tilde-number");
    expect(validateHumanText("Atendi ~ 20 clientes").map((v) => v.rule)).toContain("tilde-number");
  });

  it("detecta frases banidas sem diferenciar maiúsculas e com acentos", () => {
    const v = validateHumanText("Sou Apaixonado por tecnologia e quero agregar valor.");
    expect(v.filter((x) => x.rule === "banned-phrase").map((x) => x.match?.toLowerCase())).toEqual([
      "apaixonado por",
      "agregar valor",
    ]);
  });

  it("não marca palavra banida dentro de outra palavra", () => {
    expect(validateHumanText("Trabalhei com elevadores industriais.")).toEqual([]);
  });

  it("detecta 'além disso' repetido, emoji, placeholder e exclamações", () => {
    const rules = validateHumanText(
      "Além disso, fiz X. Além disso, fiz Y 🚀 na [Nome da empresa]! Incrível!",
    ).map((v) => v.rule);
    expect(rules).toEqual(expect.arrayContaining(["alem-disso-repeat", "emoji", "placeholder", "exclamation"]));
  });

  it("respeita limite de palavras", () => {
    expect(validateHumanText("um dois três quatro", { maxWords: 3 }).map((v) => v.rule)).toContain("word-limit");
    expect(countWords("Olá, mundo! Node.js 24")).toBe(4);
  });
});

describe("autoFix / humanize", () => {
  it("corrige travessão, intervalo numérico e til", () => {
    expect(autoFix("Liderei o time — 8 pessoas — por 2020–2023, com ~20 deploys")).toBe(
      "Liderei o time, 8 pessoas, por 2020-2023, com cerca de 20 deploys",
    );
  });

  it("humanize informa se corrigiu e o que sobrou", () => {
    const r = humanize("Sinergia total — sempre.");
    expect(r.autoFixed).toBe(true);
    expect(r.text).not.toMatch(/[—–]/);
    expect(r.violations.map((v) => v.rule)).toEqual(["banned-phrase"]);
  });
});
