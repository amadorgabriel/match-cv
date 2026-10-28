export interface AccountUser {
  id: string;
  email: string;
  name: string;
}

export type SessionKind = "better-auth" | "local" | "none";

export interface AccountFlags {
  authEnabled: boolean;
  database: boolean;
  magicLink: boolean;
  github: boolean;
  google: boolean;
  emailDelivery: boolean;
}

export interface AccountState extends AccountFlags {
  mode: "anonymous" | "authenticated";
  authenticated: boolean;
  sessionKind: SessionKind;
  /** Login com cookie cifrado, usado quando o Better Auth não está ligado. */
  localAuth: boolean;
  user: AccountUser | null;
}

export const ANONYMOUS_ACCOUNT: AccountState = {
  mode: "anonymous",
  authenticated: false,
  sessionKind: "none",
  authEnabled: false,
  localAuth: true,
  database: false,
  magicLink: false,
  github: false,
  google: false,
  emailDelivery: false,
  user: null,
};

export const ACCOUNT_CHANGED_EVENT = "matchcv-account-changed";

export function canDeleteAccount(account: Pick<AccountState, "authenticated" | "user">): boolean {
  return account.authenticated === true && Boolean(account.user?.id && account.user.email);
}

function asUser(value: unknown): AccountUser | null {
  if (!value || typeof value !== "object") return null;
  const user = value as Partial<AccountUser>;
  if (!user.id || !user.email) return null;
  return { id: user.id, email: user.email, name: user.name ?? "" };
}

export function buildAccountState(input: {
  flags: AccountFlags;
  betterUser: AccountUser | null;
  localUser: AccountUser | null;
}): AccountState {
  const betterUser = asUser(input.betterUser);
  const localUser = betterUser ? null : asUser(input.localUser);
  const user = betterUser ?? localUser;
  const authenticated = Boolean(user);
  return {
    ...input.flags,
    mode: authenticated ? "authenticated" : "anonymous",
    authenticated,
    sessionKind: betterUser ? "better-auth" : localUser ? "local" : "none",
    localAuth: !input.flags.authEnabled,
    user,
  };
}

/** Normaliza a resposta de /api/account. Sem usuário válido, a conta não fica autenticada. */
export function normalizeAccountState(value: unknown): AccountState {
  const record = value && typeof value === "object" ? (value as Partial<AccountState>) : {};
  const flags: AccountFlags = {
    authEnabled: record.authEnabled === true,
    database: record.database === true,
    magicLink: record.magicLink === true,
    github: record.github === true,
    google: record.google === true,
    emailDelivery: record.emailDelivery === true,
  };
  const sessionKind = record.sessionKind;
  const betterUser = sessionKind === "better-auth" ? asUser(record.user) : null;
  const localUser = sessionKind === "local" ? asUser(record.user) : sessionKind === "better-auth" ? null : asUser(record.user);
  if (record.authenticated !== true) {
    return buildAccountState({ flags, betterUser: null, localUser: null });
  }
  if (sessionKind === "better-auth") return buildAccountState({ flags, betterUser, localUser: null });
  if (sessionKind === "local") return buildAccountState({ flags, betterUser: null, localUser });
  return buildAccountState({ flags, betterUser: null, localUser: asUser(record.user) });
}
