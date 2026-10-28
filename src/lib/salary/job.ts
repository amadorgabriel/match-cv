/**
 * Leitura da vaga para a faixa salarial.
 * O brief estruturado tem prioridade. O regex só entra se o campo vier vazio.
 */

import type { WorkModel } from "@/lib/schemas/brief";

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

export interface AnalyzeJobInput {
  jobTitle?: string | null;
  /** Cargo canônico vindo de brief.job. Não é reescrito pela heurística. */
  normalizedSearchTitle?: string | null;
  seniority?: string | null;
  candidateSeniority?: string | null;
  company?: string | null;
  location?: string | null;
  workModel?: WorkModel | null;
  jobDescription?: string | null;
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

/** Cabeçalhos de seção que não são o cargo. */
const GENERIC_HEADERS = new Set([
  "sobre a vaga",
  "sobre nos",
  "sobre a empresa",
  "descricao da vaga",
  "responsabilidades",
  "requisitos",
  "requisitos obrigatorios",
  "requisitos desejaveis",
  "o que voce vai fazer",
  "atividades",
  "beneficios",
  "como se candidatar",
]);

/**
 * Palavras que não fazem parte do cargo.
 * "analista" e "analyst" ficam de fora de propósito: são o cargo, não ruído.
 */
const NOISE_WORDS = ["oportunidade", "opportunity"] as const;

const BLOCKED_ORG_EXACT = new Set([
  "a",
  "o",
  "as",
  "os",
  "vaga",
  "empresa",
  "time",
  "equipe",
  "regiao",
  "cidade",
  "modalidade",
  "posicao",
  "area",
  "brasil",
  "brazil",
  "america",
  "america latina",
  "latin america",
  "latam",
  "nossa equipe",
  "nosso time",
  "scale",
  "global",
  "mundo",
  "remoto",
  "home office",
  "hibrido",
  "presencial",
  "clt",
  "pj",
]);

export function analyzeJob(input: AnalyzeJobInput): JobAnalysis {
  const heuristic = analyzeFromText({
    jobTitle: input.jobTitle,
    location: input.location,
    jobDescription: input.jobDescription,
  });
  const structuredTitle = cleanOptional(input.normalizedSearchTitle);
  const normalizedTitle = structuredTitle ?? heuristic.normalizedTitle;
  const rule = structuredTitle ? TITLE_RULES.find((item) => item.re.test(fold(structuredTitle))) : undefined;
  const explicitCompany = input.company ? cleanOrg(input.company) : undefined;
  const location = cleanOptional(input.location) ?? heuristic.location;

  return {
    rawTitle: cleanOptional(input.jobTitle) ?? structuredTitle ?? heuristic.rawTitle,
    normalizedTitle,
    family: structuredTitle ? (rule?.family ?? structuredTitle) : heuristic.family,
    seniority: parseSeniority(input.seniority) ?? parseSeniority(input.candidateSeniority) ?? heuristic.seniority,
    company: explicitCompany ?? heuristic.company,
    location,
    remote: resolveRemote(input.workModel, location, heuristic.remote),
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

export function parseSeniority(value?: string | null): Seniority | undefined {
  const text = cleanOptional(value);
  if (!text) return undefined;
  for (const rule of SENIORITY_RULES) {
    if (new RegExp(`\\b(?:${rule.source})\\b`, "i").test(text)) return rule.label;
  }
  return undefined;
}

function analyzeFromText(input: { jobTitle?: string | null; location?: string | null; jobDescription?: string | null }): JobAnalysis {
  const description = input.jobDescription ?? "";
  const company = extractCompany(description);
  const place = extractLocation(description, cleanOptional(input.location) ?? undefined);
  const rawTitle = extractRawTitle(description, cleanOptional(input.jobTitle) ?? undefined);
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

function extractRawTitle(description: string, explicit?: string): string {
  if (explicit?.trim()) return explicit.trim().slice(0, 120);
  const lines = description
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !isGenericHeader(line));

  for (const line of lines) {
    const labeled = line.match(/^(?:vaga|cargo|position|role|t[ií]tulo|titulo)\s*[:\-]\s*(.+)$/i);
    if (labeled?.[1] && !isIncidentalMention(labeled[1])) return labeled[1].trim().slice(0, 120);
  }
  for (const line of lines) {
    const hiring = line.match(/^(?:estamos|estou)\s+(?:contratando|buscando|procurando)\s+(?:um|uma|o|a)?\s*(.+)$/i);
    if (hiring?.[1] && !isIncidentalMention(hiring[1])) return hiring[1].trim().slice(0, 120);
  }

  const opening = openingLines(lines);
  const headerTitle = pickTitle(opening);
  if (headerTitle) return headerTitle;

  const rest = lines.filter((line) => !opening.includes(line) && !isIncidentalMention(line) && !isMetaLine(line));
  const bodyTitle = pickTitle(rest);
  if (bodyTitle) return bodyTitle;

  const short = opening.find((line) => isTitleShape(line));
  return (short ?? "Desenvolvedor").replace(/^(?:vaga|cargo|position|role)\s*[:\-]\s*/i, "").slice(0, 80);
}

function openingLines(lines: string[]): string[] {
  const opening: string[] = [];
  for (const line of lines) {
    if (isMetaLine(line)) continue;
    opening.push(line);
    if (opening.length >= 4 || line.length > 140) break;
  }
  return opening;
}

function pickTitle(lines: string[]): string | undefined {
  const titled = lines.find((line) => !isIncidentalMention(line) && !isMetaLine(line) && TITLE_RULES.some((rule) => rule.re.test(fold(line))));
  if (titled) return titled.slice(0, 120);
  const short = lines.find((line) => isTitleShape(line));
  return short?.slice(0, 120);
}

function isTitleShape(line: string): boolean {
  return line.length <= 90 && !/[.!?]$/.test(line) && !isIncidentalMention(line) && !isMetaLine(line) && !isGenericHeader(line);
}

function isGenericHeader(line: string): boolean {
  const folded = fold(line).replace(/[:\-–—]+$/g, "").trim();
  return GENERIC_HEADERS.has(folded);
}

function isMetaLine(line: string): boolean {
  return /^(?:empresa|company|companhia|contratante|local(?:idade)?|location|cidade|city|modelo|modalidade|senioridade|n[ií]vel)\s*[:\-]/i.test(line);
}

/** Menção no meio do texto, como "atuar com QA e Product Owner", não é o cargo. */
function isIncidentalMention(line: string): boolean {
  return /\b(atuar|atuando|trabalhar|trabalhando|colaborar|colaborando|parceria|junto\s+(?:com|a|ao|à)|interagir|apoiar)\b/i.test(line);
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

function resolveRemote(workModel: WorkModel | null | undefined, location: string | undefined, fallback: boolean): boolean {
  if (workModel === "remoto") return true;
  if (workModel === "presencial" || workModel === "hibrido") return false;
  if (location && isRemote(location)) return true;
  if (location) return false;
  return fallback;
}

function isRemote(value: string): boolean {
  return /\b(remoto|home\s*office|100%\s*remote|trabalho remoto)\b/i.test(value);
}

function cleanOrg(value: string): string | undefined {
  const cleaned = value.split(/[|,(]/)[0]?.replace(/\s+/g, " ").trim() ?? "";
  if (cleaned.length < 2 || cleaned.length > 80) return undefined;
  if (isBlockedOrg(cleaned)) return undefined;
  return cleaned;
}

function isBlockedOrg(value: string): boolean {
  const folded = fold(value);
  if (BLOCKED_ORG_EXACT.has(folded)) return true;
  if (/^(time|equipe|area)\b/.test(folded)) return true;
  if (/^(nossa equipe|nosso time)$/.test(folded)) return true;
  return false;
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
  const pattern = new RegExp(`\\b(?:${NOISE_WORDS.join("|")})\\b`, "gi");
  return text.replace(pattern, " ").replace(/\s+/g, " ").trim();
}

function cleanOptional(value?: string | null): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 160) : undefined;
}

function fold(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
