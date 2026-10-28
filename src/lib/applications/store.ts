import { analyzeJob } from "@/lib/salary/job";
import type { Results } from "@/lib/client/api";

import {
  APPLICATION_STATUSES,
  ApplicationMaterialsSchema,
  ApplicationStoreError,
  type ApplicationMaterials,
  type ApplicationPatch,
  type ApplicationQuery,
  type ApplicationStatus,
  type JobApplication,
  type NewApplication,
} from "./types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NOTES_MAX = 5_000;

export interface ApplicationRepository {
  list(userId: string | null): Promise<JobApplication[]>;
  get(userId: string | null, id: string): Promise<JobApplication | null>;
  create(userId: string | null, input: NewApplication): Promise<JobApplication>;
  update(userId: string | null, id: string, patch: ApplicationPatch): Promise<JobApplication>;
  delete(userId: string | null, id: string): Promise<boolean>;
  deleteAll(userId: string | null): Promise<number>;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function fold(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function cleanText(value: string, label: string, max: number): string {
  const trimmed = value.trim();
  if (!trimmed) throw new ApplicationStoreError(`Informe ${label}.`);
  if (trimmed.length > max) throw new ApplicationStoreError(`${label} longo demais.`);
  return trimmed;
}

export function parseStatus(value: string): ApplicationStatus {
  if ((APPLICATION_STATUSES as readonly string[]).includes(value)) return value as ApplicationStatus;
  throw new ApplicationStoreError("Status inválido. Use aplicado, entrevista, oferta ou recusado.");
}

function parseMaterials(value: ApplicationMaterials | undefined): ApplicationMaterials {
  const parsed = ApplicationMaterialsSchema.safeParse(value ?? {});
  if (!parsed.success) throw new ApplicationStoreError("Os materiais da candidatura são inválidos.");
  return parsed.data;
}

function parseInstant(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new ApplicationStoreError("Data inválida.");
  return date.toISOString();
}

export function prepareCreate(userId: string | null, input: NewApplication, now = new Date()): JobApplication {
  const createdAt = now.toISOString();
  return {
    id: input.id && UUID_RE.test(input.id) ? input.id : crypto.randomUUID(),
    userId,
    company: cleanText(input.company, "a empresa", 120),
    role: cleanText(input.role, "a vaga", 160),
    appliedAt: parseInstant(input.appliedAt, createdAt),
    status: input.status ? parseStatus(input.status) : "aplicado",
    notes: input.notes === undefined ? "" : cleanNotes(input.notes),
    materials: parseMaterials(input.materials),
    createdAt,
    updatedAt: createdAt,
  };
}

function cleanNotes(value: string): string {
  if (value.length > NOTES_MAX) throw new ApplicationStoreError("Anotações longas demais.");
  return value;
}

export function prepareUpdate(current: JobApplication, patch: ApplicationPatch, now = new Date()): JobApplication {
  if (patch.company === undefined && patch.role === undefined && patch.status === undefined && patch.notes === undefined && patch.materials === undefined) {
    throw new ApplicationStoreError("Nada para atualizar.");
  }
  return {
    ...current,
    company: patch.company === undefined ? current.company : cleanText(patch.company, "a empresa", 120),
    role: patch.role === undefined ? current.role : cleanText(patch.role, "a vaga", 160),
    status: patch.status === undefined ? current.status : parseStatus(patch.status),
    notes: patch.notes === undefined ? current.notes : cleanNotes(patch.notes),
    materials: patch.materials === undefined ? current.materials : parseMaterials(patch.materials),
    updatedAt: now.toISOString(),
  };
}

export function filterApplications(items: JobApplication[], query: ApplicationQuery = {}): JobApplication[] {
  const status = query.status;
  const text = query.query?.trim() ? fold(query.query) : "";
  return items
    .filter((item) => (status ? item.status === status : true))
    .filter((item) => {
      if (!text) return true;
      return [item.company, item.role, item.notes].some((field) => fold(field).includes(text));
    })
    .sort((a, b) => b.appliedAt.localeCompare(a.appliedAt));
}

export function materialsFromResults(results: Results): ApplicationMaterials {
  return parseMaterials({
    cv: results.cv?.data ?? null,
    email: results.email?.data ?? null,
    coverLetter: results["cover-letter"]?.data ?? null,
    interview: results.interview?.data ?? null,
    salary: results.salary ?? null,
  });
}

/** Empresa e cargo saem da vaga (e da faixa salarial, quando ela já trouxe os dois). */
export function draftFromResults(jobDescription: string, results: Results): NewApplication {
  const job = analyzeJob({ jobDescription });
  return {
    company: (results.salary?.query.company || job.company || "Empresa não identificada").slice(0, 120),
    role: (results.salary?.query.jobTitle || job.rawTitle || job.normalizedTitle || "Vaga").slice(0, 160),
    materials: materialsFromResults(results),
  };
}

function sameUser(item: JobApplication, userId: string | null): boolean {
  return userId === null ? item.userId === null : item.userId === userId;
}

export function createMemoryApplicationRepository(initial: JobApplication[] = []): ApplicationRepository {
  const rows = [...initial];
  return {
    async list(userId) {
      return filterApplications(rows.filter((item) => sameUser(item, userId)));
    },
    async get(userId, id) {
      return rows.find((item) => item.id === id && sameUser(item, userId)) ?? null;
    },
    async create(userId, input) {
      const row = prepareCreate(userId, input);
      rows.push(row);
      return row;
    },
    async update(userId, id, patch) {
      const index = rows.findIndex((item) => item.id === id && sameUser(item, userId));
      if (index < 0) throw new ApplicationStoreError("Candidatura não encontrada.", "not_found");
      const next = prepareUpdate(rows[index]!, patch);
      rows[index] = next;
      return next;
    },
    async delete(userId, id) {
      const index = rows.findIndex((item) => item.id === id && sameUser(item, userId));
      if (index < 0) return false;
      rows.splice(index, 1);
      return true;
    },
    async deleteAll(userId) {
      const before = rows.length;
      for (let i = rows.length - 1; i >= 0; i -= 1) {
        if (sameUser(rows[i]!, userId)) rows.splice(i, 1);
      }
      return before - rows.length;
    },
  };
}

const LOCAL_KEY = "matchcv:applications";

/** Candidaturas do modo anônimo. A API key nunca entra neste storage. */
export function createLocalApplicationRepository(storage: KeyValueStorage, key = LOCAL_KEY): ApplicationRepository {
  const memory = createMemoryApplicationRepository(readRows(storage, key));
  const persist = async () => {
    storage.setItem(key, JSON.stringify(await memory.list(null)));
  };
  return {
    list: (userId) => memory.list(userId),
    get: (userId, id) => memory.get(userId, id),
    async create(userId, input) {
      const row = await memory.create(userId, input);
      await persist();
      return row;
    },
    async update(userId, id, patch) {
      const row = await memory.update(userId, id, patch);
      await persist();
      return row;
    },
    async delete(userId, id) {
      const removed = await memory.delete(userId, id);
      await persist();
      return removed;
    },
    async deleteAll(userId) {
      const count = await memory.deleteAll(userId);
      storage.removeItem(key);
      return count;
    },
  };
}

function readRows(storage: KeyValueStorage, key: string): JobApplication[] {
  const raw = storage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as JobApplication[]) : [];
  } catch {
    return [];
  }
}

