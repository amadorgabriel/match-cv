export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    if (trimmed.slice(0, eq) !== name) continue;
    try {
      return decodeURIComponent(trimmed.slice(eq + 1));
    } catch {
      return trimmed.slice(eq + 1);
    }
  }
  return null;
}

export function requestIsSecure(req: Request): boolean {
  if (process.env.NODE_ENV === "production") return true;
  return req.headers.get("x-forwarded-proto") === "https";
}

export function setCookieHeader(name: string, value: string, options: { maxAge: number; secure: boolean }): string {
  const secure = options.secure ? "; Secure" : "";
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${options.maxAge}${secure}`;
}

export function clearCookieHeader(name: string, secure: boolean): string {
  return setCookieHeader(name, "", { maxAge: 0, secure });
}

/** Cookies de sessão do Better Auth, com e sem o prefixo __Secure-. */
export const AUTH_COOKIE_NAMES = [
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
  "better-auth.session_data",
  "__Secure-better-auth.session_data",
] as const;

export function clearAuthCookieHeaders(secure: boolean): string[] {
  return AUTH_COOKIE_NAMES.map((name) => clearCookieHeader(name, secure));
}

export function withSetCookies(response: Response, cookies: string[]): Response {
  for (const cookie of cookies) response.headers.append("Set-Cookie", cookie);
  return response;
}
