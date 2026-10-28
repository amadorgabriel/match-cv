import { describe, expect, it } from "vitest";

import { parseWebSalaryText, readLooseCitations } from "./web-parse";

describe("parseWebSalaryText", () => {
  it("lê o JSON, cita a URL e marca remuneração total da Levels.fyi", () => {
    const text = `
\`\`\`json
{"found":true,"currency":"BRL","period":"month","min":11000,"median":14000,"max":18000,"contract":"CLT","roleFound":"desenvolvedor full stack","exactMatch":false,"similarRoleNote":"Não encontramos a faixa de pleno para esse cargo, mas temos a de desenvolvedor pleno full stack, apesar de não ser a mesma vaga.","sources":[{"name":"Levels.fyi","url":"https://www.levels.fyi/companies/zucchetti","date":"2026-01"}],"asOf":"2026-01"}
\`\`\`
`;
    const hit = parseWebSalaryText(text, [
      { url: "https://www.levels.fyi/companies/zucchetti/salaries", title: "Zucchetti Salaries" },
    ]);
    expect(hit?.found).toBe(true);
    expect(hit?.observation?.min).toBe(11000);
    expect(hit?.observation?.contract).toBe("CLT");
    expect(hit?.observation?.sources).toHaveLength(1);
    expect(hit?.observation?.sources[0]?.url).toBe("https://www.levels.fyi/companies/zucchetti/salaries");
    expect(hit?.observation?.sources[0]?.name).toBe("Zucchetti Salaries");
    expect(hit?.observation?.sources[0]?.note).toContain("Remuneração total");
    expect(hit?.observation?.sources[0]?.date).toBe("2026-01");
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
    expect(hit?.sources).toEqual([]);
  });

  it("lista a página citada e descarta o link que o modelo inventou", () => {
    const hit = parseWebSalaryText(
      JSON.stringify({
        found: false,
        sources: [{ name: "Inventado", url: "https://www.glassdoor.com.br/Salario/zucchetti", date: "2026-02" }],
      }),
      ["https://www.linkedin.com/jobs/view/123"],
    );
    expect(hit?.sources).toEqual([{ name: "linkedin.com", url: "https://www.linkedin.com/jobs/view/123", date: undefined }]);
  });

  it("mantém a faixa quando o modelo não devolve citação estruturada", () => {
    const hit = parseWebSalaryText(
      JSON.stringify({ found: true, currency: "BRL", period: "month", min: 8000, max: 12000, exactMatch: true, roleFound: "analista" }),
      [],
    );
    expect(hit?.found).toBe(true);
    expect(hit?.observation?.min).toBe(8000);
    expect(hit?.observation?.max).toBe(12000);
    expect(hit?.sources).toEqual([]);
  });

  it("lê a citação solta do OpenRouter quando não há sources", () => {
    const cited = readLooseCitations({
      annotations: [{ type: "url_citation", url_citation: { url: "https://www.glassdoor.com.br/Salario/exemplo", title: "Glassdoor" } }],
    });
    expect(cited).toEqual([{ url: "https://www.glassdoor.com.br/Salario/exemplo", title: "Glassdoor" }]);
  });
});
