/**
 * Leitura da vaga para a faixa salarial.
 * Puro: o navegador usa as mensagens de progresso e o servidor monta as queries.
 */

export type Seniority = "estágio" | "júnior" | "pleno" | "sênior" | "lead";
export type QueryKind = "exact_location" | "title" | "family" | "related_seniority";

export interface JobAnalysis {
  rawTitle: string;
  normalizedTitle: string;
  family: string;
  familyTerms: string[];
  relatedTerms: string[];
  /** Termos que distinguem a família, para o what_and da senioridade próxima. */
  anchor: string;
  seniority?: Seniority;
  company?: string;
  location?: string;
  remote: boolean;
}

export interface SalaryQuery {
  kind: QueryKind;
  label: string;
  foundRole: string;
  what?: string;
  whatAnd?: string;
  whatOr?: string;
  where?: string;
}

const SENIORITY_RULES: { source: string; label: Seniority }[] = [
  { source: "estagi[aá]ri[oa]s?|trainee|est[aá]gio", label: "estágio" },
  { source: "j[uú]niou?r|jr\\.?", label: "júnior" },
  { source: "pleno", label: "pleno" },
  { source: "s[eê]nior|senior|sr\\.?", label: "sênior" },
  { source: "lead|staff|principal", label: "lead" },
];

const TITLE_RULES: { re: RegExp; title: string; family: string; terms: string[] }[] = [
  {
    re: /full[\s-]*stack/,
    title: "desenvolvedor full stack",
    family: "desenvolvedor full stack",
    terms: ["desenvolvedor full stack", "full stack developer"],
  },
  {
    re: /front[\s-]*end|frontend/,
    title: "desenvolvedor front-end",
    family: "desenvolvedor front-end",
    terms: ["desenvolvedor front-end", "front-end developer", "desenvolvedor frontend"],
  },
  {
    re: /back[\s-]*end|backend/,
    title: "desenvolvedor back-end",
    family: "desenvolvedor back-end",
    terms: ["desenvolvedor back-end", "back-end developer", "desenvolvedor backend"],
  },
  {
    re: /devops|\bsre\b|site reliability/,
    title: "engenheiro devops",
    family: "devops",
    terms: ["engenheiro devops", "devops", "sre"],
  },
  {
    re: /engenheiro de dados|data engineer/,
    title: "engenheiro de dados",
    family: "dados",
    terms: ["engenheiro de dados", "data engineer"],
  },
  {
    re: /cientista de dados|data scientist/,
    title: "cientista de dados",
    family: "dados",
    terms: ["cientista de dados", "data scientist"],
  },
  {
    re: /analista de dados|data analyst/,
    title: "analista de dados",
    family: "dados",
    terms: ["analista de dados", "data analyst"],
  },
  {
    re: /engenheiro de software|software engineer/,
    title: "engenheiro de software",
    family: "desenvolvedor",
    terms: ["engenheiro de software", "software engineer", "desenvolvedor"],
  },
  {
    re: /desenvolvedor|developer|programador|programmer/,
    title: "desenvolvedor",
    family: "desenvolvedor",
    terms: ["desenvolvedor", "developer"],
  },
  {
    re: /\bqa\b|quality assurance|analista de (teste|qualidade)/,
    title: "analista de qualidade",
    family: "qualidade",
    terms: ["analista de qualidade", "qa", "analista de testes"],
  },
  {
    re: /product owner|\bpo\b|gerente de produto|product manager/,
    title: "product manager",
    family: "produto",
    terms: ["product manager", "gerente de produto", "product owner"],
  },
];

const STOP_WORDS = new Set(["desenvolvedor", "desenvolvedora", "engenheiro", "engenheira", "de", "da", "do", "em"]);

