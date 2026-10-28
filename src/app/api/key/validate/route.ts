import { validateProviderKey } from "@/lib/ai/validate-provider-key";
import { ValidateKeyRequestSchema } from "@/lib/schemas/requests";
import { checkRateLimit, jsonError, jsonOk, readJson } from "@/lib/security/http";

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
  const result = await validateProviderKey(provider, apiKey);
  if (!result.ok) return jsonError(result.status, result.code, result.message);
  return jsonOk({ ok: true, provider, mock: result.mock, message: result.message });
}
