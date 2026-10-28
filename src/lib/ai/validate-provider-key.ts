import "server-only";

import type { ProviderId } from "@/lib/ai/catalog";
import { isRealAiEnabled } from "@/lib/ai/flags";
import { keyValidationRequest } from "@/lib/ai/providers";
import { logApiError } from "@/lib/security/redact";

export async function validateProviderKey(
  provider: ProviderId,
  apiKey: string,
): Promise<{ ok: true; mock: boolean; message?: string } | { ok: false; status: number; code: string; message: string }> {
  if (!isRealAiEnabled()) {
    return { ok: true, mock: true, message: "Formato aceito (validação real desligada no modo de exemplo)." };
  }

  try {
    const { url, init } = keyValidationRequest(provider, apiKey);
    const res = await fetch(url, { ...init, method: "GET", cache: "no-store", signal: AbortSignal.timeout(8_000) });
    if (res.status === 401 || res.status === 403) {
      await logApiError({ route: "/api/key/validate", error: new Error("invalid_key"), statusCode: res.status, provider, secrets: [apiKey] });
      return { ok: false, status: 401, code: "invalid_key", message: "A chave foi recusada pelo provedor." };
    }
    if (!res.ok) {
      await logApiError({ route: "/api/key/validate", error: new Error("provider_error"), statusCode: res.status, provider, secrets: [apiKey] });
      return { ok: false, status: 502, code: "provider_error", message: "Não foi possível validar a chave agora." };
    }
    return { ok: true, mock: false };
  } catch (err) {
    await logApiError({ route: "/api/key/validate", error: err, statusCode: 502, provider, secrets: [apiKey] });
    return { ok: false, status: 502, code: "provider_unreachable", message: "Não foi possível falar com o provedor." };
  }
}
