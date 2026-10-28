import { generateBrief } from "@/lib/ai/brief";
import { isRealAiEnabled } from "@/lib/ai/flags";
import { readModelCallContext } from "@/lib/ai/telemetry-context";
import { isProviderTimeout, PROVIDER_SLOW_MESSAGE, withGenerationDeadline } from "@/lib/ai/generation-deadline";
import { providerRateLimitMessage, readProviderHttpFailure } from "@/lib/ai/provider-error";
import { ProviderConfigError } from "@/lib/ai/providers";
import { resolveRequestApiKey } from "@/lib/keys/resolve-saved-key";
import { GENERATE_REQUEST_MAX_BYTES, GenerateRequestSchema, type GenerateRequest } from "@/lib/schemas/requests";
import { withSetCookies } from "@/lib/security/cookies";
import { checkRateLimit, jsonError, jsonOk, readJson } from "@/lib/security/http";
import { logApiError } from "@/lib/security/redact";

export const maxDuration = 120;

/**
 * POST /api/brief
 * Extrai perfil e vaga uma vez. A resposta não é persistida no servidor.
 */
export async function POST(req: Request) {
  const limited = await checkRateLimit(req, "brief", 20);
  if (limited) return limited;

  const parsed = await readJson(req, GenerateRequestSchema, GENERATE_REQUEST_MAX_BYTES);
  if (!parsed.ok) return parsed.response;
  const resolved = await resolveRequestApiKey(req, parsed.data);
  if (!resolved.ok) return resolved.response;
  if (!resolved.apiKey) return jsonError(400, "invalid_request", "Informe a API key ou use a chave salva.");
  const data: GenerateRequest = { ...parsed.data, apiKey: resolved.apiKey };

  const started = Date.now();
  const deadline = withGenerationDeadline(req.signal);
  try {
    const result = await generateBrief(data, {
      realAi: isRealAiEnabled(),
      abortSignal: deadline.signal,
      telemetry: readModelCallContext(req, {
        provider: data.provider,
        model: data.model,
        artifact: "brief",
      }),
    });
    return withSetCookies(jsonOk(result), resolved.cookies);
  } catch (err) {
    if (req.signal.aborted && !deadline.timedOut()) return new Response(null, { status: 499 });
    const providerFailure = readProviderHttpFailure(err);
    const timedOut = deadline.timedOut() || isProviderTimeout(err);
    const statusCode = err instanceof ProviderConfigError ? 400 : providerFailure?.statusCode === 429 ? 429 : timedOut ? 504 : 502;
    await logApiError({
      route: "/api/brief",
      error: err,
      statusCode,
      provider: data.provider,
      model: data.model,
      artifact: "brief",
      durationMs: Date.now() - started,
      secrets: [data.apiKey],
    });
    if (err instanceof ProviderConfigError) return jsonError(400, "invalid_provider", "Provedor ou modelo inválido.");
    if (providerFailure?.statusCode === 429) {
      const seconds = providerFailure.retryAfterSec ?? 15;
      return jsonError(429, "provider_rate_limited", providerRateLimitMessage(seconds), {
        "Retry-After": String(seconds),
      });
    }
    if (timedOut) return jsonError(504, "provider_timeout", PROVIDER_SLOW_MESSAGE);
    return jsonError(502, "generation_failed", "A geração falhou. Confira a chave e o modelo e tente de novo.");
  }
}
