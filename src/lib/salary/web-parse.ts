import type { Salary } from "@/lib/schemas/outputs";

import type { SalaryContract, SalaryCurrency, SalaryObservation } from "./combine";

export interface CitedUrl {
  url: string;
  title?: string;
}

export interface WebSalaryHit {
  found: boolean;
  observation?: SalaryObservation;
  /** Páginas citadas mesmo quando não há número. */
  sources: Salary["sources"];
}

const CURRENCIES = new Set<SalaryCurrency>(["BRL", "USD", "EUR"]);
const CONTRACTS = new Set<SalaryContract>(["CLT", "PJ", "misto", "desconhecido"]);

/**
 * Converte o JSON do modelo em uma observação. Links fora de http(s) são
 * descartados: a busca nativa cita URLs, não raspa a página.
 */
export function parseWebSalaryText(text: string, citedUrls: Array<string | CitedUrl> = []): WebSalaryHit | null {
  const json = extractJson(text);
  if (!json || typeof json !== "object") return null;
  const record = json as Record<string, unknown>;
  // Só entram URLs que a ferramenta devolveu. O JSON do modelo não cria link.
  const sources = sourcesFromCitations(citedUrls, readSources(record.sources));
  const found = record.found === true;
  const min = numberOrUndefined(record.min);
  const max = numberOrUndefined(record.max);
  const median = numberOrUndefined(record.median);
  const currency = typeof record.currency === "string" && CURRENCIES.has(record.currency as SalaryCurrency)
    ? (record.currency as SalaryCurrency)
    : "BRL";
  const period = record.period === "year" ? "year" : "month";
  const contract = typeof record.contract === "string" && CONTRACTS.has(record.contract as SalaryContract)
    ? (record.contract as SalaryContract)
    : undefined;
  const roleFound = cleanText(record.roleFound) || "cargo parecido";
  const exact = record.exactMatch === true;
  const note = cleanText(record.similarRoleNote);
  const asOf = cleanText(record.asOf);
  const dated = sources.map((source) => ({ ...source, date: source.date ?? asOf }));

  if (!found || min === undefined || max === undefined) {
    return { found: false, sources: dated };
  }

  const low = Math.min(min, max);
  const high = Math.max(min, max);
  return {
    found: true,
    sources: dated,
    observation: {
      origin: "web",
      min: low,
      max: high,
      median: median !== undefined && median >= low && median <= high ? median : undefined,
      currency,
      period,
      roleFound,
      exact,
      contract,
      matchedQuery: "busca na web",
      similarRoleNote: exact ? undefined : note,
      sources: dated.map((source) => ({
        ...source,
        note: sourceNote(source.url, source.note, contract),
      })),
    },
  };
}

function readSources(value: unknown): Salary["sources"] {
  if (!Array.isArray(value)) return [];
  const sources: Salary["sources"] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    if (typeof record.url !== "string" || !isHttp(record.url)) continue;
    sources.push({
      name: cleanText(record.name) || hostName(record.url),
      url: record.url,
      date: cleanText(record.date),
    });
  }
  return sources;
}

function sourcesFromCitations(citedUrls: Array<string | CitedUrl>, modelSources: Salary["sources"]): Salary["sources"] {
  const sources: Salary["sources"] = [];
  const seen = new Set<string>();
  for (const item of citedUrls) {
    const url = typeof item === "string" ? item : item.url;
    const title = typeof item === "string" ? undefined : cleanText(item.title);
    if (!isHttp(url)) continue;
    const key = urlKey(url);
    if (seen.has(key)) continue;
    seen.add(key);
    const match = modelSources.find((source) => urlKey(source.url) === key);
    sources.push({
      name: match?.name || title || hostName(url),
      url,
      date: match?.date,
    });
  }
  return sources;
}

function urlKey(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    const path = parsed.pathname.replace(/\/$/, "");
    return `${parsed.protocol}//${parsed.host}${path}${parsed.search}`;
  } catch {
    return url.replace(/\/$/, "");
  }
}

function sourceNote(url: string, note: string | undefined, contract?: SalaryContract): string | undefined {
  const bits = [note];
  if (/levels\.fyi/i.test(url)) bits.push("Remuneração total, não só salário.");
  if (contract && contract !== "desconhecido") bits.push(`Vínculo indicado: ${contract}.`);
  const text = bits.filter(Boolean).join(" ");
  return text || undefined;
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced?.[1] ?? text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as unknown;
  } catch {
    return null;
  }
}

function numberOrUndefined(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return value;
}

function cleanText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/[—–]/g, ", ").replace(/~/g, "").replace(/\s+/g, " ").trim();
  return cleaned || undefined;
}

function isHttp(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function hostName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Fonte";
  }
}
