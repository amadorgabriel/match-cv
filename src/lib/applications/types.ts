import { z } from "zod";

import { CoverLetterSchema, CvSchema, EmailSchema, InterviewSchema, SalarySchema } from "@/lib/schemas/outputs";

export const APPLICATION_STATUSES = ["aplicado", "entrevista", "oferta", "recusado"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  aplicado: "Aplicado",
  entrevista: "Entrevista",
  oferta: "Oferta",
  recusado: "Recusado",
};

export const ApplicationMaterialsSchema = z.object({
  cv: CvSchema.nullable().optional(),
  email: EmailSchema.nullable().optional(),
  coverLetter: CoverLetterSchema.nullable().optional(),
  interview: InterviewSchema.nullable().optional(),
  salary: SalarySchema.nullable().optional(),
});
export type ApplicationMaterials = z.infer<typeof ApplicationMaterialsSchema>;

export interface JobApplication {
  id: string;
  userId: string | null;
  company: string;
  role: string;
  appliedAt: string;
  status: ApplicationStatus;
  notes: string;
  materials: ApplicationMaterials;
  createdAt: string;
  updatedAt: string;
}

export interface NewApplication {
  id?: string;
  company: string;
  role: string;
  appliedAt?: string;
  status?: ApplicationStatus;
  notes?: string;
  materials?: ApplicationMaterials;
}

export interface ApplicationPatch {
  company?: string;
  role?: string;
  status?: ApplicationStatus;
  notes?: string;
  materials?: ApplicationMaterials;
}

export interface ApplicationQuery {
  status?: ApplicationStatus;
  query?: string;
}

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, "ID inválido.");

export const CreateApplicationSchema = z.object({
  id: uuid.optional(),
  company: z.string().trim().min(1).max(120),
  role: z.string().trim().min(1).max(160),
  appliedAt: z.string().refine((value) => !Number.isNaN(Date.parse(value)), "Data inválida.").optional(),
  status: z.enum(APPLICATION_STATUSES).optional(),
  notes: z.string().max(5_000).optional(),
  materials: ApplicationMaterialsSchema.optional(),
});

export const UpdateApplicationSchema = z
  .object({
    company: z.string().trim().min(1).max(120).optional(),
    role: z.string().trim().min(1).max(160).optional(),
    status: z.enum(APPLICATION_STATUSES).optional(),
    notes: z.string().max(5_000).optional(),
    materials: ApplicationMaterialsSchema.optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), { message: "Nada para atualizar." });

export class ApplicationStoreError extends Error {
  constructor(
    message: string,
    public code: "invalid" | "not_found" = "invalid",
  ) {
    super(message);
    this.name = "ApplicationStoreError";
  }
}
