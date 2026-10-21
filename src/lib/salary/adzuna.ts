import "server-only";

import { mockSalary } from "@/lib/mock/outputs";
import type { Salary } from "@/lib/schemas/outputs";

import { combineSalary, type SalaryObservation } from "./combine";
import { analyzeJob, buildSalaryQueries, queryMatchesExactly, type JobAnalysis, type SalaryQuery } from "./job";

/**
 * Cliente da Adzuna API (https://developer.adzuna.com).
 *
 * - Credenciais do SERVIDOR, lidas de ADZUNA_APP_ID / ADZUNA_APP_KEY.
 *   Nunca vão para o cliente.
 * - Sem credenciais, devolve dados de exemplo (isMock: true).
 * - Termos de uso: exibir a atribuição "Adzuna" com link. Estimativas
 *   salariais levam o selo "Adzuna Jobsworth". Uso comercial exige acordo
 *   por escrito com a Adzuna.
 *
 * O histograma brasileiro é tratado como valor anual e depois convertido
 * para reais por mês na combinação das fontes.
 */

const ADZUNA_BASE_URL = "https://api.adzuna.com/v1/api/jobs";
const DEFAULT_COUNTRY = "br";
const TIMEOUT_MS = 8_000;

export interface AdzunaCredentials {
  appId: string;
  appKey: string;
}

export interface AdzunaMatch {
  min: number;
  median?: number;
  max: number;
  sampleSize: number;
  query: SalaryQuery;
}

export interface AdzunaSearchResult {
  configured: boolean;
  match: AdzunaMatch | null;
  tried: string[];
}

export function getAdzunaCredentials(): AdzunaCredentials | null {
  const appId = process.env.ADZUNA_APP_ID?.trim();
  const appKey = process.env.ADZUNA_APP_KEY?.trim();
  return appId && appKey ? { appId, appKey } : null;
}

/** Resposta do endpoint /jobs/{country}/histogram */
interface AdzunaHistogramResponse {
  histogram?: Record<string, number | string>;
}

export function normalizeHistogram(histogram: Record<string, number | string> | undefined): Record<string, number> {
  const normalized: Record<string, number> = {};
  for (const [bucket, count] of Object.entries(histogram ?? {})) {
    const value = typeof count === "number" ? count : Number(count);
    if (Number.isFinite(value)) normalized[bucket] = value;
  }
  return normalized;
}

/** Percentil ponderado a partir dos buckets do histograma. */
export function histogramPercentile(histogram: Record<string, number>, p: number): number | undefined {
  const buckets = Object.entries(histogram)
    .map(([k, v]) => [Number(k), v] as const)
    .filter(([k, v]) => Number.isFinite(k) && v > 0)
    .sort((a, b) => a[0] - b[0]);
  const total = buckets.reduce((acc, [, v]) => acc + v, 0);
  if (total === 0) return undefined;
  let acc = 0;
  for (const [value, count] of buckets) {
    acc += count;
    if (acc / total >= p) return value;
  }
  return buckets[buckets.length - 1][0];
}

export async function searchAdzuna(
  job: JobAnalysis,
  options?: { fetchImpl?: typeof fetch; credentials?: AdzunaCredentials | null; country?: string },
): Promise<AdzunaSearchResult> {
  const creds = options && "credentials" in options ? options.credentials : getAdzunaCredentials();
  if (!creds) return { configured: false, match: null, tried: ["Adzuna sem credencial no servidor."] };
  const fetchImpl = options?.fetchImpl ?? fetch;
  const country = options?.country ?? DEFAULT_COUNTRY;
  const tried: string[] = [];

  for (const query of buildSalaryQueries(job)) {
    const label = describeQuery(query);
    try {
      const histogram = await fetchHistogram(query, creds, country, fetchImpl);
      const match = matchFromHistogram(histogram, query);
      if (!match) {
        tried.push(`${label}: sem dados`);
        continue;
      }
      tried.push(`${label}: encontrou ${match.sampleSize} anúncios`);
      return { configured: true, match, tried };
    } catch {
      tried.push(`${label}: consulta indisponível`);
    }
  }

  return { configured: true, match: null, tried };
}

export function adzunaObservation(job: JobAnalysis, match: AdzunaMatch): SalaryObservation {
  const exact = queryMatchesExactly(job, match.query.kind);
  return {
    origin: "adzuna",
    min: match.min,
    median: match.median,
    max: match.max,
    currency: "BRL",
    period: "year",
    roleFound: match.query.foundRole,
    exact,
    sampleSize: match.sampleSize,
    matchedQuery: `Adzuna: ${match.query.label}`,
    sources: [
      {
        name: "Adzuna",
        url: "https://www.adzuna.com.br",
        note: "Histograma de salários anunciados (percentis 10, 50 e 90), convertido de valor anual para mensal. Estimativas: Adzuna Jobsworth.",
      },
    ],
  };
}

export async function fetchSalaryRange(params: {
  jobTitle: string;
  location?: string;
  country?: string;
}): Promise<Salary> {
  const job = analyzeJob({ jobTitle: params.jobTitle, location: params.location });
  const result = await searchAdzuna(job, { country: params.country });
  if (!result.configured) return mockSalary(params.jobTitle, params.location);
  if (!result.match) throw new Error("adzuna_no_data");
  return combineSalary(job, [adzunaObservation(job, result.match)], result.tried);
}

async function fetchHistogram(
  query: SalaryQuery,
  creds: AdzunaCredentials,
  country: string,
  fetchImpl: typeof fetch,
): Promise<Record<string, number>> {
  const url = new URL(`${ADZUNA_BASE_URL}/${country}/histogram`);
  url.searchParams.set("app_id", creds.appId);
  url.searchParams.set("app_key", creds.appKey);
  if (query.what) url.searchParams.set("what", query.what);
  if (query.whatAnd) url.searchParams.set("what_and", query.whatAnd);
  if (query.whatOr) url.searchParams.set("what_or", query.whatOr);
  if (query.where) url.searchParams.set("where", query.where);

  // A URL contém as credenciais: nunca logar `url`.
  const res = await fetchImpl(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`adzuna_http_${res.status}`);
  const json = (await res.json()) as AdzunaHistogramResponse;
  return normalizeHistogram(json.histogram);
}

function matchFromHistogram(histogram: Record<string, number>, query: SalaryQuery): AdzunaMatch | null {
  const sampleSize = Object.values(histogram).reduce((acc, count) => acc + count, 0);
  const min = histogramPercentile(histogram, 0.1);
  const median = histogramPercentile(histogram, 0.5);
  const max = histogramPercentile(histogram, 0.9);
  if (min === undefined || max === undefined || sampleSize <= 0) return null;
  return { min, median, max, sampleSize, query };
}

function describeQuery(query: SalaryQuery): string {
  const bits = [`Adzuna ${query.label}`];
  if (query.what) bits.push(`what=${query.what}`);
  if (query.whatAnd) bits.push(`what_and=${query.whatAnd}`);
  if (query.whatOr) bits.push(`what_or=${query.whatOr}`);
  if (query.where) bits.push(`where=${query.where}`);
  return bits.join(", ");
}

/**
 * Heurística provisória para extrair o cargo da vaga.
 * A faixa salarial usa analyzeJob, que normaliza o título.
 */
export function guessJobTitle(jobDescription: string): string {
  const firstLine = jobDescription
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  return (firstLine ?? "Desenvolvedor").replace(/^(vaga|cargo|position|role)\s*[:-]\s*/i, "").slice(0, 80);
}