/** Copia o que está no navegador para o repositório remoto e tira a cópia local. */
export async function syncLocalApplications(local: ApplicationRepository, remote: ApplicationRepository, remoteUserId: string): Promise<number> {
  const items = await local.list(null);
  let moved = 0;
  for (const item of items) {
    await remote.create(remoteUserId, item);
    await local.delete(null, item.id);
    moved += 1;
  }
  return moved;
}

export class ApplicationRequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApplicationRequestError";
  }
}

export function isLocalFallbackStatus(status: number): boolean {
  return status === 401 || status === 409 || status === 503;
}

export function createHttpApplicationRepository(fetchImpl: typeof fetch = fetch): ApplicationRepository {
  async function request<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetchImpl(url, { ...init, cache: "no-store" });
    if (!response.ok) {
      let message = "Não foi possível salvar a candidatura.";
      try {
        const body = (await response.json()) as { error?: { message?: string } };
        message = body.error?.message ?? message;
      } catch {
        // mantém a mensagem genérica
      }
      throw new ApplicationRequestError(message, response.status);
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  return {
    async list() {
      const body = await request<{ applications: JobApplication[] }>("/api/applications");
      return body.applications;
    },
    async get(_userId, id) {
      try {
        const body = await request<{ application: JobApplication }>(`/api/applications/${id}`);
        return body.application;
      } catch (error) {
        if (error instanceof ApplicationRequestError && error.status === 404) return null;
        throw error;
      }
    },
    async create(_userId, input) {
      const body = await request<{ application: JobApplication }>("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return body.application;
    },
    async update(_userId, id, patch) {
      const body = await request<{ application: JobApplication }>(`/api/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      return body.application;
    },
    async delete(_userId, id) {
      await request<void>(`/api/applications/${id}`, { method: "DELETE" });
      return true;
    },
    async deleteAll() {
      return 0;
    },
  };
}
