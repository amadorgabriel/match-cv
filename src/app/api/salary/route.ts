import { fetchSalaryRange, guessJobTitle } from "@/lib/salary/adzuna";
import { SalaryRequestSchema } from "@/lib/schemas/requests";
import { checkRateLimit, jsonError, jsonOk, readJson } from "@/lib/security/http";

// Runtime Node.js (padrão do Next 16; o export `runtime` não é compatível com cacheComponents).

/**
 * POST /api/salary  { jobTitle?, location?, jobDescription? }
 * Consulta a Adzuna com a chave do SERVIDOR (env). Sem env, devolve exemplo.
 * Rate limit mais apertado porque a cota da Adzuna é sua.
 */
export async function POST(req: Request) {
  const limited = checkRateLimit(req, "salary", 5);
  if (limited) return limited;

  const parsed = await readJson(req, SalaryRequestSchema, 40_000);
  if (!parsed.ok) return parsed.response;

  const jobTitle = parsed.data.jobTitle ?? guessJobTitle(parsed.data.jobDescription ?? "");
  try {
    const salary = await fetchSalaryRange({ jobTitle, location: parsed.data.location });
    return jsonOk(salary);
  } catch (err) {
    const code = err instanceof Error && err.message === "adzuna_no_data" ? "no_data" : "salary_failed";
    return jsonError(502, code, code === "no_data" ? "Sem dados suficientes para esse cargo." : "Não foi possível consultar a faixa salarial.");
  }
}
