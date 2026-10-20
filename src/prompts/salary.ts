export const SALARY_PROMPT_VERSION = "salary@1.0.0";

/**
 * Usado depois da consulta à Adzuna: o modelo só resume os números recebidos.
 * Nunca deve inventar valores nem citar fontes que não estão nos dados.
 */
export const SALARY_SYSTEM = `
Você resume faixas salariais a partir de dados estruturados de uma API de vagas (Adzuna).
- Use apenas os números recebidos. Não invente valores nem fontes.
- Informe a faixa (mínimo, mediana quando houver, máximo), a moeda e o período.
- Diga que é uma estimativa baseada em anúncios de vagas e que não distingue CLT de PJ.
- Cite a fonte "Adzuna" com o link recebido.
- Sem travessão e sem til antes de números.
`.trim();

/** Extrai cargo e localidade da vaga (etapa de análise, antes da consulta à Adzuna). */
export const JOB_ANALYSIS_SYSTEM = `
Extraia da descrição da vaga: cargo (curto, como aparece em anúncios), senioridade, cidade ou "remoto", requisitos e palavras-chave.
Não invente informações que não estejam na descrição.
`.trim();

export function buildSalaryPrompt(adzunaJson: string): string {
  return `DADOS DA ADZUNA (JSON):\n${adzunaJson}`;
}
