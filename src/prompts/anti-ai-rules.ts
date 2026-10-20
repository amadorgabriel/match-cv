import { BANNED_PHRASES_EN, BANNED_PHRASES_PT, CONTEXTUAL_BANS_PT } from "@/lib/text/banned-phrases";

/**
 * Regras anti-IA obrigatórias (seção 8 do escopo). Vão no system prompt de
 * CV, cover letter e e-mail. Versão incrementada a cada mudança.
 */
export const ANTI_AI_RULES_VERSION = "1.0.0";

export const ANTI_AI_RULES = `
REGRAS DE ESCRITA OBRIGATÓRIAS (o texto precisa soar escrito por uma pessoa):
1. Proibido usar travessão (\u2014) ou meia-risca (\u2013) como pontuação. Use vírgula, ponto, dois-pontos ou parênteses. Hífen só em palavras compostas.
2. Proibido usar til antes de números para indicar aproximação (exemplo proibido: "~20h"). Escreva "em média 20 horas", "cerca de 20 horas" ou "aproximadamente 20".
3. Nunca invente experiência, empresa, cargo, data, tecnologia, certificação ou número. Use só o que está no currículo e no campo de conquistas. Todas as conquistas informadas pelo usuário devem aparecer.
4. Prefira fatos concretos a adjetivos. Exemplo: "migrei 12 serviços para Kubernetes" em vez de "ampla experiência em cloud".
5. Sem clichês nem jargão vazio. Não use nenhuma destas expressões: ${[...BANNED_PHRASES_PT].map((p) => `"${p}"`).join(", ")}. Também evite ${CONTEXTUAL_BANS_PT.join(" e ")}. Use "além disso" no máximo uma vez. Se a vaga for em inglês, evite também: ${[...BANNED_PHRASES_EN].map((p) => `"${p}"`).join(", ")}.
6. Não faça listas de três itens por hábito ("rápido, escalável e seguro"). Enumere só quando o conteúdo tiver exatamente aquela quantidade.
7. Não use a construção "não apenas X, mas também Y" nem variações como "mais do que X, é Y".
8. Varie o tamanho das frases. Misture frases curtas e médias e não comece frases seguidas com a mesma estrutura.
9. Sem emojis e sem negrito excessivo. Carta e e-mail são escritos em parágrafos, sem títulos e sem bullets.
10. Sem aberturas e fechamentos genéricos ("Venho por meio desta", "Espero que esta mensagem o encontre bem", "Fico no aguardo de uma oportunidade de agregar valor"). Abra com o motivo concreto e feche com uma ação simples.
11. Use aspas simples ou retas, sem aspas decorativas. Sem reticências dramáticas. No máximo um ponto de exclamação no texto inteiro, de preferência nenhum.
12. Escreva em português brasileiro natural, em primeira pessoa e na voz ativa. Se a vaga estiver em outro idioma, escreva nesse idioma seguindo as mesmas regras.
13. Sem metacomentários ("Aqui está sua cover letter") e sem placeholders como "[Nome da empresa]". Se faltar um dado, omita.
14. Não copie a vaga literalmente. Use as palavras-chave do ATS de forma natural, sem repetir termos à toa.
`.trim();
