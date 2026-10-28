import { z } from "zod";

/** Texto opcional. String vazia e null contam como ausente na hora de usar o campo. */
function optionalText(max: number) {
  return z.string().trim().max(max).nullable().optional();
}

function optionalList(maxItem: number, maxItems: number) {
  return z.array(z.string().trim().max(maxItem)).max(maxItems).nullable().optional();
}

/** Perfil curto do currículo. Não substitui o texto bruto na geração do CV ATS. */
export const CandidateProfileSchema = z.object({
  fullName: z.string().max(120),
  headline: z.string().max(160),
  location: optionalText(120),
  summary: z.string().max(800),
  email: optionalText(160),
  phone: optionalText(40),
  linkedin: optionalText(200),
  github: optionalText(200),
  website: optionalText(200),
  inferredSeniority: optionalText(40),
  yearsOfExperience: z.number().int().min(0).max(80).nullable().optional(),
  certifications: optionalList(120, 8),
  languages: optionalList(40, 8),
  experience: z
    .array(
      z.object({
        company: z.string().max(160),
        role: z.string().max(160),
        dates: z.string().max(80),
        highlights: z.array(z.string().max(280)).max(4),
      }),
    )
    .max(6),
  skills: z.array(z.string().max(80)).max(20),
  education: z
    .array(
      z.object({
        institution: z.string().max(160),
        degree: z.string().max(160),
      }),
    )
    .max(4),
  achievements: z.array(z.string().max(280)).max(8),
});
export type CandidateProfile = z.infer<typeof CandidateProfileSchema>;

export const WORK_MODELS = ["remoto", "hibrido", "presencial", "nao_informado"] as const;
export const WorkModelSchema = z.enum(WORK_MODELS);
export type WorkModel = z.infer<typeof WorkModelSchema>;

/** Resumo curto da vaga, reaproveitado por CV, salário, e-mail, cover letter e entrevista. */
export const JobBriefSchema = z.object({
  title: z.string().max(160),
  /** Cargo canônico em português para busca salarial no Brasil, sem nível duplicado. */
  normalizedSearchTitle: optionalText(160),
  seniority: optionalText(40),
  /** Só o nome real da empresa contratante. Vazio quando a vaga não diz. */
  company: optionalText(160),
  location: optionalText(120),
  workModel: WorkModelSchema.optional().catch(undefined),
  mustHave: z.array(z.string().max(180)).max(8),
  keywords: z.array(z.string().max(80)).max(12),
});
export type JobBrief = z.infer<typeof JobBriefSchema>;

export const BriefSchema = z.object({
  profile: CandidateProfileSchema,
  job: JobBriefSchema,
});
export type Brief = z.infer<typeof BriefSchema>;
