import { isRealAiEnabled } from "@/lib/ai/flags";
import { readModelCallContext } from "@/lib/ai/telemetry-context";
import { providerRateLimitMessage } from "@/lib/ai/provider-error";
import { lookupSalary, SalaryRateLimitError } from "@/lib/salary/search";
import type { Salary } from "@/lib/schemas/outputs";
import { resolveRequestApiKey } from "@/lib/keys/resolve-saved-key";
import { SalaryRequestSchema } from "@/lib/schemas/requests";
import { withSetCookies } from "@/lib/security/cookies";
import { checkRateLimit, jsonError, jsonOk, readJson } from "@/lib/security/http";
import { logApiError } from "@/lib/security/redact";

// Runtime Node.js (padrão do Next 16; o export `runtime` não é compatível com cacheComponents).
export const maxDuration = 60;

function unavailable(jobTitle: string): Salary {
  return {
    currency: "BRL",
    period: "month",
    available: false,
    query: { jobTitle },
    tried: ["A consulta falhou antes de devolver números."],
    isEstimate: true,
    isMock: false,
    sources: [],
    disclaimer: "Faixa não disponível para este cargo com as fontes consultadas.",
  };
}

/**
 * POST /api/salary
 * Estima a faixa com a busca pública na web do provedor do usuário.
 * O Glassdoor entra só como link de referência. Sem número, responde 200
 * com "faixa não disponível". 429 do provedor sobe como 429.
 * Com a IA desligada, devolve um exemplo.
 */
export async function POST(req: Request) {
  const limited = await checkRateLimit(req, "salary", 5);
  if (limited) return limited;

  const parsed = await readJson(req, SalaryRequestSchema, 40_000);
  if (!parsed.ok) return parsed.response;
  const resolved = await resolveRequestApiKey(req, { ...parsed.data, allowMissing: !parsed.data.useSavedKey });
  if (!resolved.ok) return resolved.response;
  const input = { ...parsed.data, apiKey: resolved.apiKey };

  const started = Date.now();
  try {
    const salary = await lookupSalary({
      ...input,
      realAi: isRealAiEnabled(),
      signal: req.signal,
      telemetry: readModelCallContext(req, {
        provider: input.provider ?? "none",
        model: input.model ?? "none",
        artifact: "salary-web",
      }),
    });
    return withSetCookies(jsonOk(salary), resolved.cookies);
  } catch (err) {
    const statusCode = err instanceof SalaryRateLimitError ? 429 : 200;
    await logApiError({
      route: "/api/salary",
      error: err,
      statusCode,
      provider: input.provider,
      model: input.model,
      durationMs: Date.now() - started,
      secrets: [input.apiKey],
    });
    if (err instanceof SalaryRateLimitError) {
      return jsonError(429, "provider_rate_limited", providerRateLimitMessage(err.retryAfterSec), {
        "Retry-After": String(err.retryAfterSec),
      });
    }
    return jsonOk(unavailable(parsed.data.jobTitle ?? "cargo da vaga"));
  }
}
