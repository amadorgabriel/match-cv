import { describe, expect, it } from "vitest";

import { buildAccountState, canDeleteAccount, normalizeAccountState, type AccountFlags } from "./account-state";

const flags: AccountFlags = {
  authEnabled: false,
  database: false,
  magicLink: false,
  github: false,
  google: false,
  emailDelivery: false,
};

describe("estado da conta", () => {
  it("não trata anônimo como autenticado e esconde a exclusão", () => {
    const account = buildAccountState({ flags, betterUser: null, localUser: null });
    expect(account).toMatchObject({ mode: "anonymous", authenticated: false, sessionKind: "none", localAuth: true, user: null });
    expect(canDeleteAccount(account)).toBe(false);
    expect(canDeleteAccount({ authenticated: false, user: { id: "x", email: "a@b.co", name: "A" } })).toBe(false);
    expect(canDeleteAccount({ authenticated: true, user: null })).toBe(false);
  });

  it("aceita a sessão local e a do Better Auth, com prioridade para o banco", () => {
    const local = buildAccountState({
      flags,
      betterUser: null,
      localUser: { id: "local_1", email: "ana@example.com", name: "Ana" },
    });
    expect(local.authenticated).toBe(true);
    expect(local.sessionKind).toBe("local");
    expect(canDeleteAccount(local)).toBe(true);

    const better = buildAccountState({
      flags: { ...flags, authEnabled: true, database: true, magicLink: true },
      betterUser: { id: "user-1", email: "ana@example.com", name: "Ana" },
      localUser: { id: "local_1", email: "outra@example.com", name: "Outra" },
    });
    expect(better.sessionKind).toBe("better-auth");
    expect(better.user?.id).toBe("user-1");
    expect(better.localAuth).toBe(false);
    expect(canDeleteAccount(better)).toBe(true);
  });

  it("descarta authenticated sem usuário", () => {
    const account = normalizeAccountState({ authenticated: true, sessionKind: "local", user: null, authEnabled: false });
    expect(account.authenticated).toBe(false);
    expect(canDeleteAccount(account)).toBe(false);
  });
});
