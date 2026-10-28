import {
  ApplicationRequestError,
  applicationStorageKey,
  createHttpApplicationRepository,
  createLocalApplicationRepository,
  isApplicationStorageKey,
  isLocalFallbackStatus,
  persistenceTarget,
  syncLocalApplications,
  type ApplicationRepository,
} from "@/lib/applications/store";
import type { ApplicationPatch, JobApplication, NewApplication } from "@/lib/applications/types";

export const DATA_CLEARED_EVENT = "matchcv-data-cleared";
const LOCAL_USER = null;

let modeCache: { at: number; mode: "local" | "remote" | "account"; userId: string | null } | null = null;

export function resetPersistenceMode(): void {
  modeCache = null;
}

async function resolveTarget(): Promise<{ mode: "local" | "remote" | "account"; userId: string | null }> {
  if (typeof window === "undefined") return { mode: "local", userId: null };
  if (modeCache && Date.now() - modeCache.at < 5_000) return modeCache;
  try {
    const response = await fetch("/api/account", { cache: "no-store" });
    if (!response.ok) return { mode: "local", userId: null };
    const target = persistenceTarget((await response.json()) as Parameters<typeof persistenceTarget>[0]);
    modeCache = { at: Date.now(), ...target };
    return target;
  } catch {
    return { mode: "local", userId: null };
  }
}

function scopedRepo(userId: string | null): ApplicationRepository {
  return createLocalApplicationRepository(window.localStorage, applicationStorageKey(userId), userId);
}

function remoteRepo(): ApplicationRepository {
  return createHttpApplicationRepository();
}

async function withFallback<T>(run: (repo: ApplicationRepository, userId: string | null) => Promise<T>): Promise<T> {
  const target = await resolveTarget();
  const anonymous = scopedRepo(null);
  if (target.mode === "remote") {
    const remote = remoteRepo();
    try {
      await syncLocalApplications(anonymous, remote, target.userId ?? "session");
      return await run(remote, target.userId);
    } catch (error) {
      if (error instanceof ApplicationRequestError && isLocalFallbackStatus(error.status)) return run(anonymous, LOCAL_USER);
      throw error;
    }
  }
  if (target.mode === "account" && target.userId) {
    const account = scopedRepo(target.userId);
    await syncLocalApplications(anonymous, account, target.userId);
    return run(account, target.userId);
  }
  return run(anonymous, LOCAL_USER);
}

export async function listApplications(): Promise<JobApplication[]> {
  return withFallback((repo, userId) => repo.list(userId));
}

export async function saveApplication(input: NewApplication): Promise<JobApplication> {
  return withFallback((repo, userId) => repo.create(userId, input));
}

export async function updateApplication(id: string, patch: ApplicationPatch): Promise<JobApplication> {
  return withFallback((repo, userId) => repo.update(userId, id, patch));
}

export async function removeApplication(id: string): Promise<void> {
  await withFallback((repo, userId) => repo.delete(userId, id));
}

export function clearLocalApplications(): Promise<number> {
  resetPersistenceMode();
  if (typeof window === "undefined") return Promise.resolve(0);
  const storage = window.localStorage;
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && isApplicationStorageKey(key)) keys.push(key);
  }
  let count = 0;
  for (const key of keys) {
    try {
      const parsed = JSON.parse(storage.getItem(key) ?? "[]") as unknown;
      if (Array.isArray(parsed)) count += parsed.length;
    } catch {
      // Conteúdo inválido ainda sai do navegador.
    }
    storage.removeItem(key);
  }
  return Promise.resolve(count);
}
