import { describe, expect, it } from "vitest";

import { glassdoorSalaryLinkLabel, glassdoorSalarySearchUrl } from "./glassdoor";

describe("glassdoorSalarySearchUrl", () => {
  it("monta a busca de cargo no formato que o Glassdoor abre", () => {
    expect(glassdoorSalarySearchUrl({ jobTitle: "Engenheiro de Software" })).toBe(
      "https://www.glassdoor.com.br/Sal%C3%A1rios/engenheiro-de-software-sal%C3%A1rio-SRCH_KO0,22.htm",
    );
  });

  it("monta a busca da empresa e mantém acento", () => {
    expect(glassdoorSalarySearchUrl({ company: "Itaú Unibanco" })).toBe(
      "https://www.glassdoor.com.br/Sal%C3%A1rios/ita%C3%BA-unibanco-sal%C3%A1rio-SRCH_KO0,13.htm",
    );
    expect(glassdoorSalarySearchUrl({ company: "Ênfases" })).toBe(
      "https://www.glassdoor.com.br/Sal%C3%A1rios/%C3%AAnfases-sal%C3%A1rio-SRCH_KO0,7.htm",
    );
  });

  it("prioriza cargo e empresa na mesma busca e no texto do link", () => {
    const url = glassdoorSalarySearchUrl({ company: "Itaú Unibanco", jobTitle: "Desenvolvedor Front-end" });
    expect(url).toBe(
      "https://www.glassdoor.com.br/Sal%C3%A1rios/desenvolvedor-front-end-ita%C3%BA-unibanco-sal%C3%A1rio-SRCH_KO0,37.htm",
    );
    expect(glassdoorSalaryLinkLabel({ company: "Itaú Unibanco", jobTitle: "Desenvolvedor Front-end" })).toBe(
      "Ver salários de Desenvolvedor Front-end na Itaú Unibanco no Glassdoor",
    );
  });

  it("junta cargo e empresa curtos com o cargo na frente", () => {
    const url = glassdoorSalarySearchUrl({ company: "Nubank", jobTitle: "desenvolvedor" });
    expect(url).toBe("https://www.glassdoor.com.br/Sal%C3%A1rios/desenvolvedor-nubank-sal%C3%A1rio-SRCH_KO0,20.htm");
    expect(glassdoorSalaryLinkLabel({ company: "Nubank", jobTitle: "desenvolvedor" })).toBe(
      "Ver salários de desenvolvedor na Nubank no Glassdoor",
    );
  });

  it("usa o cargo quando a empresa não foi identificada", () => {
    expect(glassdoorSalaryLinkLabel({ jobTitle: "desenvolvedor full stack" })).toBe(
      "Ver salários de desenvolvedor full stack no Glassdoor",
    );
    expect(glassdoorSalarySearchUrl({})).toBeUndefined();
  });
});
