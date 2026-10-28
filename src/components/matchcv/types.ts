import type { ProviderId } from "@/lib/ai/catalog";
import type { Artifact } from "@/lib/schemas/outputs";
import type { OutputSelection } from "@/lib/schemas/requests";

/** Valores do formulário. Ficam só em memória (estado React). */
export interface FormValues {
  file: File;
  /** PDF opcional com conquistas e números por empresa. */
  achievementsFile: File | null;
  jobDescription: string;
  achievements: string;
  provider: ProviderId;
  model: string;
  apiKey: string;
  /** Quando verdadeiro, o servidor decifra a chave salva e a chave não vai no corpo. */
  useSavedKey?: boolean;
  outputs: OutputSelection;
}

export type StepId = "parse" | "brief" | Artifact | "salary";
export type StepStatus = "pending" | "running" | "retrying" | "done" | "error";

export interface StepState {
  id: StepId;
  label: string;
  status: StepStatus;
  error?: string;
  /** Texto da etapa enquanto ela roda ou aguarda retry. */
  detail?: string;
}

export const STEP_LABELS: Record<StepId, string> = {
  parse: "Ler o currículo",
  brief: "Extrair perfil e vaga",
  cv: "Gerar o CV ATS",
  email: "Escrever o e-mail",
  "cover-letter": "Escrever a cover letter",
  interview: "Montar o roteiro de entrevista",
  salary: "Pesquisar a faixa salarial",
};

/** Mensagem visível enquanto a etapa está em andamento. Sem rotação por tempo. */
export const STEP_MESSAGES: Record<StepId, string> = {
  parse: "Lendo o currículo…",
  brief: "Extraindo perfil e vaga…",
  cv: "Gerando o CV…",
  email: "Escrevendo o e-mail…",
  "cover-letter": "Escrevendo a cover letter…",
  interview: "Montando o roteiro de entrevista…",
  salary: "Pesquisando a faixa salarial…",
};

export const STEP_STATUS_LABEL: Record<StepStatus, string> = {
  pending: "Pendente",
  running: "Em andamento",
  retrying: "Aguardando retry",
  done: "Concluído",
  error: "Erro",
};
