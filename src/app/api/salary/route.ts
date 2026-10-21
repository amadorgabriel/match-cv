import { isRealAiEnabled } from "@/lib/ai/flags";
import { providerRateLimitMessage } from "@/lib/ai/provider-error";
import { lookupSalary, SalaryRateLimitError } from "@/lib/salary/search";
import type { Salary } from "@/lib/schemas/outputs";
import { SalaryRequestSchema } from "@/lib/schemas/requests";
import { checkRateLimit, jsonError, jsonOk, readJson } from "@/lib/security/http";

// Runtime Node.js (padrão do Next 16; o export `runtime` não é compatível com cacheComponents).
export const maxDuration = 60;

function unavailable(jobTitle: string): Salary {
  return {
    currency: "BRL",
    period: "month",
    available: false,
    query: { jobTitle },
    tried: ["A consulta falhou antes de devolver números."],
    isEstimate: true,
    isMock: false,
    sources: [],
    disclaimer: "Faixa não disponível para este cargo com as fontes consultadas.",
  };
}

/**
 * POST /api/salary
 * Cruza a Adzuna (chave do servidor) com a busca na web do provedor do usuário.
 * Sem número, responde 200 com "faixa não disponível". 429 do provedor sobe como 429.
 */
export async function POST(req: Request) {
  const limited = checkRateLimit(req, "salary", 5);
  if (limited) return limited;

  const parsed = await readJson(req, SalaryRequestSchema, 40_000);
  if (!parsed.ok) return parsed.response;

  try {
    const salary = await lookupSalary({ ...parsed.data, realAi: isRealAiEnabled(), signal: req.signal });
    return jsonOk(salary);
  } catch (err) {
    if (err instanceof SalaryRateLimitError) {
      return jsonError(429, "provider_rate_limited", providerRateLimitMessage(err.retryAfterSec), {
        "Retry-After": String(err.retryAfterSec),
      });
    }
    // Não logar `err` inteiro: a busca na web pode carregar a chave na mensagem.
    console.error(`[salary] falhou: ${err instanceof Error ? err.name : "erro"}`);
    return jsonOk(unavailable(parsed.data.jobTitle ?? "cargo da vaga"));
  }
}
