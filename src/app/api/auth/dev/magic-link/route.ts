import { readDevMagicLink } from "@/lib/auth/dev-magic-link";
import { checkRateLimit, jsonError, jsonOk } from "@/lib/security/http";

/** Só existe fora de produção, para testar o magic link sem provedor de e-mail. */
export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") return jsonError(404, "not_found", "Não encontrado.");
  const limited = await checkRateLimit(req, "auth-dev-link", 20);
  if (limited) return limited;
  const email = new URL(req.url).searchParams.get("email")?.trim().toLowerCase();
  if (!email) return jsonError(400, "invalid_request", "Informe o e-mail.");
  const link = readDevMagicLink(email);
  if (!link) return jsonError(404, "not_found", "Nenhum link pendente para este e-mail.");
  return jsonOk(link);
}
