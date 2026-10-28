import { createHash, randomUUID } from "node:crypto";

import { clearCookieHeader, readCookie, setCookieHeader } from "@/lib/security/cookies";
import { currentKekVersion, decryptSecret, encryptSecret, type Envelope } from "@/lib/security/envelope-encryption";

import type { AccountUser } from "./account-state";

export const LOCAL_SESSION_COOKIE = "matchcv_local_session";
export const LOCAL_SESSION_MAX_AGE = 60 * 60 * 24 * 30;

const FALLBACK_SESSION_KEK = "matchcv-local-session-fallback-v1";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const revokedSessionIds = new Set<string>();
const revokedOrder: string[] = [];

interface SessionPayload {
  v: 1;
  sid: string;
  id: string;
  email: string;
  name: string;
  exp: number;
}

export interface OpenedLocalSession {
  sid: string;
  user: AccountUser;
}

/** KEK da sessão. Sem segredo configurado, ainda cifra o cookie para o modo local funcionar. */
export function resolveSessionKek(version: number, env: NodeJS.ProcessEnv = process.env): string | undefined {
  const named = env[`KEY_ENCRYPTION_SECRET_V${version}`]?.trim();
  if (named && named.length >= 16) return named;
  const current = currentKekVersion(env);
  if (version === current - 1) {
    const previous = env.KEY_ENCRYPTION_SECRET_PREVIOUS?.trim();
    return previous && previous.length >= 16 ? previous : undefined;
  }
  if (version !== current) return undefined;
  const secret = env.KEY_ENCRYPTION_SECRET?.trim() || env.BETTER_AUTH_SECRET?.trim() || env.LOCAL_SESSION_SECRET?.trim();
  if (secret && secret.length >= 16) return secret;
  return FALLBACK_SESSION_KEK;
}

export function localAccountId(email: string): string {
  const digest = createHash("sha256").update(`matchcv-local-user:${email.trim().toLowerCase()}`).digest("hex");
  return `local_${digest.slice(0, 32)}`;
}

export function normalizeLocalAccount(email: string, name: string): { ok: true; email: string; name: string } | { ok: false; error: string } {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name.trim().replace(/\s+/g, " ");
  if (!EMAIL_RE.test(cleanEmail) || cleanEmail.length > 254) return { ok: false, error: "Informe um e-mail válido." };
  if (cleanName.length < 2 || cleanName.length > 80) return { ok: false, error: "Informe seu nome (entre 2 e 80 caracteres)." };
  return { ok: true, email: cleanEmail, name: cleanName };
}

export function sealLocalSession(user: AccountUser, now = Date.now()): { token: string; sid: string } {
  const sid = randomUUID();
  const payload: SessionPayload = {
    v: 1,
    sid,
    id: user.id,
    email: user.email,
    name: user.name,
    exp: Math.floor(now / 1000) + LOCAL_SESSION_MAX_AGE,
  };
  const { envelope } = encryptSecret(JSON.stringify(payload), {
    purpose: "session",
    resolveSecret: resolveSessionKek,
  });
  return { token: Buffer.from(JSON.stringify(envelope), "utf8").toString("base64url"), sid };
}

export function openLocalSession(token: string, now = Date.now()): OpenedLocalSession | null {
  try {
    const envelope = JSON.parse(Buffer.from(token, "base64url").toString("utf8")) as Envelope;
    if (envelope.purpose !== "session") return null;
    const payload = JSON.parse(decryptSecret(envelope, { resolveSecret: resolveSessionKek })) as Partial<SessionPayload>;
    if (payload.v !== 1 || !payload.sid || !payload.id || !payload.email || !payload.name || !payload.exp) return null;
    if (payload.exp * 1000 <= now) return null;
    if (revokedSessionIds.has(payload.sid)) return null;
    const normalized = normalizeLocalAccount(payload.email, payload.name);
    if (!normalized.ok) return null;
    if (payload.id !== localAccountId(normalized.email)) return null;
    return { sid: payload.sid, user: { id: payload.id, email: normalized.email, name: normalized.name } };
  } catch {
    return null;
  }
}

export function readLocalSession(cookieHeader: string | null, now = Date.now()): OpenedLocalSession | null {
  const token = readCookie(cookieHeader, LOCAL_SESSION_COOKIE);
  if (!token) return null;
  return openLocalSession(token, now);
}

export function revokeLocalSessionId(sid: string): void {
  if (!sid || revokedSessionIds.has(sid)) return;
  revokedSessionIds.add(sid);
  revokedOrder.push(sid);
  if (revokedOrder.length > 2000) {
    const oldest = revokedOrder.shift();
    if (oldest) revokedSessionIds.delete(oldest);
  }
}

export function resetRevokedLocalSessions(): void {
  revokedSessionIds.clear();
  revokedOrder.length = 0;
}

export function localSessionSetCookie(token: string, secure: boolean): string {
  return setCookieHeader(LOCAL_SESSION_COOKIE, token, { maxAge: LOCAL_SESSION_MAX_AGE, secure });
}

export function localSessionClearCookie(secure: boolean): string {
  return clearCookieHeader(LOCAL_SESSION_COOKIE, secure);
}
