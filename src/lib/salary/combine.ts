import type { Salary } from "@/lib/schemas/outputs";

import { similarRoleNote, type JobAnalysis } from "./job";

export type SalaryCurrency = "BRL" | "USD" | "EUR";
export type SalaryContract = "CLT" | "PJ" | "misto" | "desconhecido";

/** Câmbio aproximado só para colocar fontes estrangeiras na mesma escala. */
const FX_TO_BRL: Record<SalaryCurrency, number> = { BRL: 1, USD: 5.5, EUR: 6 };

export interface SalaryObservation {
  origin: "adzuna" | "web";
  min: number;
  median?: number;
  max: number;
  currency: SalaryCurrency;
  period: "month" | "year";
  roleFound: string;
  exact: boolean;
  sampleSize?: number;
  matchedQuery?: string;
  contract?: SalaryContract;
  sources: Salary["sources"];
  similarRoleNote?: string;
}

interface Monthly {
  min: number;
  median?: number;
  max: number;
  fx: boolean;
}

export function toMonthlyBrl(observation: Pick<SalaryObservation, "min" | "median" | "max" | "currency" | "period">): Monthly {
  const fx = FX_TO_BRL[observation.currency] ?? 1;
  const perMonth = observation.period === "year" ? 1 / 12 : 1;
  const scale = fx * perMonth;
  const round = (value: number) => Math.max(0, Math.round(value * scale));
  return {
    min: round(observation.min),
    median: observation.median === undefined ? undefined : round(observation.median),
    max: round(observation.max),
    fx: observation.currency !== "BRL",
  };
}

export function rangesOverlap(left: { min: number; max: number }, right: { min: number; max: number }): boolean {
  return left.min <= right.max && right.min <= left.max;
}

export function combineSalary(
  job: JobAnalysis,
  observations: SalaryObservation[],
  tried: string[],
  extraSources: Salary["sources"] = [],
): Salary {
  const usable = observations.filter((item) => Number.isFinite(item.min) && Number.isFinite(item.max) && item.max >= item.min);
  const baseQuery = {
    jobTitle: job.normalizedTitle,
    location: job.location,
    company: job.company,
  };

  if (usable.length === 0) {
    return {
      currency: "BRL",
      period: "month",
      available: false,
      query: baseQuery,
      tried,
      isEstimate: true,
      isMock: false,
      sources: extraSources,
      disclaimer: "Faixa não disponível para este cargo com as fontes consultadas.",
    };
  }

  const monthly = usable.map((item) => ({ item, money: toMonthlyBrl(item) }));
  const adzuna = monthly.filter((item) => item.item.origin === "adzuna");
  const web = monthly.filter((item) => item.item.origin === "web");
  const concordant = adzuna.length > 0 && web.length > 0 && rangesOverlap(adzuna[0].money, web[0].money);
  const chosen = concordant ? monthly : adzuna.length > 0 ? adzuna : web;
  const confidence = concordant ? "alta" : adzuna.length > 0 ? "media" : "baixa";
  const min = average(chosen.map((item) => item.money.min));
  const max = average(chosen.map((item) => item.money.max));
  const medians = chosen.map((item) => item.money.median).filter((value): value is number => value !== undefined);
  const primary = chosen[0].item;
  const exact = chosen.every((item) => item.item.exact);
  const roleFound = primary.roleFound;
  const note = !exact ? primary.similarRoleNote || similarRoleNote(job.seniority, roleFound, false) : undefined;
  const fx = chosen.some((item) => item.money.fx);
  const contracts = new Set(chosen.map((item) => item.item.contract).filter((value): value is SalaryContract => !!value && value !== "desconhecido"));
  const sampleSize = adzuna[0]?.item.sampleSize;

  const notes = [
    "Estimativa em reais por mês. Não substitui uma proposta e pode misturar CLT e PJ.",
  ];
  if (chosen.some((item) => item.item.period === "year" || item.item.origin === "adzuna")) {
    notes.push("Valores anuais foram divididos por 12.");
  }
  if (fx) notes.push("Valores em moeda estrangeira usam câmbio aproximado de 5,50 para o dólar e 6,00 para o euro.");
  if (adzuna.length > 0 && web.length > 0 && !concordant) {
    notes.push("As fontes divergem. A faixa mostrada prioriza o histograma da Adzuna.");
  }

  return {
    currency: "BRL",
    period: "month",
    available: true,
    min,
    median: medians.length > 0 ? average(medians) : undefined,
    max,
    confidence,
    contract: contracts.size === 1 ? [...contracts][0] : contracts.size > 1 ? "misto" : undefined,
    query: {
      ...baseQuery,
      matchedQuery: chosen.map((item) => item.item.matchedQuery).filter(Boolean).join("; ") || undefined,
      comparedRole: !exact && roleFound ? roleFound : undefined,
    },
    similarRoleNote: note,
    tried,
    sampleSize,
    isEstimate: true,
    isMock: false,
    sources: dedupeSources([...monthly.flatMap((item) => item.item.sources), ...extraSources]),
    disclaimer: notes.join(" "),
  };
}

function average(values: number[]): number {
  return Math.round(values.reduce((acc, value) => acc + value, 0) / values.length);
}

function dedupeSources(sources: Salary["sources"]): Salary["sources"] {
  const seen = new Set<string>();
  const unique: Salary["sources"] = [];
  for (const source of sources) {
    const key = source.url.replace(/\/$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(source);
  }
  return unique;
}
