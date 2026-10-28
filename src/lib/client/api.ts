import type { ProviderId } from "@/lib/ai/catalog";
import { ATTEMPT_HEADER, SESSION_HEADER } from "@/lib/ai/telemetry-context";
import { anonymousSessionId } from "@/lib/client/session";
import { PROVIDER_SLOW_MESSAGE } from "@/lib/ai/generation-deadline";
import { parseRetryAfterValue } from "@/lib/async/pool";
import { cvPdfFilename } from "@/lib/pdf/filename";
import type { Brief } from "@/lib/schemas/brief";
import type { Artifact, ArtifactOutput, Cv, GenerateResponse, Salary } from "@/lib/schemas/outputs";
import type { VerificationReport, VerifyRequest } from "@/lib/verification/types";

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

/** 429 e 5xx podem ser tentados de novo. Timeout e ausência de dado não. */
export function isRetryableClientError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.code !== "provider_timeout" &&
    error.code !== "no_data" &&
    (error.status === 429 || error.status >= 500)
  );
}

/** Conexão fechada sem HTTP (proxy de 30s, modelo travado). Não é cancelamento. */
export function errorFromFailedFetch(error: unknown, signal?: AbortSignal): Error {
  if (signal?.aborted) return error instanceof Error ? error : new Error("Aborted");
  if (error instanceof ApiError) return error;
  return new ApiError(PROVIDER_SLOW_MESSAGE, 0, "provider_timeout");
}

async function handle<T>(res: Response): Promise<T> {
  if (res.ok) return (await res.json()) as T;
  let message = "Algo deu errado. Tente de novo.";
  let code: string | undefined;
  const text = await res.text();
  try {
    const body = JSON.parse(text) as { error?: { message?: string; code?: string } };
    message = body.error?.message ?? message;
    code = body.error?.code;
  } catch {
    if (res.status === 500 || res.status === 502 || res.status === 504) {
      message = PROVIDER_SLOW_MESSAGE;
      code = "provider_timeout";
    }
  }
  throw new ApiError(message, res.status, code, parseRetryAfterValue(res.headers.get("retry-after")));
}

function requestBody(body: unknown): string {
  if (body && typeof body === "object" && "useSavedKey" in body && (body as { useSavedKey?: boolean }).useSavedKey) {
    const copy = { ...(body as Record<string, unknown>) };
    delete copy.apiKey;
    return JSON.stringify(copy);
  }
  return JSON.stringify(body);
}

function postJson(url: string, body: unknown, signal?: AbortSignal, attempt?: number) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    [SESSION_HEADER]: anonymousSessionId(),
  };
  if (attempt && attempt > 0) headers[ATTEMPT_HEADER] = String(attempt);
  return fetch(url, {
    method: "POST",
    headers,
    body: requestBody(body),
    signal,
    cache: "no-store",
  });
}

export interface ParseResult {
  text: string;
  pages: number;
  chars: number;
  truncated: boolean;
}

export async function extractPdf(file: File, signal?: AbortSignal): Promise<ParseResult> {
  const form = new FormData();
  form.append("file", file);
  return handle(await fetch("/api/extract-pdf", { method: "POST", body: form, signal }));
}

export async function parseResume(file: File, signal?: AbortSignal): Promise<ParseResult> {
  return extractPdf(file, signal);
}

export async function validateKey(provider: ProviderId, apiKey: string) {
  return handle<{ ok: boolean; mock?: boolean; message?: string }>(
    await postJson("/api/key/validate", { provider, apiKey }),
  );
}

export interface GeneratePayload {
  provider: ProviderId;
  model: string;
  apiKey?: string;
  useSavedKey?: boolean;
  resumeText: string;
  jobDescription: string;
  achievements: string;
  /** Texto do PDF opcional de conquistas. String vazia quando não houver arquivo. */
  achievementsDocument: string;
  /** Mesmo conteúdo de resumeText, para o salário e para compatibilidade dos nomes. */
  cvText?: string;
  /** Conquistas e contexto extra já compostos. */
  achievementsText?: string;
  /** Perfil e vaga extraídos neste fluxo. Só existe em memória. */
  brief?: Brief;
}

export async function fetchBrief(payload: Omit<GeneratePayload, "brief">, signal?: AbortSignal, attempt?: number): Promise<Brief> {
  try {
    const response = await handle<{ brief: Brief }>(await postJson("/api/brief", payload, signal, attempt));
    return response.brief;
  } catch (error) {
    throw errorFromFailedFetch(error, signal);
  }
}

export async function generate<A extends Artifact>(
  artifact: A,
  payload: GeneratePayload,
  signal?: AbortSignal,
  attempt?: number,
): Promise<GenerateResponse<A>> {
  try {
    return await handle(await postJson(`/api/generate/${artifact}`, payload, signal, attempt));
  } catch (error) {
    throw errorFromFailedFetch(error, signal);
  }
}

export async function fetchSalary(
  input: {
    jobDescription: string;
    jobTitle?: string;
    normalizedSearchTitle?: string;
    seniority?: string;
    candidateSeniority?: string;
    company?: string;
    location?: string;
    workModel?: Brief["job"]["workModel"];
    provider: ProviderId;
    model: string;
    apiKey?: string;
    useSavedKey?: boolean;
    cvText?: string;
    achievementsText?: string;
  },
  signal?: AbortSignal,
  attempt?: number,
): Promise<Salary> {
  try {
    return await handle(await postJson("/api/salary", input, signal, attempt));
  } catch (error) {
    throw errorFromFailedFetch(error, signal);
  }
}

export async function fetchVerification(input: VerifyRequest, signal?: AbortSignal): Promise<VerificationReport> {
  try {
    return await handle(await postJson("/api/verify", input, signal));
  } catch (error) {
    throw errorFromFailedFetch(error, signal);
  }
}

export async function downloadCvPdf(cv: Cv, company?: string): Promise<void> {
  const res = await postJson("/api/cv/pdf", cv);
  if (!res.ok) await handle(res);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = cvPdfFilename(cv.fullName, company);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type Results = {
  [K in Artifact]?: GenerateResponse<K>;
} & { salary?: Salary };

export type { ArtifactOutput };
