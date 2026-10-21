import { describe, expect, it } from "vitest";

import { parseWebSalaryText } from "./web-parse";

describe("parseWebSalaryText", () => {
  it("lê o JSON, cita a URL e marca remuneração total da Levels.fyi", () => {
    const text = `
\`\`\`json
{"found":true,"currency":"BRL","period":"month","min":11000,"median":14000,"max":18000,"contract":"CLT","roleFound":"desenvolvedor full stack","exactMatch":false,"similarRoleNote":"Não encontramos a faixa de pleno para esse cargo, mas temos a de desenvolvedor pleno full stack, apesar de não ser a mesma vaga.","sources":[{"name":"Levels.fyi","url":"https://www.levels.fyi/companies/zucchetti","date":"2026-01"}],"asOf":"2026-01"}
\`\`\`
`;
    const hit = parseWebSalaryText(text, ["https://www.levels.fyi/companies/zucchetti/salaries"]);
    expect(hit?.found).toBe(true);
    expect(hit?.observation?.min).toBe(11000);
    expect(hit?.observation?.contract).toBe("CLT");
    expect(hit?.observation?.sources[0]?.note).toContain("Remuneração total");
    expect(hit?.observation?.sources.map((source) => source.url)).toContain("https://www.levels.fyi/companies/zucchetti/salaries");
    expect(hit?.observation?.similarRoleNote).toContain("Não encontramos a faixa de pleno");
  });

  it("descarta link que não é http e devolve só as páginas quando não há número", () => {
    const hit = parseWebSalaryText(
      JSON.stringify({
        found: false,
        sources: [
          { name: "Glassdoor", url: "https://www.glassdoor.com.br/Salario/zucchetti" },
          { name: "ruim", url: "javascript:alert(1)" },
        ],
      }),
    );
    expect(hit?.found).toBe(false);
    expect(hit?.observation).toBeUndefined();
    expect(hit?.sources.map((source) => source.url)).toEqual(["https://www.glassdoor.com.br/Salario/zucchetti"]);
  });
});
