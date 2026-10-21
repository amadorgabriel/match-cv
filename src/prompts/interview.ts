import { ACHIEVEMENTS_DOCUMENT_RULE, withAchievementsDocument } from "./achievements-document";
import { buildBriefedUserPrompt } from "./brief";
import type { PromptInput } from "./types";

export const INTERVIEW_PROMPT_VERSION = "interview@1.1.0";

export const INTERVIEW_SYSTEM = `
Você prepara candidatos para entrevistas de vagas de tecnologia.
Monte um roteiro de preparação no schema fornecido, com estas seções, nesta ordem:
1. "Perguntas técnicas prováveis": baseadas nos requisitos da vaga. Para cada uma, uma resposta sugerida usando experiências reais do currículo.
2. "Perguntas comportamentais": no formato STAR, usando situações reais do currículo.
3. "Perguntas para fazer à empresa": perguntas específicas sobre o time, o produto e o processo, baseadas na vaga.
4. "Pontos de atenção": lacunas entre o currículo e a vaga e como abordá-las com honestidade.

Regras:
- Nunca invente experiências. Se o currículo não cobre um requisito, diga isso em "Pontos de atenção".
- ${ACHIEVEMENTS_DOCUMENT_RULE}
- Escreva no idioma da vaga, em tom direto. Sem travessão e sem til antes de números.
`.trim();

export function buildInterviewPrompt(input: PromptInput): string {
  if (input.brief) return buildBriefedUserPrompt({ ...input, brief: input.brief });
  const { resumeText, jobDescription, achievements, achievementsDocument } = input;
  return withAchievementsDocument(
    [
      "CURRÍCULO:",
      resumeText,
      "",
      "DESCRIÇÃO DA VAGA:",
      jobDescription,
      "",
      "CONQUISTAS E NÚMEROS INFORMADOS PELO CANDIDATO:",
      achievements?.trim() ? achievements : "(nenhuma informada)",
    ].join("\n"),
    achievementsDocument,
  );
}
