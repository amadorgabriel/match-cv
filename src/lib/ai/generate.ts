import "server-only";

import { generateText, Output } from "ai";
import type { z } from "zod";

import { buildModel } from "@/lib/ai/providers";
import { MOCK_OUTPUTS } from "@/lib/mock/outputs";
import {
  type Artifact,
  type ArtifactOutput,
  ArtifactSchemas,
  type GenerateResponse,
  type ValidationReport,
} from "@/lib/schemas/outputs";
import type { GenerateRequest } from "@/lib/schemas/requests";
import { humanize, type Violation, violationsToPrompt } from "@/lib/text/humanize-validator";
import { PROMPTS } from "@/prompts";

/** Extrai o texto principal de cada artefato para o validador anti-IA. */
function humanizableText(artifact: Artifact, data: ArtifactOutput[Artifact]): string {
  switch (artifact) {
    case "cv": {
      const cv = data as ArtifactOutput["cv"];
      return [cv.summary, ...cv.experience.flatMap((e) => e.bullets)].join("\n");
    }
    case "email": {
      const email = data as ArtifactOutput["email"];
      return `${email.subject}\n${email.body}`;
    }
    case "cover-letter":
      return (data as ArtifactOutput["cover-letter"]).body;
    default:
      return "";
  }
}

/** Aplica autoFix nos campos de texto e devolve o relatório. */
function applyHumanizer<A extends Artifact>(
  artifact: A,
  data: ArtifactOutput[A],
  maxWords?: number,
): { data: ArtifactOutput[A]; report: ValidationReport } {
  let autoFixed = false;
  const fix = (s: string) => {
    const r = humanize(s);
    if (r.autoFixed) autoFixed = true;
    return r.text;
  };

  let fixedData: ArtifactOutput[Artifact] = data;
  if (artifact === "cv") {
    const cv = data as ArtifactOutput["cv"];
    fixedData = {
      ...cv,
      summary: fix(cv.summary),
      experience: cv.experience.map((e) => ({ ...e, bullets: e.bullets.map(fix) })),
    };
  } else if (artifact === "email") {
    const email = data as ArtifactOutput["email"];
    fixedData = { subject: fix(email.subject), body: fix(email.body) };
  } else if (artifact === "cover-letter") {
    fixedData = { body: fix((data as ArtifactOutput["cover-letter"]).body) };
  }

  const violations: Violation[] = humanize(humanizableText(artifact, fixedData), { maxWords }).violations;
  return {
    data: fixedData as ArtifactOutput[A],
    report: { ok: violations.length === 0, autoFixed, violations },
  };
}

/**
 * Gera um artefato. Com a IA desligada, devolve o mock (já passando pelo
 * validador). Com MATCHCV_ENABLE_AI=true, chama o modelo do usuário.
 *
 * O perfil compartilhado, quando vem no request, alimenta e-mail, carta e entrevista.
 * O CV continua com o texto bruto. Não há cache de prompt nem fusão de artefatos.
 */
export async function generateArtifact<A extends Artifact>(
  artifact: A,
  input: GenerateRequest,
  options: { realAi: boolean; abortSignal?: AbortSignal },
): Promise<GenerateResponse<A>> {
  const prompt = PROMPTS[artifact];

  if (!options.realAi) {
    const base = MOCK_OUTPUTS[artifact];
    if (!prompt.humanize) return { artifact, data: base, mock: true, promptVersion: prompt.version };
    const { data, report } = applyHumanizer(artifact, base, prompt.maxWords);
    return { artifact, data, validation: report, mock: true, promptVersion: prompt.version };
  }

  // Provider criado aqui, por request, com a chave do usuário.
  const model = buildModel(input.provider, input.model, input.apiKey);
  // Cada artefato tem o próprio schema; o cast liga o schema ao tipo de saída de A.
  const schema = ArtifactSchemas[artifact] as unknown as z.ZodType<ArtifactOutput[A]>;
  const userPrompt = prompt.build(input);

  const run = async (extra?: string) => {
    const { output } = await generateText({
      model,
      system: prompt.system,
      prompt: extra ? `${userPrompt}\n\nREESCREVA CORRIGINDO ESTES PROBLEMAS:\n${extra}` : userPrompt,
      output: Output.object({ schema }),
      maxOutputTokens: prompt.maxOutputTokens,
      maxRetries: 1,
      abortSignal: options.abortSignal,
    });
    return output;
  };

  let raw = await run();
  if (!prompt.humanize) return { artifact, data: raw, mock: false, promptVersion: prompt.version };

  let result = applyHumanizer(artifact, raw, prompt.maxWords);
  if (!result.report.ok) {
    // 1 regeneração com a lista de violações (seção 8 do escopo)
    raw = await run(violationsToPrompt(result.report.violations));
    result = applyHumanizer(artifact, raw, prompt.maxWords);
  }
  return { artifact, data: result.data, validation: result.report, mock: false, promptVersion: prompt.version };
}
