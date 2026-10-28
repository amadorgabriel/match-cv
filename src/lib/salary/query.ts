import type { ProviderId } from "@/lib/ai/catalog";
import type { Brief, WorkModel } from "@/lib/schemas/brief";

/** Campos estruturados do brief que /api/salary prioriza sobre o regex. */
export function salaryQueryFromBrief(input: {
  jobDescription: string;
  provider: ProviderId;
  model: string;
  apiKey: string;
  brief?: Brief;
}): {
  jobDescription: string;
  jobTitle?: string;
  normalizedSearchTitle?: string;
  seniority?: string;
  candidateSeniority?: string;
  company?: string;
  location?: string;
  workModel?: WorkModel;
  provider: ProviderId;
  model: string;
  apiKey: string;
} {
  const job = input.brief?.job;
  return {
    jobDescription: input.jobDescription,
    jobTitle: text(job?.title, 2),
    normalizedSearchTitle: text(job?.normalizedSearchTitle, 2),
    seniority: text(job?.seniority, 1),
    candidateSeniority: text(input.brief?.profile.inferredSeniority, 1),
    company: text(job?.company, 2),
    location: text(job?.location, 2),
    workModel: job?.workModel,
    provider: input.provider,
    model: input.model,
    apiKey: input.apiKey,
  };
}

function text(value: string | null | undefined, min: number): string | undefined {
  const trimmed = value?.trim() ?? "";
  return trimmed.length >= min ? trimmed : undefined;
}
