import "server-only";

import type { z } from "zod";

import { clientIp, rateLimit } from "./rate-limit";

/** Respostas de erro genéricas: nunca ecoam o body, a chave ou detalhes internos. */
export function jsonError(status: number, code: string, message: string, extraHeaders?: HeadersInit): Response {
  return Response.json({ error: { code, message } }, { status, headers: { "Cache-Control": "no-store", ...extraHeaders } });
}

export function jsonOk(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, { ...init, headers: { "Cache-Control": "no-store", ...init?.headers } });
}

export function checkRateLimit(req: Request, route: string, limit: number, windowMs = 60_000): Response | null {
  const { ok, retryAfterSec } = rateLimit(`${route}:${clientIp(req)}`, limit, windowMs);
  return ok
    ? null
    : jsonError(429, "rate_limited", "Muitas requisições. Tente de novo em instantes.", {
        "Retry-After": String(retryAfterSec),
      });
}

/**
 * Lê e valida um JSON com limite de tamanho. Em caso de erro, devolve só
 * os caminhos dos campos inválidos (nunca os valores, que podem conter a chave).
 */
export async function readJson<T extends z.ZodType>(
  req: Request,
  schema: T,
  maxBytes = 200_000,
): Promise<{ ok: true; data: z.infer<T> } | { ok: false; response: Response }> {
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > maxBytes) return { ok: false, response: jsonError(413, "payload_too_large", "Conteúdo grande demais.") };

  let body: unknown;
  try {
    const text = await req.text();
    if (text.length > maxBytes) return { ok: false, response: jsonError(413, "payload_too_large", "Conteúdo grande demais.") };
    body = JSON.parse(text);
  } catch {
    return { ok: false, response: jsonError(400, "invalid_json", "JSON inválido.") };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
    return {
      ok: false,
      response: Response.json(
        { error: { code: "invalid_request", message: "Dados inválidos.", fields } },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      ),
    };
  }
  return { ok: true, data: parsed.data };
}

