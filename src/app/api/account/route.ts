import { authProviderFlags } from "@/lib/auth/env";
import { readAuthUser } from "@/lib/auth/server";
import { erasePostgresAccount } from "@/lib/account/postgres";
import { clearAuthCookieHeaders, clearCookieHeader, requestIsSecure, withSetCookies } from "@/lib/security/cookies";
import { checkRateLimit, jsonError, jsonOk } from "@/lib/security/http";
import { logApiError } from "@/lib/security/redact";
import { KEY_VAULT_COOKIE } from "@/lib/keys/vault";

export async function GET(req: Request) {
  const limited = await checkRateLimit(req, "account", 30);
  if (limited) return limited;
  const flags = authProviderFlags();
  const user = flags.authEnabled ? await readAuthUser(req) : null;
  return jsonOk({
    mode: user ? "authenticated" : "anonymous",
    ...flags,
    user,
  });
}

export async function DELETE(req: Request) {
  const limited = await checkRateLimit(req, "account", 10);
  if (limited) return limited;
  const secure = requestIsSecure(req);
  const cookies = [clearCookieHeader(KEY_VAULT_COOKIE, secure), ...clearAuthCookieHeaders(secure)];
  const user = await readAuthUser(req);
  if (!user) {
    return withSetCookies(jsonOk({ ok: true, scope: "local", deletedUser: false }), cookies);
  }

  try {
    const erased = await erasePostgresAccount(user.id);
    if (!erased) return withSetCookies(jsonOk({ ok: true, scope: "local", deletedUser: false }), cookies);
    return withSetCookies(jsonOk({ ok: true, scope: "account", ...erased }), cookies);
  } catch (error) {
    await logApiError({ route: "/api/account", error, statusCode: 503 });
    return jsonError(503, "delete_failed", "Não foi possível excluir a conta agora. Tente de novo.");
  }
}
