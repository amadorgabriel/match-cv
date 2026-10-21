import { isRealAiEnabled } from "@/lib/ai/flags";
import { keyValidationRequest } from "@/lib/ai/providers";
import { ValidateKeyRequestSchema } from "@/lib/schemas/requests";
import { checkRateLimit, jsonError, jsonOk, readJson } from "@/lib/security/http";
import { logApiError } from "@/lib/security/redact";

// Runtime Node.js (padrão do Next 16; o export `runtime` não é compatível com cacheComponents).

/**
 * POST /api/key/validate  { provider, apiKey }
 * Faz uma chamada barata de listagem de modelos. Nunca devolve nem loga a chave.
 * Com a IA desligada (mock), só checa o formato.
 */
export async function POST(req: Request) {
  const limited = await checkRateLimit(req, "key-validate", 10);
  if (limited) return limited;

  const parsed = await readJson(req, ValidateKeyRequestSchema, 5_000);
  if (!parsed.ok) return parsed.response;
  const { provider, apiKey } = parsed.data;

  if (!isRealAiEnabled()) {
    return jsonOk({ ok: true, provider, mock: true, message: "Formato aceito (validação real desligada no modo de exemplo)." });
  }

  try {
    const { url, init } = keyValidationRequest(provider, apiKey);
    const res = await fetch(url, { ...init, method: "GET", cache: "no-store", signal: AbortSignal.timeout(8_000) });
    if (res.status === 401 || res.status === 403) {
      logApiError({ route: "/api/key/validate", error: new Error("invalid_key"), statusCode: res.status, provider, secrets: [apiKey] });
      return jsonError(401, "invalid_key", "A chave foi recusada pelo provedor.");
    }
    if (!res.ok) {
      logApiError({ route: "/api/key/validate", error: new Error("provider_error"), statusCode: res.status, provider, secrets: [apiKey] });
      return jsonError(502, "provider_error", "Não foi possível validar a chave agora.");
    }
    return jsonOk({ ok: true, provider, mock: false });
  } catch (err) {
    logApiError({ route: "/api/key/validate", error: err, statusCode: 502, provider, secrets: [apiKey] });
    return jsonError(502, "provider_unreachable", "Não foi possível falar com o provedor.");
  }
}
