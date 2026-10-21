import type { Brief } from "@/lib/schemas/brief";

export interface PromptInput {
  resumeText: string;
  jobDescription: string;
  achievements?: string;
  /** Texto do PDF opcional de conquistas, já extraído. Ausente quando o usuário não envia o arquivo. */
  achievementsDocument?: string;
  /**
   * Perfil e vaga extraídos uma vez. E-mail, cover letter e entrevista usam isto.
   * O CV ATS ignora o campo e continua com o texto bruto.
   */
  brief?: Brief;
}
