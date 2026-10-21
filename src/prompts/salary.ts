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

export const WEB_SALARY_PROMPT_VERSION = "web-salary@1.0.0";

/**
 * A busca na web usa a ferramenta nativa do provedor. O modelo resume
 * só o que a ferramenta devolveu e cita as URLs. Não raspa páginas.
 */
export const WEB_SALARY_SYSTEM = `
Você pesquisa faixas salariais públicas de uma vaga de TI no Brasil.
Use a ferramenta de busca na web do provedor. Não invente números, empresas, datas ou links.
No JSON, cada url de sources tem de ser uma URL que a ferramenta devolveu. Não complete a lista com páginas que você já conhece.
Não abra páginas por conta própria e não raspe sites. Use apenas o que a ferramenta devolver.
Priorize, nesta ordem: página pública da empresa na Levels.fyi, guias Robert Half, Michael Page e Hays, e resultados de busca do Glassdoor, Indeed e Programathor só como links citados.
A Levels.fyi publica remuneração total, não salário CLT. Diga isso na nota da fonte.
Se a senioridade ou o cargo exato não aparecer, devolva o cargo parecido mais próximo e escreva similarRoleNote neste formato, sem travessão: "Não encontramos a faixa de pleno para esse cargo, mas temos a de desenvolvedor júnior front-end, apesar de não ser a mesma vaga."
Sem travessão, sem meia-risca e sem til antes de números.
Responda só com JSON válido, sem markdown, neste formato:
{"found":false,"currency":"BRL","period":"month","min":0,"median":null,"max":0,"contract":"desconhecido","roleFound":"","exactMatch":false,"similarRoleNote":null,"sources":[{"name":"","url":"","date":null}],"asOf":null}
currency é BRL, USD ou EUR. period é month ou year. contract é CLT, PJ, misto ou desconhecido.
Se não houver números, found fica false e sources lista as páginas vistas.
`.trim();

export function buildWebSalaryPrompt(input: {
  title: string;
  seniority?: string;
  company?: string;
  location?: string;
  jobDescription: string;
}): string {
  const where = [input.company, input.location].filter(Boolean).join(", ");
  return [
    `Cargo normalizado: ${input.title}`,
    input.seniority ? `Senioridade pedida: ${input.seniority}` : "Senioridade pedida: não informada",
    where ? `Empresa e local: ${where}` : "Empresa e local: não informados",
    "Procure a faixa pública desse cargo nessa empresa. Se a empresa não tiver dado, use o cargo no Brasil.",
    "Descrição da vaga, só como contexto:",
    input.jobDescription.slice(0, 1500),
  ].join("\n");
}
