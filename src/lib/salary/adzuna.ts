import "server-only";

import { mockSalary } from "@/lib/mock/outputs";
import type { Salary } from "@/lib/schemas/outputs";

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
 * TODO(Adzuna): confirmar cobertura de cargos de TI no Brasil, unidade dos
 * valores (anual) e limites do plano gratuito dentro da conta.
 */

const ADZUNA_BASE_URL = "https://api.adzuna.com/v1/api/jobs";
const DEFAULT_COUNTRY = "br";
const TIMEOUT_MS = 8_000;

export interface AdzunaCredentials {
  appId: string;
  appKey: string;
}

export function getAdzunaCredentials(): AdzunaCredentials | null {
  const appId = process.env.ADZUNA_APP_ID?.trim();
  const appKey = process.env.ADZUNA_APP_KEY?.trim();
  return appId && appKey ? { appId, appKey } : null;
}

/** Resposta do endpoint /jobs/{country}/histogram */
interface AdzunaHistogramResponse {
  histogram?: Record<string, number>;
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

export async function fetchSalaryRange(params: {
  jobTitle: string;
  location?: string;
  country?: string;
}): Promise<Salary> {
  const creds = getAdzunaCredentials();
  if (!creds) return mockSalary(params.jobTitle, params.location);

  const country = params.country ?? DEFAULT_COUNTRY;
  const url = new URL(`${ADZUNA_BASE_URL}/${country}/histogram`);
  url.searchParams.set("app_id", creds.appId);
  url.searchParams.set("app_key", creds.appKey);
  url.searchParams.set("what", params.jobTitle);
  if (params.location) url.searchParams.set("where", params.location);

  // A URL contém as credenciais: nunca logar `url`.
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`adzuna_http_${res.status}`);

  const json = (await res.json()) as AdzunaHistogramResponse;
  const histogram = json.histogram ?? {};
  const sampleSize = Object.values(histogram).reduce((a, b) => a + b, 0);
  const min = histogramPercentile(histogram, 0.1);
  const median = histogramPercentile(histogram, 0.5);
  const max = histogramPercentile(histogram, 0.9);

  if (min === undefined || max === undefined) {
    throw new Error("adzuna_no_data");
  }

  return {
    currency: "BRL",
    period: "year",
    min,
    median,
    max,
    query: { jobTitle: params.jobTitle, location: params.location },
    sampleSize,
    isEstimate: true,
    isMock: false,
    sources: [
      {
        name: "Adzuna",
        url: "https://www.adzuna.com.br",
        note: "Histograma de salários anunciados (percentis 10, 50 e 90). Estimativas: Adzuna Jobsworth.",
      },
    ],
    disclaimer:
      "Estimativa baseada em anúncios de vagas. Não distingue CLT de PJ e depende do volume de anúncios para o cargo e a cidade.",
  };
}

/**
 * Heurística provisória para extrair o cargo da vaga.
 * TODO(IA): substituir pela etapa de análise com Output.object (JOB_ANALYSIS_SYSTEM).
 */
export function guessJobTitle(jobDescription: string): string {
  const firstLine = jobDescription
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  return (firstLine ?? "Desenvolvedor").replace(/^(vaga|cargo|position|role)\s*[:-]\s*/i, "").slice(0, 80);
}
