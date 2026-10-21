import type { ProviderId } from "@/lib/ai/catalog";
import { parseRetryAfterValue } from "@/lib/async/pool";
import type { Artifact, ArtifactOutput, Cv, GenerateResponse, Salary } from "@/lib/schemas/outputs";

/**
 * Chamadas do navegador para as rotas internas (mesma origem, HTTPS em produção).
 * A chave vai só no corpo do POST. Nunca na URL, nunca em localStorage.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public retryAfterSec?: number,
  ) {
    super(message);
  }
}

/** 429 e 5xx podem ser tentados de novo. `no_data` não: não é instabilidade. */
export function isRetryableClientError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 429 || (error.status >= 500 && error.code !== "no_data"));
}

async function handle<T>(res: Response): Promise<T> {
  if (res.ok) return (await res.json()) as T;
  let message = "Algo deu errado. Tente de novo.";
  let code: string | undefined;
  try {
    const body = (await res.json()) as { error?: { message?: string; code?: string } };
    message = body.error?.message ?? message;
    code = body.error?.code;
  } catch {
    // corpo não JSON
  }
  throw new ApiError(message, res.status, code, parseRetryAfterValue(res.headers.get("retry-after")));
}

function postJson(url: string, body: unknown, signal?: AbortSignal) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
    cache: "no-store",
  });
}

export interface ParseResult {
  text: string;
  pages: number;
  chars: number;
  truncated: boolean;
  empty: boolean;
}

export async function parseResume(file: File, signal?: AbortSignal): Promise<ParseResult> {
  const form = new FormData();
  form.append("file", file);
  return handle(await fetch("/api/parse", { method: "POST", body: form, signal }));
}

export async function validateKey(provider: ProviderId, apiKey: string) {
  return handle<{ ok: boolean; mock?: boolean; message?: string }>(
    await postJson("/api/key/validate", { provider, apiKey }),
  );
}

export interface GeneratePayload {
  provider: ProviderId;
  model: string;
  apiKey: string;
  resumeText: string;
  jobDescription: string;
  achievements: string;
  /** Texto do PDF opcional de conquistas. String vazia quando não houver arquivo. */
  achievementsDocument: string;
}

export async function generate<A extends Artifact>(
  artifact: A,
  payload: GeneratePayload,
  signal?: AbortSignal,
): Promise<GenerateResponse<A>> {
  return handle(await postJson(`/api/generate/${artifact}`, payload, signal));
}

export async function fetchSalary(
  input: { jobDescription: string; provider: ProviderId; model: string; apiKey: string },
  signal?: AbortSignal,
): Promise<Salary> {
  return handle(await postJson("/api/salary", input, signal));
}

export async function downloadCvPdf(cv: Cv): Promise<void> {
  const res = await postJson("/api/cv/pdf", cv);
  if (!res.ok) await handle(res);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${cv.fullName.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "") || "cv"}-CV.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type Results = {
  [K in Artifact]?: GenerateResponse<K>;
} & { salary?: Salary };

export type { ArtifactOutput };
