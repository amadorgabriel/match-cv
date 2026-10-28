import "server-only";

import { isProviderId } from "@/lib/ai/catalog";
import { openKeyAccess } from "@/lib/keys/access";
import { SavedKeyError } from "@/lib/keys/service";
import { jsonError } from "@/lib/security/http";
import { withSetCookies } from "@/lib/security/cookies";

export async function resolveRequestApiKey(
  req: Request,
  input: { provider?: string; apiKey?: string; useSavedKey?: boolean; allowMissing?: boolean },
): Promise<{ ok: true; apiKey?: string; cookies: string[] } | { ok: false; response: Response }> {
  const typed = input.apiKey?.trim();
  if (!input.useSavedKey) {
    if (typed && typed.length >= 10) return { ok: true, apiKey: typed, cookies: [] };
    if (input.allowMissing) return { ok: true, apiKey: undefined, cookies: [] };
    return { ok: false, response: jsonError(400, "invalid_request", "Informe a API key ou use a chave salva.") };
  }
  if (!input.provider || !isProviderId(input.provider)) {
    return { ok: false, response: jsonError(400, "invalid_provider", "Provedor inválido.") };
  }

  const access = await openKeyAccess(req);
  try {
    const apiKey = await access.decrypt(input.provider);
    return { ok: true, apiKey, cookies: access.cookies(req) };
  } catch (error) {
    const cookies = access.cookies(req);
    if (error instanceof SavedKeyError) {
      return { ok: false, response: withSetCookies(jsonError(error.status, error.code, error.message), cookies) };
    }
    return {
      ok: false,
      response: withSetCookies(jsonError(500, "saved_key_error", "Não foi possível usar a chave salva."), cookies),
    };
  }
}
