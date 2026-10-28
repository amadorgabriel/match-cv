import { erasePostgresAccount } from "@/lib/account/postgres";
import { buildAccountState } from "@/lib/auth/account-state";
import { authProviderFlags } from "@/lib/auth/env";
import { localSessionClearCookie, readLocalSession, revokeLocalSessionId } from "@/lib/auth/local-session";
import { readAuthUser } from "@/lib/auth/server";
import { clearAuthCookieHeaders, clearCookieHeader, requestIsSecure, withSetCookies } from "@/lib/security/cookies";
import { checkRateLimit, jsonError, jsonOk } from "@/lib/security/http";
import { logApiError } from "@/lib/security/redact";
import { KEY_VAULT_COOKIE } from "@/lib/keys/vault";

function clearingCookies(req: Request): string[] {
  const secure = requestIsSecure(req);
  return [clearCookieHeader(KEY_VAULT_COOKIE, secure), localSessionClearCookie(secure), ...clearAuthCookieHeaders(secure)];
}

export async function GET(req: Request) {
  const limited = await checkRateLimit(req, "account", 30);
  if (limited) return limited;
  const flags = authProviderFlags();
  const betterUser = flags.authEnabled ? await readAuthUser(req) : null;
  const localUser = betterUser ? null : readLocalSession(req.headers.get("cookie"))?.user ?? null;
  return jsonOk(buildAccountState({ flags, betterUser, localUser }));
}

export async function DELETE(req: Request) {
  const limited = await checkRateLimit(req, "account", 10);
  if (limited) return limited;
  const localSession = readLocalSession(req.headers.get("cookie"));
  if (localSession) revokeLocalSessionId(localSession.sid);
  const cookies = clearingCookies(req);
  const user = await readAuthUser(req);
  if (!user) {
    return withSetCookies(
      jsonOk({ ok: true, scope: localSession ? "local-session" : "local", deletedUser: Boolean(localSession) }),
      cookies,
    );
  }

  try {
    const erased = await erasePostgresAccount(user.id);
    if (!erased) {
      return withSetCookies(jsonOk({ ok: true, scope: "local", deletedUser: Boolean(localSession) }), cookies);
    }
    return withSetCookies(jsonOk({ ok: true, scope: "account", ...erased, deletedUser: true }), cookies);
  } catch (error) {
    await logApiError({ route: "/api/account", error, statusCode: 503 });
    return jsonError(503, "delete_failed", "Não foi possível excluir a conta agora. Tente de novo.");
  }
}
