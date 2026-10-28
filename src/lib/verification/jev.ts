import "server-only";

import type { ClaimStatus, VerificationReport, VerifyRequest } from "./types";
import { verifyLocally } from "./local";

const TYPESAFE_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const MAX_JEV_CLAIMS = 8;

export interface VerifyOptions {
  fetch?: typeof fetch;
  signal?: AbortSignal;
}

/**
 * Com TYPESAFE_API_KEY, pede nota e classificação ao Jev (System One).
 * Sem a chave, ou se a chamada falhar, devolve o verificador local em pt-BR.
 * A chave fica só no servidor.
 */
export async function verifyCandidate(input: VerifyRequest, options: VerifyOptions = {}): Promise<VerificationReport> {
  const local = verifyLocally(input);
  const apiKey = readTypesafeKey();
  if (!apiKey) return local;
  try {
    const remote = await askJev(input, local, apiKey, options);
    return remote;
  } catch {
    return local;
  }
}

export function readTypesafeKey(): string | undefined {
  const value = process.env["TYPESAFE_API_KEY"]?.trim();
  return value ? value : undefined;
}

async function askJev(
  input: VerifyRequest,
  local: VerificationReport,
  apiKey: string,
  options: VerifyOptions,
): Promise<VerificationReport> {
  const claims = local.claims.slice(0, MAX_JEV_CLAIMS);
  const questions: Record<string, unknown> = {
    match: {
      type: "score",
      instructions:
        "How well does the original resume cover the job requirements? Ignore generated statements that the resume does not support.",
      criteria: [
        "Almost none of the required skills or experience appear in the resume",
        "A minority of the requirements are covered",
        "About half of the requirements are covered",
        "Most requirements are covered by proven experience",
        "The resume covers the requirements and the seniority matches",
      ],
    },
  };
  claims.forEach((claim, index) => {
    questions[`claim_${index}`] = {
      type: "choice",
      instructions: `Is this generated statement supported by the original resume and achievements?\n"${claim.text}"`,
      criteria: {
        supported: "The statement is directly backed by the original material",
        unverified: "The statement is absent or extrapolated",
        contradicted: "The statement conflicts with the original material",
      },
    };
  });

  const fetchImpl = options.fetch ?? fetch;
  const response = await fetchImpl(TYPESAFE_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "jev-latest",
      state: {
        resume: clip(input.resumeText, 6000),
        achievements: clip(`${input.achievements}\n${input.achievementsDocument}`, 3000),
        job: clip(input.jobDescription, 4000),
        brief: input.brief ?? null,
      },
      questions,
    }),
    signal: options.signal ?? AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`jev_http_${response.status}`);
  const payload: unknown = await response.json();
  return mergeJev(local, payload);
}

function mergeJev(local: VerificationReport, payload: unknown): VerificationReport {
  if (!payload || typeof payload !== "object") throw new Error("jev_invalid");
  const answers = (payload as { answers?: unknown }).answers;
  if (!answers || typeof answers !== "object") throw new Error("jev_invalid");
  const record = answers as Record<string, { score?: unknown; choice?: unknown }>;
  const score = record.match?.score;
  if (typeof score !== "number" || !Number.isFinite(score)) throw new Error("jev_invalid");
  const matchScore = Math.max(0, Math.min(100, Math.round((score / 4) * 100)));
  const claims = local.claims.map((claim, index) => {
    const choice = record[`claim_${index}`]?.choice;
    if (choice !== "supported" && choice !== "unverified" && choice !== "contradicted") return claim;
    return { ...claim, status: choice as ClaimStatus, reason: reasonFor(choice) };
  });
  return { ...local, matchScore, claims, engine: "jev" };
}

function reasonFor(status: ClaimStatus): string {
  if (status === "supported") return "O Jev encontrou apoio no material original.";
  if (status === "contradicted") return "O Jev marcou conflito com o currículo original.";
  return "O Jev não encontrou apoio direto no currículo original.";
}

function clip(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max);
}
