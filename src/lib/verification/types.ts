import { z } from "zod";

import { BriefSchema } from "@/lib/schemas/brief";
import { CoverLetterSchema, CvSchema, EmailSchema, InterviewSchema } from "@/lib/schemas/outputs";
import { LIMITS } from "@/lib/schemas/requests";

export const CLAIM_STATUSES = ["supported", "unverified", "contradicted"] as const;
export const ClaimStatusSchema = z.enum(CLAIM_STATUSES);
export type ClaimStatus = z.infer<typeof ClaimStatusSchema>;

export const VERIFICATION_ARTIFACTS = ["cv", "email", "cover-letter", "interview"] as const;
export const VerificationArtifactSchema = z.enum(VERIFICATION_ARTIFACTS);
export type VerificationArtifact = z.infer<typeof VerificationArtifactSchema>;

export const SENIORITY_ALIGNMENTS = ["alinhada", "abaixo", "acima", "indeterminada"] as const;

export const VerificationClaimSchema = z.object({
  artifact: VerificationArtifactSchema,
  text: z.string(),
  status: ClaimStatusSchema,
  /** Por que a afirmação ficou nesse status, em português. */
  reason: z.string(),
});
export type VerificationClaim = z.infer<typeof VerificationClaimSchema>;

export const VerificationReportSchema = z.object({
  matchScore: z.number().int().min(0).max(100),
  covered: z.array(z.string()),
  missing: z.array(z.string()),
  keywordHits: z.array(z.string()),
  keywordMisses: z.array(z.string()),
  seniorityAlignment: z.enum(SENIORITY_ALIGNMENTS),
  claims: z.array(VerificationClaimSchema),
  engine: z.enum(["local", "jev"]),
});
export type VerificationReport = z.infer<typeof VerificationReportSchema>;

export const VerifyRequestSchema = z.object({
  resumeText: z.string().max(LIMITS.maxResumeChars),
  jobDescription: z.string().max(LIMITS.maxJobDescriptionChars),
  achievements: z.string().max(LIMITS.maxAchievementsChars).optional().default(""),
  achievementsDocument: z.string().max(LIMITS.maxResumeChars).optional().default(""),
  brief: BriefSchema.optional(),
  cv: CvSchema.optional(),
  email: EmailSchema.optional(),
  coverLetter: CoverLetterSchema.optional(),
  interview: InterviewSchema.optional(),
});
export type VerifyRequest = z.infer<typeof VerifyRequestSchema>;