export function analyzeJob(input: { jobTitle?: string; location?: string; jobDescription?: string }): JobAnalysis {
  const description = input.jobDescription ?? "";
  const company = extractCompany(description);
  const place = extractLocation(description, input.location);
  const rawTitle = extractRawTitle(description, input.jobTitle);
  const cleaned = cleanTitle(rawTitle, company);
  const folded = fold(cleaned);
  const rule = TITLE_RULES.find((item) => item.re.test(folded));
  const { seniority, rest } = takeSeniority(cleaned);
  const fallback = stripNoise(rest) || "desenvolvedor";
  const normalizedTitle = rule?.title ?? fallback;
  const family = rule?.family ?? normalizedTitle;
  const familyTerms = rule?.terms ?? [normalizedTitle];
  const relatedTerms = relatedRoles(normalizedTitle, seniority);
  const anchor = anchorOf(normalizedTitle);

  return {
    rawTitle,
    normalizedTitle,
    family,
    familyTerms,
    relatedTerms,
    anchor,
    seniority,
    company,
    location: place.location,
    remote: place.remote,
  };
}

export function buildSalaryQueries(job: JobAnalysis): SalaryQuery[] {
  const queries: SalaryQuery[] = [];
  const title = job.normalizedTitle;
  if (job.location && !job.remote) {
    queries.push({
      kind: "exact_location",
      label: `título e local (${title} em ${job.location})`,
      foundRole: title,
      what: title,
      where: job.location,
    });
  }
  queries.push({
    kind: "title",
    label: `título sem local (${title})`,
    foundRole: title,
    what: title,
  });
  queries.push({
    kind: "family",
    label: `família mais ampla (${job.familyTerms.join(" ou ")})`,
    foundRole: job.family,
    whatOr: job.familyTerms.join(" "),
  });
  const related = job.relatedTerms.join(" ou ");
  queries.push({
    kind: "related_seniority",
    label: `senioridade próxima (${related})`,
    foundRole: job.relatedTerms[0] ?? title,
    whatOr: job.relatedTerms.join(" "),
    ...(job.anchor ? { whatAnd: job.anchor } : {}),
  });
  return queries;
}

/** A consulta do título normalizado só é exata quando a vaga não pedia senioridade. */
export function queryMatchesExactly(job: JobAnalysis, kind: QueryKind): boolean {
  if (kind === "family" || kind === "related_seniority") return false;
  return !job.seniority;
}

export function salaryProgressMessages(job: JobAnalysis): string[] {
  const target = job.company ? `${job.company} + ${job.normalizedTitle}` : job.normalizedTitle;
  return ["Consultando Adzuna…", `Buscando na web por ${target}…`, "Comparando fontes…"];
}

export function similarRoleNote(seniority: string | undefined, foundRole: string, exact: boolean): string | undefined {
  if (exact) return undefined;
  const level = seniority ?? "exata";
  return `Não encontramos a faixa de ${level} para esse cargo, mas temos a de ${foundRole}, apesar de não ser a mesma vaga.`;
}

function extractRawTitle(description: string, explicit?: string): string {
  if (explicit?.trim()) return explicit.trim().slice(0, 120);
  const lines = description
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  for (const line of lines) {
    const labeled = line.match(/^(?:vaga|cargo|position|role|t[ií]tulo|titulo)\s*[:\-]\s*(.+)$/i);
    if (labeled?.[1]) return labeled[1].trim().slice(0, 120);
  }
  for (const line of lines) {
    const hiring = line.match(/^(?:estamos|estou)\s+(?:contratando|buscando|procurando)\s+(?:um|uma|o|a)?\s*(.+)$/i);
    if (hiring?.[1]) return hiring[1].trim().slice(0, 120);
  }
  const titled = lines.find((line) => TITLE_RULES.some((rule) => rule.re.test(fold(line))));
  if (titled) return titled.slice(0, 120);
  const short = lines.find((line) => line.length <= 90 && !/[.!?]$/.test(line));
  return (short ?? "Desenvolvedor").replace(/^(?:vaga|cargo|position|role)\s*[:\-]\s*/i, "").slice(0, 80);
}

