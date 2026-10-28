import { readTypesafeKey, verifyCandidate } from "@/lib/verification/jev";
import { VerifyRequestSchema } from "@/lib/verification/types";
import { checkRateLimit, jsonError, jsonOk, readJson } from "@/lib/security/http";
import { logApiError } from "@/lib/security/redact";

export const maxDuration = 30;

/**
 * POST /api/verify
 * Nota de compatibilidade e checagem de fidelidade.
 * Usa o Jev quando TYPESAFE_API_KEY existe; senão, o verificador local.
 * A chave não vai para o cliente.
 */
export async function POST(req: Request) {
  const limited = await checkRateLimit(req, "verify", 20);
  if (limited) return limited;

  const parsed = await readJson(req, VerifyRequestSchema, 250_000);
  if (!parsed.ok) return parsed.response;

  const started = Date.now();
  try {
    const report = await verifyCandidate(parsed.data, { signal: req.signal });
    return jsonOk(report);
  } catch (err) {
    await logApiError({
      route: "/api/verify",
      error: err,
      statusCode: 502,
      artifact: "verify",
      durationMs: Date.now() - started,
      secrets: [readTypesafeKey()],
    });
    return jsonError(502, "verification_failed", "A checagem de fidelidade falhou. Tente de novo.");
  }
}
