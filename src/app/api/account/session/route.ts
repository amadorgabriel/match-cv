import { isAuthConfigured } from "@/lib/auth/env";
import { localAccountId, localSessionClearCookie, localSessionSetCookie, normalizeLocalAccount, readLocalSession, revokeLocalSessionId, sealLocalSession } from "@/lib/auth/local-session";
import { requestIsSecure, withSetCookies } from "@/lib/security/cookies";
import { checkRateLimit, jsonError, jsonOk } from "@/lib/security/http";

export async function POST(req: Request) {
  const limited = await checkRateLimit(req, "account-session", 10);
  if (limited) return limited;
  if (isAuthConfigured()) {
    return jsonError(409, "use_better_auth", "Neste ambiente o acesso usa o login com banco. Use o link mágico ou o provedor configurado.");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "invalid_json", "JSON inválido.");
  }
  const record = body && typeof body === "object" ? (body as { email?: unknown; name?: unknown }) : {};
  const normalized = normalizeLocalAccount(typeof record.email === "string" ? record.email : "", typeof record.name === "string" ? record.name : "");
  if (!normalized.ok) return jsonError(400, "invalid_account", normalized.error);

  const user = { id: localAccountId(normalized.email), email: normalized.email, name: normalized.name };
  const sealed = sealLocalSession(user);
  const cookie = localSessionSetCookie(sealed.token, requestIsSecure(req));
  return withSetCookies(
    jsonOk({
      ok: true,
      authenticated: true,
      sessionKind: "local",
      user,
    }),
    [cookie],
  );
}

export async function DELETE(req: Request) {
  const limited = await checkRateLimit(req, "account-session", 20);
  if (limited) return limited;
  const opened = readLocalSession(req.headers.get("cookie"));
  if (opened) revokeLocalSessionId(opened.sid);
  return withSetCookies(jsonOk({ ok: true }), [localSessionClearCookie(requestIsSecure(req))]);
}