function extractCompany(description: string): string | undefined {
  const labeled = description.match(/^(?:empresa|company|companhia|contratante)\s*[:\-]\s*(.+)$/im);
  const fromLabel = labeled?.[1] ? cleanOrg(labeled[1]) : undefined;
  if (fromLabel) return fromLabel;
  const inline = description.match(/\b(?:na|no|at)[ \t]+([A-ZÁÉÍÓÚÂÊÔÃÕ][\p{L}\d.&'-]{1,40}(?:[ \t]+[A-ZÁÉÍÓÚÂÊÔÃÕ][\p{L}\d.&'-]{1,40}){0,2})/u);
  return inline?.[1] ? cleanOrg(inline[1]) : undefined;
}

function extractLocation(description: string, explicit?: string): { location?: string; remote: boolean } {
  if (explicit?.trim()) {
    const location = explicit.trim().slice(0, 80);
    return { location, remote: isRemote(location) };
  }
  const labeled = description.match(/^(?:local(?:idade)?|location|cidade|city)\s*[:\-]\s*(.+)$/im);
  const head = `${labeled?.[1] ?? ""}\n${description.slice(0, 600)}`;
  const remote = isRemote(head);
  if (labeled?.[1]) return { location: labeled[1].trim().slice(0, 80), remote: remote || isRemote(labeled[1]) };
  const city = description.match(
    /\b(S[aã]o Paulo|Rio de Janeiro|Belo Horizonte|Curitiba|Porto Alegre|Bras[ií]lia|Florian[oó]polis|Recife|Fortaleza|Campinas|Salvador)(?:\s*[-/]\s*[A-Z]{2})?\b/,
  );
  if (city?.[0]) return { location: city[0], remote };
  if (remote) return { location: "remoto", remote: true };
  return { remote: false };
}

function isRemote(value: string): boolean {
  return /\b(remoto|home\s*office|100%\s*remote|trabalho remoto)\b/i.test(value);
}

function cleanOrg(value: string): string | undefined {
  const cleaned = value.split(/[|,(]/)[0]?.replace(/\s+/g, " ").trim() ?? "";
  if (cleaned.length < 2 || cleaned.length > 80) return undefined;
  if (/^(a|o|as|os|área|area|vaga|empresa|time|equipe|região|regiao|cidade|modalidade|posição|posicao)$/i.test(cleaned)) {
    return undefined;
  }
  return cleaned;
}

function cleanTitle(raw: string, company?: string): string {
  let text = raw.replace(/^(?:vaga|cargo|position|role)\s*[:\-]\s*/i, " ");
  if (company) text = text.replace(new RegExp(escapeRegExp(company), "ig"), " ");
  text = text.replace(/\b(remoto|home\s*office|h[ií]brido|clt|pj|brasil|brazil)\b/gi, " ");
  text = text.replace(/[|/]+/g, " ");
  return text.replace(/\s+/g, " ").trim();
}

function takeSeniority(text: string): { seniority?: Seniority; rest: string } {
  let seniority: Seniority | undefined;
  let earliest = Infinity;
  for (const rule of SENIORITY_RULES) {
    const match = new RegExp(`\\b(?:${rule.source})\\b`, "i").exec(text);
    if (match && match.index < earliest) {
      earliest = match.index;
      seniority = rule.label;
    }
  }
  const rest = SENIORITY_RULES.reduce(
    (acc, rule) => acc.replace(new RegExp(`\\b(?:${rule.source})\\b`, "gi"), " "),
    text,
  ).replace(/\s+/g, " ").trim();
  return { seniority, rest };
}

function stripNoise(text: string): string {
  return text
    .replace(/\b(analyst|analista)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function anchorOf(title: string): string {
  return title
    .split(/\s+/)
    .filter((token) => !STOP_WORDS.has(fold(token)))
    .join(" ");
}

function relatedRoles(title: string, seniority?: Seniority): string[] {
  const levels = (["júnior", "pleno", "sênior"] as const).filter((level) => level !== seniority);
  return levels.map((level) => withLevel(title, level));
}

function withLevel(title: string, level: string): string {
  const parts = title.split(/\s+/);
  const head = parts[0]?.toLowerCase() ?? "";
  if (["desenvolvedor", "engenheiro", "analista", "cientista"].includes(head)) {
    return [parts[0], level, ...parts.slice(1)].join(" ");
  }
  return `${title} ${level}`;
}

function fold(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
