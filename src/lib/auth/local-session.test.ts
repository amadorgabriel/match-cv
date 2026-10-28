import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { DELETE as deleteAccount, GET as getAccount } from "@/app/api/account/route";
import { DELETE as signOut, POST as signIn } from "@/app/api/account/session/route";

import { localAccountId, openLocalSession, resetRevokedLocalSessions, sealLocalSession } from "./local-session";

function headers(ip: string, cookie?: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    "x-forwarded-for": ip,
    ...(cookie ? { cookie } : {}),
  };
}

function cookiePair(response: Response): string {
  const header = response.headers.get("set-cookie");
  if (!header) throw new Error("cookie ausente");
  return header.split(";")[0] ?? header;
}

describe("sessão local cifrada", () => {
  afterEach(() => {
    resetRevokedLocalSessions();
    vi.unstubAllEnvs();
  });

  it("cifra o cookie, mantém o mesmo id para o e-mail e recusa adulteração ou prazo vencido", () => {
    const user = { id: localAccountId("Ana@Example.com"), email: "ana@example.com", name: "Ana Silva" };
    expect(localAccountId("ana@example.com")).toBe(user.id);
    const sealed = sealLocalSession(user, Date.parse("2026-10-28T12:00:00.000Z"));
    expect(sealed.token).not.toContain("ana@example.com");
    expect(sealed.token).not.toContain("Ana Silva");
    const opened = openLocalSession(sealed.token, Date.parse("2026-10-28T12:00:00.000Z"));
    expect(opened?.user).toEqual(user);
    expect(openLocalSession(sealed.token, Date.parse("2026-12-28T12:00:00.000Z"))).toBeNull();
    const flipped = `${sealed.token.slice(0, -4)}aaaa`;
    expect(openLocalSession(flipped, Date.parse("2026-10-28T12:00:00.000Z"))).toBeNull();
  });

  it("entra sem banco, marca a conta como autenticada e invalida a sessão ao excluir", async () => {
    const anon = await getAccount(new Request("http://localhost/api/account", { headers: headers("198.51.100.40") }));
    await expect(anon.json()).resolves.toMatchObject({
      mode: "anonymous",
      authenticated: false,
      sessionKind: "none",
      localAuth: true,
      user: null,
    });

    const created = await signIn(
      new Request("http://localhost/api/account/session", {
        method: "POST",
        headers: headers("198.51.100.41"),
        body: JSON.stringify({ email: "Ana@Example.com", name: "Ana Silva" }),
      }),
    );
    expect(created.status).toBe(200);
    const createdBody = await created.json();
    expect(createdBody).toMatchObject({
      authenticated: true,
      sessionKind: "local",
      user: { email: "ana@example.com", name: "Ana Silva" },
    });
    const setCookie = created.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("matchcv_local_session=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).not.toContain("ana@example.com");
    const cookie = cookiePair(created);

    const authed = await getAccount(new Request("http://localhost/api/account", { headers: headers("198.51.100.42", cookie) }));
    await expect(authed.json()).resolves.toMatchObject({
      mode: "authenticated",
      authenticated: true,
      sessionKind: "local",
      user: { email: "ana@example.com", name: "Ana Silva" },
    });

    const invalid = await signIn(
      new Request("http://localhost/api/account/session", {
        method: "POST",
        headers: headers("198.51.100.43"),
        body: JSON.stringify({ email: "invalido", name: "A" }),
      }),
    );
    expect(invalid.status).toBe(400);

    const erased = await deleteAccount(
      new Request("http://localhost/api/account", { method: "DELETE", headers: headers("198.51.100.44", cookie) }),
    );
    expect(erased.status).toBe(200);
    await expect(erased.json()).resolves.toMatchObject({ ok: true, deletedUser: true });
    const clearing = erased.headers.getSetCookie?.().join("\n") ?? erased.headers.get("set-cookie") ?? "";
    expect(clearing).toContain("matchcv_local_session=");
    expect(clearing).toContain("Max-Age=0");
    expect(clearing).toContain("matchcv_key_vault=");

    const replay = await getAccount(new Request("http://localhost/api/account", { headers: headers("198.51.100.45", cookie) }));
    await expect(replay.json()).resolves.toMatchObject({ authenticated: false, user: null, mode: "anonymous" });
  });

  it("encerra a sessão local sem apagar a identidade no retorno anônimo", async () => {
    const created = await signIn(
      new Request("http://localhost/api/account/session", {
        method: "POST",
        headers: headers("198.51.100.46"),
        body: JSON.stringify({ email: "bia@example.com", name: "Bia Costa" }),
      }),
    );
    const cookie = cookiePair(created);
    const signedOut = await signOut(
      new Request("http://localhost/api/account/session", { method: "DELETE", headers: headers("198.51.100.47", cookie) }),
    );
    expect(signedOut.status).toBe(200);
    expect(signedOut.headers.get("set-cookie")).toContain("Max-Age=0");
    const replay = await getAccount(new Request("http://localhost/api/account", { headers: headers("198.51.100.48", cookie) }));
    await expect(replay.json()).resolves.toMatchObject({ authenticated: false, user: null });
  });

  it("não abre sessão local quando o Better Auth está configurado", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://local/matchcv");
    vi.stubEnv("BETTER_AUTH_SECRET", "12345678901234567890123456789012");
    const response = await signIn(
      new Request("http://localhost/api/account/session", {
        method: "POST",
        headers: headers("198.51.100.49"),
        body: JSON.stringify({ email: "ana@example.com", name: "Ana Silva" }),
      }),
    );
    expect(response.status).toBe(409);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
