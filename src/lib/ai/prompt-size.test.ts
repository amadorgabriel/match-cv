import { describe, expect, it } from "vitest";

import { MOCK_BRIEF } from "@/lib/mock/brief";
import { buildBriefPrompt, BRIEF_SYSTEM } from "@/prompts/brief";
import { buildCoverLetterPrompt, COVER_LETTER_SYSTEM } from "@/prompts/cover-letter";
import { buildCvPrompt, CV_SYSTEM } from "@/prompts/cv";
import { buildEmailPrompt, EMAIL_SYSTEM } from "@/prompts/email";
import { buildInterviewPrompt, INTERVIEW_SYSTEM } from "@/prompts/interview";
import { buildWebSalaryPrompt, WEB_SALARY_SYSTEM } from "@/prompts/salary";

/** Mesma conta da análise anterior: caracteres divididos por 4. */
function tokens(text: string): number {
  return Math.ceil(text.length / 4);
}

const resumeText = "Experiência em TypeScript. ".repeat(223);
const jobDescription = "Vaga de desenvolvedor. ".repeat(109);
const achievements = "Reduzi o tempo de deploy em 40%. ".repeat(12);
const input = { resumeText, jobDescription, achievements };

describe("tamanho dos prompts", () => {
  it("mantém o currículo bruto só no CV e encolhe e-mail, carta e entrevista", () => {
    expect(resumeText.length).toBeGreaterThanOrEqual(6000);
    expect(jobDescription.length).toBeGreaterThanOrEqual(2500);

    const cv = buildCvPrompt({ ...input, brief: MOCK_BRIEF });
    expect(cv).toContain(resumeText);

    for (const build of [buildEmailPrompt, buildCoverLetterPrompt, buildInterviewPrompt]) {
      const full = build(input);
      const briefed = build({ ...input, brief: MOCK_BRIEF });
      expect(full).toContain(resumeText);
      expect(briefed).not.toContain(resumeText);
      expect(briefed.length).toBeLessThan(full.length / 2);
      expect(briefed).toContain("Reduzi o tempo de deploy em 40%");
      expect(briefed).toContain(MOCK_BRIEF.profile.fullName);
    }
  });

  it("mede o caso típico em caracteres/4", () => {
    const full = {
      cv: tokens(CV_SYSTEM) + tokens(buildCvPrompt(input)),
      email: tokens(EMAIL_SYSTEM) + tokens(buildEmailPrompt(input)),
      cover: tokens(COVER_LETTER_SYSTEM) + tokens(buildCoverLetterPrompt(input)),
      interview: tokens(INTERVIEW_SYSTEM) + tokens(buildInterviewPrompt(input)),
      web: tokens(WEB_SALARY_SYSTEM) + tokens(buildWebSalaryPrompt({ title: "desenvolvedor full stack", jobDescription })),
    };
    const briefed = {
      brief: tokens(BRIEF_SYSTEM) + tokens(buildBriefPrompt(input)),
      cv: tokens(CV_SYSTEM) + tokens(buildCvPrompt(input)),
      email: tokens(EMAIL_SYSTEM) + tokens(buildEmailPrompt({ ...input, brief: MOCK_BRIEF })),
      cover: tokens(COVER_LETTER_SYSTEM) + tokens(buildCoverLetterPrompt({ ...input, brief: MOCK_BRIEF })),
      interview: tokens(INTERVIEW_SYSTEM) + tokens(buildInterviewPrompt({ ...input, brief: MOCK_BRIEF })),
    };
    expect(full).toEqual({ cv: 3289, email: 3200, cover: 3205, interview: 2517, web: 797 });
    expect(briefed).toEqual({ brief: 2405, cv: 3289, email: 1257, cover: 1262, interview: 574 });
    expect(briefed.brief + briefed.cv + briefed.email + briefed.cover + briefed.interview).toBeLessThan(
      full.cv + full.email + full.cover + full.interview,
    );
  });
});
