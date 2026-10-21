export interface PromptInput {
  resumeText: string;
  jobDescription: string;
  achievements?: string;
  /** Texto do PDF opcional de conquistas, já extraído. Ausente quando o usuário não envia o arquivo. */
  achievementsDocument?: string;
}
