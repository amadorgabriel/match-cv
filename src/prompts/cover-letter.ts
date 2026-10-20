import { ANTI_AI_RULES } from "./anti-ai-rules";
import type { PromptInput } from "./types";

export const COVER_LETTER_PROMPT_VERSION = "cover-letter@1.0.0";

export const COVER_LETTER_SYSTEM = `
Você escreve cover letters para vagas de tecnologia em nome do candidato, em primeira pessoa.
Devolva só o corpo da carta no campo "body" do schema, em parágrafos separados por uma linha em branco.

DIRETRIZES:
- Abra com o motivo concreto do interesse nesta vaga e nesta empresa (use só o que a descrição da vaga informa).
- Conecte de 2 a 3 experiências reais do currículo aos requisitos mais importantes da vaga.
- Se o usuário informou conquistas e números, use pelo menos uma delas.
- Feche com uma ação simples (por exemplo, disponibilidade para conversar).

${ANTI_AI_RULES}

Tamanho: até cerca de 350 palavras.
`.trim();

export function buildCoverLetterPrompt({ resumeText, jobDescription, achievements }: PromptInput): string {
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
