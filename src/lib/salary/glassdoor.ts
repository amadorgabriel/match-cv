/**
 * Busca de salários do Glassdoor Brasil.
 * O caminho é o que o próprio site publica, por exemplo
 * /Salários/engenheiro-de-software-salário-SRCH_KO0,22.htm
 * e /Salários/desenvolvedor-front-end-itaú-unibanco-salário-SRCH_KO0,37.htm.
 * KO0,N é o tamanho do termo (hífen no lugar do espaço conta igual).
 * A página por empresa (Salários-E<id>) precisa do id interno e não é
 * montada aqui. Só monta a URL de busca. Não busca a página.
 */

export function glassdoorSalarySearchUrl(input: { company?: string; jobTitle?: string }): string | undefined {
  const keyword = glassdoorKeyword(input.jobTitle, input.company);
  if (!keyword) return undefined;
  const slug = slugify(keyword);
  if (!slug) return undefined;
  return `https://www.glassdoor.com.br/Sal%C3%A1rios/${encodeURIComponent(slug)}-sal%C3%A1rio-SRCH_KO0,${slug.length}.htm`;
}

export function glassdoorSalaryLinkLabel(input: { company?: string; jobTitle?: string }): string {
  const role = clean(input.jobTitle);
  const company = clean(input.company);
  if (role && company) return `Ver salários de ${role} na ${company} no Glassdoor`;
  if (role) return `Ver salários de ${role} no Glassdoor`;
  if (company) return `Ver salários de ${company} no Glassdoor`;
  return "Ver salários no Glassdoor";
}

/** Cargo primeiro, empresa depois. Sem um dos dois, fica só o que existir. */
function glassdoorKeyword(jobTitle?: string, company?: string): string | undefined {
  const parts = [clean(jobTitle), clean(company)].filter(Boolean);
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
