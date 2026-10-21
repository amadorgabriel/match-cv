import "server-only";

import type { ProviderId } from "@/lib/ai/catalog";
import { supportsNativeWebSearch } from "@/lib/ai/providers";
import { mockSalary } from "@/lib/mock/outputs";
import { SalarySchema, type Salary } from "@/lib/schemas/outputs";

import { adzunaObservation, searchAdzuna } from "./adzuna";
import { readSalaryCache, salaryCacheKey, writeSalaryCache } from "./cache";
import { combineSalary, type SalaryObservation } from "./combine";
import { analyzeJob } from "./job";
import { searchWebSalary, WebSearchRateLimitError } from "./web";

export class SalaryRateLimitError extends Error {
  readonly retryAfterSec: number;

  constructor(retryAfterSec: number) {
    super("salary_rate_limited");
    this.name = "SalaryRateLimitError";
    this.retryAfterSec = retryAfterSec;
  }
}

export async function lookupSalary(input: {
  jobTitle?: string;
  location?: string;
  jobDescription?: string;
  provider?: ProviderId;
  model?: string;
  apiKey?: string;
  realAi: boolean;
  signal?: AbortSignal;
}): Promise<Salary> {
  const job = analyzeJob(input);
  const webProvider = input.realAi && input.provider && input.model && input.apiKey && supportsNativeWebSearch(input.provider)
    ? input.provider
    : undefined;
  const cacheKey = salaryCacheKey([job.normalizedTitle, job.location, job.company, job.seniority, webProvider ?? "off", input.model]);
  const cached = readSalaryCache(cacheKey);
  if (cached) {
    try {
      const parsed = SalarySchema.safeParse(JSON.parse(cached));
      if (parsed.success && !parsed.data.isMock) return parsed.data;
    } catch {
      // entrada corrompida: segue a consulta
    }
  }

  const adzuna = await searchAdzuna(job);
  const tried = [...adzuna.tried];
  const observations: SalaryObservation[] = [];
  if (adzuna.match) observations.push(adzunaObservation(job, adzuna.match));

  let webSources: Salary["sources"] = [];
  if (!input.realAi) {
    tried.push("Busca na web desligada neste servidor.");
  } else if (!input.provider || !input.model || !input.apiKey) {
    tried.push("Busca na web sem chave do usuário.");
  } else if (!supportsNativeWebSearch(input.provider)) {
    tried.push("Busca na web ignorada: este provedor não tem ferramenta de busca.");
  } else {
    try {
      const web = await searchWebSalary({
        job,
        jobDescription: input.jobDescription,
        provider: input.provider,
        model: input.model,
        apiKey: input.apiKey,
        signal: input.signal,
      });
      if (!web) tried.push("Busca na web sem resposta utilizável.");
      else {
        webSources = web.observation ? [] : web.sources;
        if (web.observation) {
          observations.push(web.observation);
          tried.push("Busca na web com fontes citadas.");
        } else tried.push("Busca na web sem faixa numérica.");
      }
    } catch (error) {
      if (error instanceof WebSearchRateLimitError && !adzuna.match) throw new SalaryRateLimitError(error.retryAfterSec);
      if (error instanceof WebSearchRateLimitError) {
        tried.push("Busca na web atingiu o limite do plano grátis. A faixa usa as outras fontes.");
      } else {
        tried.push("Busca na web indisponível.");
      }
    }
  }

  if (!adzuna.configured && !webProvider) {
    const example = mockSalary(job.normalizedTitle, job.location);
    return { ...example, query: { ...example.query, company: job.company } };
  }

  const salary = combineSalary(job, observations, tried, webSources);
  if (!salary.isMock) writeSalaryCache(cacheKey, JSON.stringify(salary));
  return salary;
}
