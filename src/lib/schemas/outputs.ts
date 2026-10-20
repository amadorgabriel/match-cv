import { z } from "zod";

/** Saídas estruturadas pedidas ao modelo (Output.object) e devolvidas ao cliente. */

export const CvSchema = z.object({
  fullName: z.string(),
  headline: z.string().describe("Cargo-alvo ou título profissional curto"),
  contact: z.object({
    email: z.string().optional(),
    phone: z.string().optional(),
    location: z.string().optional(),
    links: z.array(z.string()).default([]),
  }),
  summary: z.string().describe("Resumo de 2 a 4 linhas"),
  experience: z.array(
    z.object({
      company: z.string(),
      role: z.string(),
      start: z.string(),
      end: z.string().optional(),
      location: z.string().optional(),
      bullets: z.array(z.string()),
    }),
  ),
  education: z.array(
    z.object({
      institution: z.string(),
      degree: z.string(),
      start: z.string().optional(),
      end: z.string().optional(),
    }),
  ),
  skills: z.array(z.string()),
  certifications: z.array(z.string()).default([]),
  languages: z.array(z.string()).default([]),
  /** Seções com títulos no idioma da vaga */
  language: z.enum(["pt-BR", "en"]).default("pt-BR"),
});
export type Cv = z.infer<typeof CvSchema>;

export const EmailSchema = z.object({
  subject: z.string(),
  body: z.string(),
});
export type Email = z.infer<typeof EmailSchema>;

export const CoverLetterSchema = z.object({
  body: z.string(),
});
export type CoverLetter = z.infer<typeof CoverLetterSchema>;

export const InterviewSchema = z.object({
  sections: z.array(
    z.object({
      title: z.string(),
      items: z.array(
        z.object({
          question: z.string(),
          suggestedAnswer: z.string().optional(),
          notes: z.string().optional(),
        }),
      ),
    }),
  ),
});
export type Interview = z.infer<typeof InterviewSchema>;

export const SalarySchema = z.object({
  currency: z.string().default("BRL"),
  period: z.enum(["month", "year"]),
  min: z.number(),
  median: z.number().optional(),
  max: z.number(),
  query: z.object({ jobTitle: z.string(), location: z.string().optional() }),
  sampleSize: z.number().optional(),
  isEstimate: z.literal(true),
  isMock: z.boolean().default(false),
  sources: z.array(
    z.object({
      name: z.string(),
      url: z.string(),
      note: z.string().optional(),
    }),
  ),
  disclaimer: z.string(),
});
export type Salary = z.infer<typeof SalarySchema>;

/** Resultado do validador anti-IA anexado a cada texto gerado. */
export const ValidationReportSchema = z.object({
  ok: z.boolean(),
  autoFixed: z.boolean(),
  violations: z.array(
    z.object({
      rule: z.string(),
      message: z.string(),
      match: z.string().optional(),
    }),
  ),
});
export type ValidationReport = z.infer<typeof ValidationReportSchema>;

export const ARTIFACTS = ["cv", "email", "cover-letter", "interview"] as const;
export type Artifact = (typeof ARTIFACTS)[number];

export const ArtifactSchemas = {
  cv: CvSchema,
  email: EmailSchema,
  "cover-letter": CoverLetterSchema,
  interview: InterviewSchema,
} as const;

export type ArtifactOutput = {
  cv: Cv;
  email: Email;
  "cover-letter": CoverLetter;
  interview: Interview;
};

export interface GenerateResponse<A extends Artifact = Artifact> {
  artifact: A;
  data: ArtifactOutput[A];
  validation?: ValidationReport;
  mock: boolean;
  promptVersion: string;
}
