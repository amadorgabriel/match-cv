import { isRealAiEnabled } from "@/lib/ai/flags";
import { readModelCallContext } from "@/lib/ai/telemetry-context";
import { generateArtifact } from "@/lib/ai/generate";
import { isProviderTimeout, PROVIDER_SLOW_MESSAGE, withGenerationDeadline } from "@/lib/ai/generation-deadline";
import { providerRateLimitMessage, readProviderHttpFailure } from "@/lib/ai/provider-error";
import { ProviderConfigError } from "@/lib/ai/providers";
import { ARTIFACTS, type Artifact } from "@/lib/schemas/outputs";
import { resolveRequestApiKey } from "@/lib/keys/resolve-saved-key";
import { GENERATE_REQUEST_MAX_BYTES, GenerateRequestSchema, type GenerateRequest } from "@/lib/schemas/requests";
import { withSetCookies } from "@/lib/security/cookies";
import { checkRateLimit, jsonError, jsonOk, readJson } from "@/lib/security/http";
import { logApiError } from "@/lib/security/redact";

// Runtime Node.js (padrão do Next 16; o export `runtime` não é compatível com cacheComponents).
export const maxDuration = 120;

function isArtifact(value: string): value is Artifact {
  return (ARTIFACTS as readonly string[]).includes(value);
}

/**
 * POST /api/generate/{cv|email|cover-letter|interview}
 * Body: { provider, model, apiKey, resumeText, jobDescription, achievements?, achievementsDocument? }
 *
 * A chave só existe dentro deste handler: é usada para criar o provider
 * e descartada. Não é logada, persistida nem devolvida.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/generate/[artifact]">) {
  const { artifact } = await ctx.params;
  if (!isArtifact(artifact)) return jsonError(404, "unknown_artifact", "Artefato desconhecido.");

  const limited = await checkRateLimit(req, "generate", 30);
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
    const result = await generateArtifact(artifact, data, {
      realAi: isRealAiEnabled(),
      abortSignal: deadline.signal,
      telemetry: readModelCallContext(req, {
        provider: parsed.data.provider,
        model: parsed.data.model,
        artifact,
      }),
    });
    return withSetCookies(jsonOk(result), resolved.cookies);
  } catch (err) {
    if (req.signal.aborted && !deadline.timedOut()) return new Response(null, { status: 499 });
    const providerFailure = readProviderHttpFailure(err);
    const timedOut = deadline.timedOut() || isProviderTimeout(err);
    const statusCode = err instanceof ProviderConfigError ? 400 : providerFailure?.statusCode === 429 ? 429 : timedOut ? 504 : 502;
    await logApiError({
      route: "/api/generate/[artifact]",
      error: err,
      statusCode,
      provider: data.provider,
      model: data.model,
      artifact,
      durationMs: Date.now() - started,
      secrets: [data.apiKey],
    });
    const respond = (response: Response) => withSetCookies(response, resolved.cookies);
    if (err instanceof ProviderConfigError) return respond(jsonError(400, "invalid_provider", "Provedor ou modelo inválido."));
    if (providerFailure?.statusCode === 429) {
      const seconds = providerFailure.retryAfterSec ?? 15;
      return respond(
        jsonError(429, "provider_rate_limited", providerRateLimitMessage(seconds), {
          "Retry-After": String(seconds),
        }),
      );
    }
    if (timedOut) return respond(jsonError(504, "provider_timeout", PROVIDER_SLOW_MESSAGE));
    return respond(jsonError(502, "generation_failed", "A geração falhou. Confira a chave e o modelo e tente de novo."));
  }
}
