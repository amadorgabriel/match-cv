import { isRealAiEnabled } from "@/lib/ai/flags";
import { generateArtifact } from "@/lib/ai/generate";
import { ProviderConfigError } from "@/lib/ai/providers";
import { ARTIFACTS, type Artifact } from "@/lib/schemas/outputs";
import { GenerateRequestSchema } from "@/lib/schemas/requests";
import { checkRateLimit, jsonError, jsonOk, readJson } from "@/lib/security/http";

// Runtime Node.js (padrão do Next 16; o export `runtime` não é compatível com cacheComponents).
export const maxDuration = 120;

function isArtifact(value: string): value is Artifact {
  return (ARTIFACTS as readonly string[]).includes(value);
}

/**
 * POST /api/generate/{cv|email|cover-letter|interview}
 * Body: { provider, model, apiKey, resumeText, jobDescription, achievements? }
 *
 * A chave só existe dentro deste handler: é usada para criar o provider
 * e descartada. Não é logada, persistida nem devolvida.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/generate/[artifact]">) {
  const { artifact } = await ctx.params;
  if (!isArtifact(artifact)) return jsonError(404, "unknown_artifact", "Artefato desconhecido.");

  const limited = checkRateLimit(req, "generate", 30);
  if (limited) return limited;

  const parsed = await readJson(req, GenerateRequestSchema, 120_000);
  if (!parsed.ok) return parsed.response;

  try {
    const result = await generateArtifact(artifact, parsed.data, {
      realAi: isRealAiEnabled(),
      abortSignal: req.signal,
    });
    return jsonOk(result);
  } catch (err) {
    if (err instanceof ProviderConfigError) return jsonError(400, "invalid_provider", "Provedor ou modelo inválido.");
    // Mensagem genérica. Não logar `err` inteiro: pode conter headers com a chave.
    console.error(`[generate:${artifact}] falhou: ${err instanceof Error ? err.name : "erro"}`);
    return jsonError(502, "generation_failed", "A geração falhou. Confira a chave e o modelo e tente de novo.");
  }
}
