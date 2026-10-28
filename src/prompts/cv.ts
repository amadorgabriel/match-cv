import { ACHIEVEMENTS_DOCUMENT_RULE, withAchievementsDocument } from "./achievements-document";
import { ANTI_AI_RULES } from "./anti-ai-rules";
import { formatBrief } from "./brief";
import type { PromptInput } from "./types";

export const CV_PROMPT_VERSION = "cv@1.2.0";

export const CV_SYSTEM = `
Você é um especialista em currículos para vagas de tecnologia e em sistemas ATS.
Sua tarefa é reescrever o currículo do candidato para a vaga informada, em formato estruturado (JSON no schema fornecido).

DIRETRIZES DO CV:
- Reordene e reescreva o que já existe no currículo para destacar o que a vaga pede. Não acrescente nada que não esteja no currículo ou nas conquistas informadas.
- ${ACHIEVEMENTS_DOCUMENT_RULE}
- Mantenha empresas, cargos e datas exatamente como no currículo original.
- Resumo com 2 a 4 linhas, específico para a vaga.
- Bullets de experiência começando com verbo no passado, com resultado concreto quando houver número no material de origem.
- Skills: só as que aparecem no currículo. Priorize as que a vaga pede.
- Títulos de seção convencionais no idioma da vaga (o template cuida da formatação).
- Use o campo "language" com "pt-BR" ou "en" de acordo com o idioma da vaga.

${ANTI_AI_RULES}

Tamanho: resumo do CV com 2 a 4 linhas.
`.trim();

/**
 * O CV ATS continua com o texto bruto: o perfil curto não guarda empresas,
 * datas e bullets com a fidelidade que o PDF precisa repetir.
 * Quando o brief existe, ele entra como mapa da vaga e do contato, sem substituir a fonte.
 */
export function buildCvPrompt({ resumeText, jobDescription, achievements, achievementsDocument, brief }: PromptInput): string {
  const base = withAchievementsDocument(
    [
      "CURRÍCULO ORIGINAL:",
      resumeText,
      "",
      "DESCRIÇÃO DA VAGA:",
      jobDescription,
      "",
      "CONQUISTAS E NÚMEROS QUE DEVEM APARECER OBRIGATORIAMENTE NO CV:",
      achievements?.trim() ? achievements : "(nenhuma informada)",
    ].join("\n"),
    achievementsDocument,
  );
  if (!brief) return base;
  return [
    base,
    "",
    "DADOS ESTRUTURADOS JÁ EXTRAÍDOS (mapa da vaga e do perfil; não substitua empresas, datas ou bullets do currículo original e não invente contato):",
    formatBrief(brief),
  ].join("\n");
}
