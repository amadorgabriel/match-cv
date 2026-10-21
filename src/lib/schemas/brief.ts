import { z } from "zod";

/** Perfil curto do currículo. Não substitui o texto bruto na geração do CV ATS. */
export const CandidateProfileSchema = z.object({
  fullName: z.string().max(120),
  headline: z.string().max(160),
  location: z.string().max(120).optional(),
  summary: z.string().max(800),
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

/** Resumo curto da vaga, reaproveitado por e-mail, cover letter e entrevista. */
export const JobBriefSchema = z.object({
  title: z.string().max(160),
  seniority: z.string().max(40).optional(),
  company: z.string().max(160).optional(),
  location: z.string().max(120).optional(),
  mustHave: z.array(z.string().max(180)).max(8),
  keywords: z.array(z.string().max(80)).max(12),
});
export type JobBrief = z.infer<typeof JobBriefSchema>;

export const BriefSchema = z.object({
  profile: CandidateProfileSchema,
  job: JobBriefSchema,
});
export type Brief = z.infer<typeof BriefSchema>;
