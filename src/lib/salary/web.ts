import "server-only";

import { generateText, isStepCount } from "ai";

import type { ProviderId } from "@/lib/ai/catalog";
import { withModelSpan } from "@/lib/ai/model-span";
import { readProviderHttpFailure } from "@/lib/ai/provider-error";
import { buildWebSearchRequest, supportsSalaryWebSearch } from "@/lib/ai/providers";
import { modelTelemetry, type ModelCallContext } from "@/lib/ai/telemetry-context";
import { logApiError, logModelUsage } from "@/lib/security/redact";
import { buildWebSalaryPrompt, WEB_SALARY_MAX_OUTPUT_TOKENS, WEB_SALARY_SYSTEM } from "@/prompts/salary";

import type { JobAnalysis } from "./job";
import { parseWebSalaryText, readLooseCitations, type CitedUrl, type WebSalaryHit } from "./web-parse";

/** Citações estruturadas do SDK, ou anotações soltas quando o modelo não as devolve. */
export function citationsFromWebResult(result: {
  sources?: Array<{ sourceType?: string; url?: string; title?: string }>;
  providerMetadata?: unknown;
  response?: { body?: unknown };
}): CitedUrl[] {
  const structured = (result.sources ?? []).flatMap((source) =>
    source.sourceType === "url" && source.url ? [{ url: source.url, title: source.title }] : [],
  );
  if (structured.length > 0) return structured;
  return dedupeCitations([...readLooseCitations(result.providerMetadata), ...readLooseCitations(result.response?.body)]);
}

function dedupeCitations(items: CitedUrl[]): CitedUrl[] {
  const seen = new Set<string>();
  const out: CitedUrl[] = [];
  for (const item of items) {
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    out.push(item);
  }
  return out;
}

export class WebSearchRateLimitError extends Error {
  readonly retryAfterSec: number;

  constructor(retryAfterSec: number) {
    super("web_search_rate_limited");
    this.name = "WebSearchRateLimitError";
    this.retryAfterSec = retryAfterSec;
  }
}

/**
 * Uma chamada com a ferramenta de busca do provedor. Sem a ferramenta,
 * devolve null. 429 sobe para o orquestrador; o resto é ignorado.
 */
export async function searchWebSalary(input: {
  job: JobAnalysis;
  jobDescription?: string;
  provider: ProviderId;
  model: string;
  apiKey: string;
  signal?: AbortSignal;
  telemetry?: ModelCallContext;
}): Promise<WebSalaryHit | null> {
  if (!supportsSalaryWebSearch(input.provider)) return null;
  const request = buildWebSearchRequest(input.provider, input.model, input.apiKey);
  if (!request) return null;

  const call = {
    sessionId: input.telemetry?.sessionId ?? "none",
    provider: input.provider,
    model: input.model,
    artifact: "salary-web",
    attempt: input.telemetry?.attempt ?? "1",
  };
  const telemetry = modelTelemetry(call);

  try {
    const result = await withModelSpan(call, () =>
      generateText({
        model: request.model,
        ...(request.tools ? { tools: request.tools, stopWhen: isStepCount(4) } : {}),
        system: WEB_SALARY_SYSTEM,
        prompt: buildWebSalaryPrompt({
          title: input.job.normalizedTitle,
          seniority: input.job.seniority,
          company: input.job.company,
          location: input.job.location,
          jobDescription: input.jobDescription || input.job.rawTitle,
        }),
        maxOutputTokens: WEB_SALARY_MAX_OUTPUT_TOKENS,
        maxRetries: 0,
        abortSignal: input.signal,
        experimental_telemetry: telemetry.experimental_telemetry,
        telemetry: telemetry.telemetry,
        runtimeContext: telemetry.runtimeContext,
      }),
    );
    logModelUsage({
      ...call,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      totalTokens: result.usage.totalTokens,
    });
    return parseWebSalaryText(result.text, citationsFromWebResult(result));
  } catch (error) {
    const failure = readProviderHttpFailure(error);
    if (failure?.statusCode === 429) throw new WebSearchRateLimitError(failure.retryAfterSec ?? 15);
    await logApiError({
      route: "/api/salary",
      error,
      statusCode: failure?.statusCode,
      provider: input.provider,
      model: input.model,
      secrets: [input.apiKey],
    });
    return null;
  }
}
