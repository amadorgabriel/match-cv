/** Título da seção que delimita o PDF de conquistas dentro do prompt. */
export const ACHIEVEMENTS_DOCUMENT_HEADING = "DOCUMENTO DE CONQUISTAS FORNECIDO PELO USUÁRIO";

/** Instrução condicional, usada no system prompt mesmo quando o PDF não veio. */
export const ACHIEVEMENTS_DOCUMENT_RULE = `Se aparecer a seção "${ACHIEVEMENTS_DOCUMENT_HEADING}", trate esse texto como fonte factual enviada pelo candidato, com conquistas e números por empresa. Não invente experiência, empresa, cargo, data, tecnologia ou número além desse documento e do currículo.`;

/**
 * Bloco do prompt de usuário com o texto do PDF de conquistas.
 * String vazia quando o usuário não enviou o arquivo, para o restante do prompt ficar igual.
 */
export function achievementsDocumentBlock(text: string | undefined): string {
  const body = text?.trim() ?? "";
  if (!body) return "";
  return [
    `${ACHIEVEMENTS_DOCUMENT_HEADING}:`,
    "Fonte factual enviada pelo candidato. Use apenas o que está neste texto. Nunca invente experiência, empresa, cargo, data, tecnologia ou número além deste documento e do currículo.",
    "---",
    body,
    "---",
  ].join("\n");
}

export function withAchievementsDocument(prompt: string, text: string | undefined): string {
  const block = achievementsDocumentBlock(text);
  return block ? `${prompt}\n\n${block}` : prompt;
}
