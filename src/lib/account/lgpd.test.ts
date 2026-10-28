import { describe, expect, it } from "vitest";

import { eraseAccountData, type ErasableAccount } from "@/lib/account/erase";
import { isAuthConfigured } from "@/lib/auth/env";
import {
  applicationStorageKey,
  createLocalApplicationRepository,
  createMemoryApplicationRepository,
  draftFromResults,
  filterApplications,
  persistenceTarget,
  syncLocalApplications,
} from "@/lib/applications/store";
import { ApplicationStoreError, type JobApplication } from "@/lib/applications/types";
import { GenerateRequestSchema } from "@/lib/schemas/requests";

const base = {
  provider: "openrouter" as const,
  model: "openrouter/free",
  resumeText: "Currículo com experiência em TypeScript, React e Node.js ao longo de cinco anos.",
  jobDescription: "Vaga de desenvolvedor full stack com React, Node.js e experiência em produção.",
};

describe("fluxo anônimo do MVP", () => {
  it("continua aceitando a geração só com a API key, sem login", () => {
    const parsed = GenerateRequestSchema.parse({ ...base, apiKey: "sk-test-key-1234" });
    expect(parsed.apiKey).toBe("sk-test-key-1234");
    expect(parsed.useSavedKey).toBeUndefined();
    expect(GenerateRequestSchema.safeParse({ ...base, useSavedKey: true }).success).toBe(true);
    expect(GenerateRequestSchema.safeParse(base).success).toBe(false);
  });

  it("não liga o Better Auth sem banco e segredo", () => {
    expect(isAuthConfigured({} as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(isAuthConfigured({ DATABASE_URL: "postgres://local/matchcv", BETTER_AUTH_SECRET: "curto" } as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(
      isAuthConfigured({
        DATABASE_URL: "postgres://local/matchcv",
        BETTER_AUTH_SECRET: "12345678901234567890123456789012",
      } as unknown as NodeJS.ProcessEnv),
    ).toBe(true);
  });

  it("guarda candidatura sem usuário e não apaga a de outra pessoa", async () => {
    const repo = createMemoryApplicationRepository();
    const anon = await repo.create(null, { company: "Local", role: "Dev" });
    await repo.create("conta", { company: "Remota", role: "QA" });
    expect(anon.userId).toBeNull();
    expect(await repo.deleteAll("conta")).toBe(1);
    expect(await repo.list(null)).toEqual([expect.objectContaining({ company: "Local" })]);
    expect(await repo.list("conta")).toEqual([]);
  });
});

describe("dashboard de candidaturas", () => {
  it("cria, filtra, busca, muda status e anotações e exclui", async () => {
    const repo = createMemoryApplicationRepository();
    const first = await repo.create("user", {
      company: "Ênfases",
      role: "Desenvolvedor pleno",
      notes: "esperar retorno",
      appliedAt: "2026-03-01T12:00:00.000Z",
    });
    await repo.create("user", { company: "Outra", role: "Designer", status: "recusado", appliedAt: "2026-04-01T12:00:00.000Z" });
    expect(first.status).toBe("aplicado");

    const applied = filterApplications(await repo.list("user"), { status: "aplicado" });
    expect(applied.map((item) => item.company)).toEqual(["Ênfases"]);
    expect(filterApplications(await repo.list("user"), { query: "ênfase" }).map((item) => item.role)).toEqual(["Desenvolvedor pleno"]);

    const interviewed = await repo.update("user", first.id, { status: "entrevista" });
    const offered = await repo.update("user", first.id, { status: "oferta", notes: "proposta recebida" });
    expect(interviewed.status).toBe("entrevista");
    expect(offered.status).toBe("oferta");
    expect(offered.notes).toBe("proposta recebida");
    await repo.update("user", first.id, { status: "recusado" });

    expect(await repo.delete("user", first.id)).toBe(true);
    expect(await repo.get("user", first.id)).toBeNull();
    await expect(repo.update("user", first.id, { notes: "sumiu" })).rejects.toBeInstanceOf(ApplicationStoreError);
    await expect(repo.create("user", { company: "A", role: "B", status: "contratado" as JobApplication["status"] })).rejects.toThrow(/Status/);
  });

  it("sincroniza o modo anônimo para o repositório da conta e limpa o local", async () => {
    const storage = memoryStorage();
    const local = createLocalApplicationRepository(storage);
    const remote = createMemoryApplicationRepository();
    await local.create(null, { company: "Beta", role: "Backend" });
    expect(await syncLocalApplications(local, remote, "user-1")).toBe(1);
    expect(await local.list(null)).toEqual([]);
    expect(storage.getItem("matchcv:applications")).toBe("[]");
    expect((await remote.list("user-1"))[0]?.company).toBe("Beta");
    await local.deleteAll(null);
    expect(storage.getItem("matchcv:applications")).toBeNull();
  });

  it("leva a candidatura anônima para o balde da sessão local", async () => {
    const storage = memoryStorage();
    const anon = createLocalApplicationRepository(storage, applicationStorageKey(null), null);
    const account = createLocalApplicationRepository(storage, applicationStorageKey("local_ana"), "local_ana");
    await anon.create(null, { company: "Solta", role: "Dev" });
    expect(await syncLocalApplications(anon, account, "local_ana")).toBe(1);
    expect(await anon.list(null)).toEqual([]);
    const saved = await account.list("local_ana");
    expect(saved).toEqual([expect.objectContaining({ company: "Solta", userId: "local_ana" })]);
    expect(storage.getItem(applicationStorageKey("local_ana"))).toContain("Solta");
    expect(persistenceTarget({ authenticated: true, database: false, sessionKind: "local", user: { id: "local_ana" } })).toEqual({
      mode: "account",
      userId: "local_ana",
    });
    expect(persistenceTarget({ authenticated: true, database: true, sessionKind: "better-auth", user: { id: "user-1" } })).toEqual({
      mode: "remote",
      userId: "user-1",
    });
    expect(persistenceTarget({ authenticated: false, user: null })).toEqual({ mode: "local", userId: null });
  });

  it("monta o rascunho com empresa, vaga e materiais", () => {
    const draft = draftFromResults("Empresa: Alfa\nVaga: desenvolvedor back-end pleno", {});
    expect(draft.company).toBe("Alfa");
    expect(draft.role.toLowerCase()).toContain("desenvolvedor");
    expect(draft.materials?.cv).toBeNull();
  });
});

describe("exclusão LGPD", () => {
  it("apaga usuário, sessão, conta, verificação, chave e candidatura", async () => {
    const db = seed();
    const result = await eraseAccountData(adapter(db), "user-1");
    expect(result).toEqual({ deletedUser: true, sessions: 1, accounts: 1, verifications: 1, keys: 1, applications: 1 });
    expect(db.users.map((item) => item.id)).toEqual(["user-2"]);
    expect(db.sessions).toEqual([{ userId: "user-2" }]);
    expect(db.keys).toEqual([{ userId: "user-2" }]);
    expect(db.applications).toEqual([{ userId: "user-2" }]);
    expect(await eraseAccountData(adapter(db), "ausente")).toMatchObject({ deletedUser: false, keys: 0 });
  });
});

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

function seed() {
  return {
    users: [
      { id: "user-1", email: "ana@example.com" },
      { id: "user-2", email: "bia@example.com" },
    ],
    sessions: [{ userId: "user-1" }, { userId: "user-2" }],
    accounts: [{ userId: "user-1" }],
    verifications: [{ email: "ana@example.com" }, { email: "bia@example.com" }],
    keys: [{ userId: "user-1" }, { userId: "user-2" }],
    applications: [{ userId: "user-1" }, { userId: "user-2" }],
  };
}

function adapter(db: ReturnType<typeof seed>): ErasableAccount {
  return {
    async findUser(userId) {
      return db.users.find((user) => user.id === userId) ?? null;
    },
    async deleteVerifications(email) {
      const before = db.verifications.length;
      db.verifications = db.verifications.filter((item) => item.email !== email);
      return before - db.verifications.length;
    },
    async deleteKeys(userId) {
      return drop(db.keys, userId);
    },
    async deleteApplications(userId) {
      return drop(db.applications, userId);
    },
    async deleteSessions(userId) {
      return drop(db.sessions, userId);
    },
    async deleteAccounts(userId) {
      return drop(db.accounts, userId);
    },
    async deleteUser(userId) {
      const before = db.users.length;
      db.users = db.users.filter((user) => user.id !== userId);
      return before - db.users.length;
    },
  };
}

function drop(rows: { userId: string }[], userId: string): number {
  const before = rows.length;
  const kept = rows.filter((item) => item.userId !== userId);
  rows.splice(0, rows.length, ...kept);
  return before - rows.length;
}
