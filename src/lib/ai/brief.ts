import "server-only";

import { generateText, Output } from "ai";

import { MOCK_BRIEF } from "@/lib/mock/brief";
import { BriefSchema, type Brief } from "@/lib/schemas/brief";
import type { GenerateRequest } from "@/lib/schemas/requests";
import { BRIEF_MAX_OUTPUT_TOKENS, BRIEF_PROMPT_VERSION, BRIEF_SYSTEM, buildBriefPrompt } from "@/prompts/brief";

import { buildModel } from "./providers";

/**
 * Extrai perfil e vaga uma vez por fluxo. O resultado volta para o navegador
 * e fica só na memória do cliente. Esta função não grava nada.
 */
export async function generateBrief(
  input: GenerateRequest,
  options: { realAi: boolean; abortSignal?: AbortSignal },
): Promise<{ brief: Brief; mock: boolean; promptVersion: string }> {
  if (!options.realAi) return { brief: MOCK_BRIEF, mock: true, promptVersion: BRIEF_PROMPT_VERSION };

  const model = buildModel(input.provider, input.model, input.apiKey);
  const { output } = await generateText({
    model,
    system: BRIEF_SYSTEM,
    prompt: buildBriefPrompt(input),
    output: Output.object({ schema: BriefSchema }),
    maxOutputTokens: BRIEF_MAX_OUTPUT_TOKENS,
    maxRetries: 1,
    abortSignal: options.abortSignal,
  });
  return { brief: output, mock: false, promptVersion: BRIEF_PROMPT_VERSION };
}
