import { z } from "zod";

import { MODEL_ID_PATTERN, PROVIDER_IDS } from "@/lib/ai/catalog";

/** Limites de entrada (também validados no cliente). */
export const LIMITS = {
  maxFileBytes: 4 * 1024 * 1024, // abaixo do limite de ~4,5 MB de body da Vercel
  maxResumeChars: 40_000,
  maxJobDescriptionChars: 20_000,
  maxAchievementsChars: 3_000,
  maxApiKeyChars: 300,
} as const;

/**
 * Teto do JSON de /api/generate. Cobre currículo e documento de conquistas
 * no limite do schema, com folga para aspas escapadas.
 */
export const GENERATE_REQUEST_MAX_BYTES = 200_000;

const apiKey = z.string().trim().min(10, "Chave muito curta").max(LIMITS.maxApiKeyChars);

export const ProviderSelectionSchema = z.object({
  provider: z.enum(PROVIDER_IDS),
  model: z.string().regex(MODEL_ID_PATTERN, "ID de modelo inválido"),
});

export const ValidateKeyRequestSchema = z.object({
  provider: z.enum(PROVIDER_IDS),
  apiKey,
});

export const GenerateRequestSchema = ProviderSelectionSchema.extend({
  apiKey,
  resumeText: z.string().min(50, "Currículo vazio ou muito curto").max(LIMITS.maxResumeChars),
  jobDescription: z.string().min(50, "Descrição da vaga muito curta").max(LIMITS.maxJobDescriptionChars),
  achievements: z.string().max(LIMITS.maxAchievementsChars).optional().default(""),
  /** Texto extraído do PDF opcional de conquistas. Vazio quando o usuário não envia o arquivo. */
  achievementsDocument: z.string().max(LIMITS.maxResumeChars).optional().default(""),
});
export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;

/** Materiais que o usuário pode marcar no formulário. */
export const OUTPUT_IDS = ["cv", "email", "cover-letter", "interview", "salary"] as const;
export type OutputId = (typeof OUTPUT_IDS)[number];

export const OutputSelectionSchema = z
  .object({
    cv: z.boolean(),
    email: z.boolean(),
    "cover-letter": z.boolean(),
    interview: z.boolean(),
    salary: z.boolean(),
  })
  .refine((value) => OUTPUT_IDS.some((id) => value[id]), {
    message: "Selecione ao menos um material.",
  });
export type OutputSelection = z.infer<typeof OutputSelectionSchema>;

export const DEFAULT_OUTPUT_SELECTION: OutputSelection = {
  cv: true,
  email: true,
  "cover-letter": true,
  interview: true,
  salary: true,
};

const ARTIFACT_OUTPUTS = ["cv", "email", "cover-letter", "interview"] as const;

/**
 * Etapas do processamento para a seleção do formulário.
 * A leitura do PDF só entra quando algum texto de IA foi marcado.
 * CV PDF, e-mail, cover letter, entrevista e faixa salarial só entram se marcados.
 */
export function processingStepsFor(selection: OutputSelection): Array<"parse" | OutputId> {
  const steps: Array<"parse" | OutputId> = [];
  const artifacts = ARTIFACT_OUTPUTS.filter((id) => selection[id]);
  if (artifacts.length > 0) steps.push("parse");
  steps.push(...artifacts);
  if (selection.salary) steps.push("salary");
  return steps;
}

export const SalaryRequestSchema = z.object({
  jobTitle: z.string().trim().min(2).max(120).optional(),
  location: z.string().trim().max(120).optional(),
  jobDescription: z.string().max(LIMITS.maxJobDescriptionChars).optional(),
});
export type SalaryRequest = z.infer<typeof SalaryRequestSchema>;
