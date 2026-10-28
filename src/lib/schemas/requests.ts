import { z } from "zod";

import { MODEL_ID_PATTERN, PROVIDER_IDS } from "@/lib/ai/catalog";
import { BriefSchema, WorkModelSchema } from "@/lib/schemas/brief";

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
  /** Perfil e vaga já extraídos neste fluxo. O servidor não guarda este objeto. */
  brief: BriefSchema.optional(),
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

/** Só o CV vem marcado. Os outros materiais nascem do botão Gerar de cada aba. */
export const DEFAULT_OUTPUT_SELECTION: OutputSelection = {
  cv: true,
  email: false,
  "cover-letter": false,
  interview: false,
  salary: false,
};

const ARTIFACT_OUTPUTS = ["cv", "email", "cover-letter", "interview"] as const;

export type ProcessingStepId = "parse" | "brief" | OutputId;

/**
 * Etapas do processamento para a seleção do formulário.
 * A leitura do PDF entra quando algum texto de IA foi marcado.
 * `/api/brief` entra sempre que qualquer material (CV, salário, e-mail, carta ou entrevista) foi marcado.
 * O salário sozinho não lê o PDF nesta lista; o fluxo acrescenta a leitura antes do brief.
 */
export function processingStepsFor(selection: OutputSelection): ProcessingStepId[] {
  const steps: ProcessingStepId[] = [];
  const artifacts = ARTIFACT_OUTPUTS.filter((id) => selection[id]);
  const needsBrief = artifacts.length > 0 || selection.salary;
  if (artifacts.length > 0) steps.push("parse");
  if (needsBrief) steps.push("brief");
  steps.push(...artifacts);
  if (selection.salary) steps.push("salary");
  return steps;
}

const optionalSalaryText = (max: number, min = 1) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value && value.length >= min ? value : undefined));

export const SalaryRequestSchema = z.object({
  jobTitle: optionalSalaryText(120, 2),
  /** Cargo canônico de brief.job. Tem prioridade sobre o regex. */
  normalizedSearchTitle: optionalSalaryText(160, 2),
  seniority: optionalSalaryText(40),
  candidateSeniority: optionalSalaryText(40),
  company: optionalSalaryText(160, 2),
  location: optionalSalaryText(120, 2),
  workModel: WorkModelSchema.optional().catch(undefined),
  jobDescription: z.string().max(LIMITS.maxJobDescriptionChars).optional(),
  /** Opcionais: ligam a busca na web com a chave do usuário. Sem eles, a faixa fica indisponível. */
  provider: z.enum(PROVIDER_IDS).optional(),
  model: z.string().regex(MODEL_ID_PATTERN, "ID de modelo inválido").optional(),
  apiKey: apiKey.optional(),
});
export type SalaryRequest = z.infer<typeof SalaryRequestSchema>;
