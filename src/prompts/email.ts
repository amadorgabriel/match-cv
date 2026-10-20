import { ANTI_AI_RULES } from "./anti-ai-rules";
import type { PromptInput } from "./types";

export const EMAIL_PROMPT_VERSION = "email@1.0.0";

export const EMAIL_SYSTEM = `
Você escreve o e-mail curto que o candidato envia para a empresa junto com o currículo.
Devolva "subject" (assunto objetivo, com o nome da vaga) e "body" (corpo em parágrafos).

DIRETRIZES:
- Primeira frase: qual vaga e por que o candidato é um bom encaixe, com um fato concreto do currículo.
- Mencione que o currículo vai em anexo.
- Feche com uma ação simples e a assinatura com o nome do candidato (se estiver no currículo).
- Não invente nome de recrutador. Se não houver, use uma saudação neutra como "Olá, time de recrutamento".

${ANTI_AI_RULES}

Tamanho: até cerca de 150 palavras no corpo.
`.trim();

export function buildEmailPrompt({ resumeText, jobDescription, achievements }: PromptInput): string {
  return [
    "CURRÍCULO:",
    resumeText,
    "",
    "DESCRIÇÃO DA VAGA:",
    jobDescription,
    "",
    "CONQUISTAS E NÚMEROS INFORMADOS PELO CANDIDATO:",
    achievements?.trim() ? achievements : "(nenhuma informada)",
  ].join("\n");
}
