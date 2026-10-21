import type { Brief } from "@/lib/schemas/brief";

import { withAchievementsDocument } from "./achievements-document";
import type { PromptInput } from "./types";

export const BRIEF_PROMPT_VERSION = "brief@1.0.0";

/** Folga para o JSON do perfil e da vaga, sem cortar a última experiência. */
export const BRIEF_MAX_OUTPUT_TOKENS = 4000;

/**
 * Uma extração só. O texto antigo de análise da vaga entra aqui, junto com o perfil do CV.
 * E-mail, cover letter e entrevista recebem o resultado, não o currículo inteiro de novo.
 */
export const BRIEF_SYSTEM = `
Extraia um perfil curto do candidato e um resumo curto da vaga.
Não invente empresa, cargo, data, tecnologia ou número que não esteja no material.

Perfil: nome, título profissional, local se houver, resumo de até 4 linhas, no máximo 6 experiências (empresa, cargo, datas e até 3 destaques cada), até 20 skills, até 4 formações e até 8 conquistas com os números que aparecem no currículo ou no documento de conquistas.

Vaga: cargo curto como aparece em anúncios, senioridade, empresa, cidade ou "remoto", até 8 requisitos e até 12 palavras-chave. Não invente o que a descrição não diz.

Responda só no schema.
`.trim();

export function buildBriefPrompt({ resumeText, jobDescription, achievements, achievementsDocument }: PromptInput): string {
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

/** Texto curto que e-mail, cover letter e entrevista recebem no lugar do CV inteiro. */
export function formatBrief(brief: Brief): string {
  const { profile, job } = brief;
  const experience = profile.experience
    .map((item) => {
      const highlights = item.highlights.length ? `: ${item.highlights.join("; ")}` : "";
      return `- ${item.role} na ${item.company} (${item.dates})${highlights}`;
    })
    .join("\n");
  const education = profile.education.map((item) => `- ${item.degree}, ${item.institution}`).join("\n");
  const achievements = profile.achievements.map((item) => `- ${item}`).join("\n");
  return [
    `Nome: ${profile.fullName}`,
    `Título: ${profile.headline}`,
    profile.location ? `Local do candidato: ${profile.location}` : "",
    `Resumo: ${profile.summary}`,
    "Experiências:",
    experience || "(nenhuma)",
    "Skills:",
    profile.skills.join(", ") || "(nenhuma)",
    "Formação:",
    education || "(nenhuma)",
    "Conquistas extraídas:",
    achievements || "(nenhuma)",
    `Cargo da vaga: ${job.title}`,
    job.seniority ? `Senioridade: ${job.seniority}` : "",
    job.company ? `Empresa: ${job.company}` : "",
    job.location ? `Local da vaga: ${job.location}` : "",
    "Requisitos:",
    job.mustHave.map((item) => `- ${item}`).join("\n") || "(nenhum)",
    "Palavras-chave:",
    job.keywords.join(", ") || "(nenhuma)",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export function buildBriefedUserPrompt(input: PromptInput & { brief: Brief }): string {
  return [
    "PERFIL DO CANDIDATO E RESUMO DA VAGA:",
    formatBrief(input.brief),
    "",
    "CONQUISTAS E NÚMEROS INFORMADOS PELO CANDIDATO:",
    input.achievements?.trim() ? input.achievements : "(nenhuma informada)",
  ].join("\n");
}
