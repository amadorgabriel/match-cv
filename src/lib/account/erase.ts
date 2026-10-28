export interface EraseResult {
  deletedUser: boolean;
  sessions: number;
  accounts: number;
  verifications: number;
  keys: number;
  applications: number;
}

export interface ErasableAccount {
  findUser(userId: string): Promise<{ id: string; email: string } | null>;
  deleteVerifications(email: string): Promise<number>;
  deleteKeys(userId: string): Promise<number>;
  deleteApplications(userId: string): Promise<number>;
  deleteSessions(userId: string): Promise<number>;
  deleteAccounts(userId: string): Promise<number>;
  deleteUser(userId: string): Promise<number>;
}

const EMPTY: EraseResult = {
  deletedUser: false,
  sessions: 0,
  accounts: 0,
  verifications: 0,
  keys: 0,
  applications: 0,
};

/** Hard delete do usuário e de tudo o que a conta guarda. Verificações saem pelo e-mail. */
export async function eraseAccountData(store: ErasableAccount, userId: string): Promise<EraseResult> {
  const user = await store.findUser(userId);
  if (!user) return { ...EMPTY };
  const [verifications, keys, applications, sessions, accounts] = await Promise.all([
    store.deleteVerifications(user.email),
    store.deleteKeys(userId),
    store.deleteApplications(userId),
    store.deleteSessions(userId),
    store.deleteAccounts(userId),
  ]);
  const deleted = await store.deleteUser(userId);
  return {
    deletedUser: deleted > 0,
    sessions,
    accounts,
    verifications,
    keys,
    applications,
  };
}
