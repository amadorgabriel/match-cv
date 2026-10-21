/**
 * Busca de salários do Glassdoor Brasil.
 * O caminho é o que o próprio site publica, por exemplo
 * /Salários/engenheiro-de-software-salário-SRCH_KO0,22.htm
 * e /Salários/itaú-unibanco-salário-SRCH_KO0,13.htm.
 * KO0,N é o tamanho do termo (hífen no lugar do espaço conta igual).
 * Só monta a URL. Não busca a página.
 */

export function glassdoorSalarySearchUrl(input: { company?: string; jobTitle?: string }): string | undefined {
  const keyword = glassdoorKeyword(input.company, input.jobTitle);
  if (!keyword) return undefined;
  const slug = slugify(keyword);
  if (!slug) return undefined;
  return `https://www.glassdoor.com.br/Sal%C3%A1rios/${encodeURIComponent(slug)}-sal%C3%A1rio-SRCH_KO0,${slug.length}.htm`;
}

export function glassdoorSalaryLinkLabel(input: { company?: string; jobTitle?: string }): string {
  const who = clean(input.company) || clean(input.jobTitle);
  return who ? `Ver salários de ${who} no Glassdoor` : "Ver salários no Glassdoor";
}

function glassdoorKeyword(company?: string, jobTitle?: string): string | undefined {
  const parts = [clean(company), clean(jobTitle)].filter(Boolean);
  return parts.length ? parts.join(" ") : undefined;
}

function clean(value: string | undefined): string {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function slugify(keyword: string): string {
  return keyword
    .toLocaleLowerCase("pt-BR")
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}
