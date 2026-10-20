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
});
export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;

export const SalaryRequestSchema = z.object({
  jobTitle: z.string().trim().min(2).max(120).optional(),
  location: z.string().trim().max(120).optional(),
  jobDescription: z.string().max(LIMITS.maxJobDescriptionChars).optional(),
});
export type SalaryRequest = z.infer<typeof SalaryRequestSchema>;
