import { z } from "zod";

import { PROVIDER_IDS } from "@/lib/ai/catalog";
import { openKeyAccess } from "@/lib/keys/access";
import { SavedKeyError } from "@/lib/keys/service";
import { EnvelopeError } from "@/lib/security/envelope-encryption";
import { LIMITS } from "@/lib/schemas/requests";
import { withSetCookies } from "@/lib/security/cookies";
import { checkRateLimit, jsonError, jsonOk, readJson } from "@/lib/security/http";
import { logApiError } from "@/lib/security/redact";

const SaveKeySchema = z.object({
  provider: z.enum(PROVIDER_IDS),
  apiKey: z.string().trim().min(10, "Chave muito curta").max(LIMITS.maxApiKeyChars),
});

const DeleteKeySchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    provider: z.enum(PROVIDER_IDS).optional(),
  })
  .refine((value) => Boolean(value.id || value.provider), { message: "Informe a chave." });

function fail(error: unknown, cookies: string[]): Response {
  if (error instanceof SavedKeyError) return withSetCookies(jsonError(error.status, error.code, error.message), cookies);
  if (error instanceof EnvelopeError) {
    return withSetCookies(jsonError(503, "encryption_unconfigured", "Configure KEY_ENCRYPTION_SECRET para salvar chaves."), cookies);
  }
  return withSetCookies(jsonError(500, "key_error", "Não foi possível guardar a chave."), cookies);
}

async function readDeleteSelector(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return readJson(req, DeleteKeySchema, 2_000);
  const url = new URL(req.url);
  const parsed = DeleteKeySchema.safeParse({
    id: url.searchParams.get("id") ?? undefined,
    provider: url.searchParams.get("provider") ?? undefined,
  });
  if (!parsed.success) return { ok: false as const, response: jsonError(400, "invalid_request", "Informe a chave.") };
  return { ok: true as const, data: parsed.data };
}

export async function GET(req: Request) {
  const limited = await checkRateLimit(req, "keys", 20);
  if (limited) return limited;
  try {
    const access = await openKeyAccess(req);
    const keys = await access.list();
    return withSetCookies(jsonOk({ keys }), access.cookies(req));
  } catch (error) {
    await logApiError({ route: "/api/keys", error, statusCode: 500 });
    return jsonError(500, "key_error", "Não foi possível listar as chaves.");
  }
}

export async function POST(req: Request) {
  const limited = await checkRateLimit(req, "keys", 20);
  if (limited) return limited;
  const parsed = await readJson(req, SaveKeySchema, 5_000);
  if (!parsed.ok) return parsed.response;
  const access = await openKeyAccess(req);
  try {
    const key = await access.save(parsed.data.provider, parsed.data.apiKey);
    return withSetCookies(jsonOk({ key }, { status: 201 }), access.cookies(req));
  } catch (error) {
    if (!(error instanceof SavedKeyError)) {
      await logApiError({ route: "/api/keys", error, statusCode: 500, provider: parsed.data.provider, secrets: [parsed.data.apiKey] });
    }
    return fail(error, access.cookies(req));
  }
}

export async function DELETE(req: Request) {
  const limited = await checkRateLimit(req, "keys", 20);
  if (limited) return limited;
  const parsed = await readDeleteSelector(req);
  if (!parsed.ok) return parsed.response;
  const access = await openKeyAccess(req);
  try {
    const key = await access.remove(parsed.data);
    if (!key) return withSetCookies(jsonError(404, "not_found", "Chave salva não encontrada."), access.cookies(req));
    return withSetCookies(jsonOk({ key }), access.cookies(req));
  } catch (error) {
    await logApiError({ route: "/api/keys", error, statusCode: 500 });
    return fail(error, access.cookies(req));
  }
}
