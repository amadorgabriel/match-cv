import type { Artifact } from "@/lib/schemas/outputs";

import { buildCoverLetterPrompt, COVER_LETTER_PROMPT_VERSION, COVER_LETTER_SYSTEM } from "./cover-letter";
import { buildCvPrompt, CV_PROMPT_VERSION, CV_SYSTEM } from "./cv";
import { buildEmailPrompt, EMAIL_PROMPT_VERSION, EMAIL_SYSTEM } from "./email";
import { buildInterviewPrompt, INTERVIEW_PROMPT_VERSION, INTERVIEW_SYSTEM } from "./interview";
import type { PromptInput } from "./types";

export interface PromptDefinition {
  version: string;
  system: string;
  build: (input: PromptInput) => string;
  /** Teto de saída, folgado para o JSON do artefato não ser cortado no meio. */
  maxOutputTokens: number;
  /** Limite de palavras checado pelo validador (texto principal). */
  maxWords?: number;
  /** Se o validador anti-IA roda sobre a saída. */
  humanize: boolean;
}

export const PROMPTS: Record<Artifact, PromptDefinition> = {
  cv: { version: CV_PROMPT_VERSION, system: CV_SYSTEM, build: buildCvPrompt, maxOutputTokens: 8000, humanize: true },
  email: {
    version: EMAIL_PROMPT_VERSION,
    system: EMAIL_SYSTEM,
    build: buildEmailPrompt,
    maxOutputTokens: 1500,
    maxWords: 170,
    humanize: true,
  },
  "cover-letter": {
    version: COVER_LETTER_PROMPT_VERSION,
    system: COVER_LETTER_SYSTEM,
    build: buildCoverLetterPrompt,
    maxOutputTokens: 2500,
    maxWords: 380,
    humanize: true,
  },
  interview: {
    version: INTERVIEW_PROMPT_VERSION,
    system: INTERVIEW_SYSTEM,
    build: buildInterviewPrompt,
    maxOutputTokens: 6000,
    humanize: false,
  },
};

export type { PromptInput };
