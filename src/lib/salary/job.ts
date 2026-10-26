/**
 * Leitura da vaga para a faixa salarial.
 * Puro: o navegador usa as mensagens de progresso e o servidor normaliza o cargo.
 */

export type Seniority = "estágio" | "júnior" | "pleno" | "sênior" | "lead";

export interface JobAnalysis {
  rawTitle: string;
  normalizedTitle: string;
  family: string;
  seniority?: Seniority;
  company?: string;
  location?: string;
  remote: boolean;
}

const SENIORITY_RULES: { source: string; label: Seniority }[] = [
  { source: "estagi[aá]ri[oa]s?|trainee|est[aá]gio", label: "estágio" },
  { source: "j[uú]niou?r|jr\\.?", label: "júnior" },
  { source: "pleno", label: "pleno" },
  { source: "s[eê]nior|senior|sr\\.?", label: "sênior" },
  { source: "lead|staff|principal", label: "lead" },
];

const TITLE_RULES: { re: RegExp; title: string; family: string }[] = [
  {
    re: /full[\s-]*stack/,
    title: "desenvolvedor full stack",
    family: "desenvolvedor full stack",
  },
  {
    re: /front[\s-]*end|frontend/,
    title: "desenvolvedor front-end",
    family: "desenvolvedor front-end",
  },
  {
    re: /back[\s-]*end|backend/,
    title: "desenvolvedor back-end",
    family: "desenvolvedor back-end",
  },
  {
    re: /devops|\bsre\b|site reliability/,
    title: "engenheiro devops",
    family: "devops",
  },
  {
    re: /engenheiro de dados|data engineer/,
    title: "engenheiro de dados",
    family: "dados",
  },
  {
    re: /cientista de dados|data scientist/,
    title: "cientista de dados",
    family: "dados",
  },
  {
    re: /analista de dados|data analyst/,
    title: "analista de dados",
    family: "dados",
  },
  {
    re: /engenheiro de software|software engineer/,
    title: "engenheiro de software",
    family: "desenvolvedor",
  },
  {
    re: /desenvolvedor|developer|programador|programmer/,
    title: "desenvolvedor",
    family: "desenvolvedor",
  },
  {
    re: /\bqa\b|quality assurance|analista de (teste|qualidade)/,
    title: "analista de qualidade",
    family: "qualidade",
  },
  {
    re: /product owner|\bpo\b|gerente de produto|product manager/,
    title: "product manager",
    family: "produto",
  },
];

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

  return {
    rawTitle,
    normalizedTitle,
    family,
    seniority,
    company,
    location: place.location,
    remote: place.remote,
  };
}

export function salaryProgressMessages(job: JobAnalysis): string[] {
  const target = job.company ? `${job.company} + ${job.normalizedTitle}` : job.normalizedTitle;
  return [`Buscando na web por ${target}…`, "Comparando fontes públicas…", "Preparando o link do Glassdoor…"];
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

function fold(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
