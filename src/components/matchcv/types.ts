import type { ProviderId } from "@/lib/ai/catalog";
import type { Artifact } from "@/lib/schemas/outputs";

/** Valores do formulário. Ficam só em memória (estado React). */
export interface FormValues {
  file: File;
  jobDescription: string;
  achievements: string;
  provider: ProviderId;
  model: string;
  apiKey: string;
}

export type StepId = "parse" | Artifact | "salary";
export type StepStatus = "pending" | "running" | "done" | "error";

export interface StepState {
  id: StepId;
  label: string;
  status: StepStatus;
  error?: string;
}

export const STEP_LABELS: Record<StepId, string> = {
  parse: "Ler o currículo",
  cv: "Gerar o CV ATS",
  email: "Escrever o e-mail",
  "cover-letter": "Escrever a cover letter",
  interview: "Montar o roteiro de entrevista",
  salary: "Pesquisar a faixa salarial",
};
