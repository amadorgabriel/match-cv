import {
  ApplicationRequestError,
  createHttpApplicationRepository,
  createLocalApplicationRepository,
  isLocalFallbackStatus,
  syncLocalApplications,
  type ApplicationRepository,
} from "@/lib/applications/store";
import type { ApplicationPatch, JobApplication, NewApplication } from "@/lib/applications/types";

export const DATA_CLEARED_EVENT = "matchcv-data-cleared";
const LOCAL_USER = null;

let modeCache: { at: number; mode: "local" | "remote" } | null = null;

export function resetPersistenceMode(): void {
  modeCache = null;
}

async function persistenceMode(): Promise<"local" | "remote"> {
  if (typeof window === "undefined") return "local";
  if (modeCache && Date.now() - modeCache.at < 5_000) return modeCache.mode;
  try {
    const response = await fetch("/api/account", { cache: "no-store" });
    if (!response.ok) return "local";
    const body = (await response.json()) as { user?: unknown; database?: boolean };
    const mode = body.user && body.database ? "remote" : "local";
    modeCache = { at: Date.now(), mode };
    return mode;
  } catch {
    return "local";
  }
}

function localRepo(): ApplicationRepository {
  return createLocalApplicationRepository(window.localStorage);
}

function remoteRepo(): ApplicationRepository {
  return createHttpApplicationRepository();
}

async function withFallback<T>(run: (repo: ApplicationRepository, userId: string | null) => Promise<T>): Promise<T> {
  const mode = await persistenceMode();
  const local = localRepo();
  if (mode === "remote") {
    const remote = remoteRepo();
    try {
      await syncLocalApplications(local, remote, "session");
      return await run(remote, "session");
    } catch (error) {
      if (error instanceof ApplicationRequestError && isLocalFallbackStatus(error.status)) return run(local, LOCAL_USER);
      throw error;
    }
  }
  return run(local, LOCAL_USER);
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
  return createLocalApplicationRepository(window.localStorage).deleteAll(LOCAL_USER);
}
