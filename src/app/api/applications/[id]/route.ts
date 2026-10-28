import { createPostgresApplicationRepository } from "@/lib/applications/postgres";
import { ApplicationStoreError, UpdateApplicationSchema } from "@/lib/applications/types";
import { readAuthUser } from "@/lib/auth/server";
import { getDb } from "@/lib/db";
import { checkRateLimit, jsonError, jsonOk, readJson } from "@/lib/security/http";
import { logApiError } from "@/lib/security/redact";

async function open(req: Request) {
  const user = await readAuthUser(req);
  const db = getDb();
  if (!user || !db) {
    return {
      ok: false as const,
      response: jsonError(401, "anonymous", "No modo anônimo as candidaturas ficam neste navegador."),
    };
  }
  return { ok: true as const, userId: user.id, repo: createPostgresApplicationRepository(db) };
}

function fromStore(error: unknown): Response | null {
  if (!(error instanceof ApplicationStoreError)) return null;
  const status = error.code === "not_found" ? 404 : 400;
  return jsonError(status, error.code, error.message);
}

export async function GET(req: Request, ctx: RouteContext<"/api/applications/[id]">) {
  const limited = await checkRateLimit(req, "applications", 30);
  if (limited) return limited;
  const opened = await open(req);
  if (!opened.ok) return opened.response;
  const { id } = await ctx.params;
  const application = await opened.repo.get(opened.userId, id);
  if (!application) return jsonError(404, "not_found", "Candidatura não encontrada.");
  return jsonOk({ application });
}

export async function PATCH(req: Request, ctx: RouteContext<"/api/applications/[id]">) {
  const limited = await checkRateLimit(req, "applications", 30);
  if (limited) return limited;
  const opened = await open(req);
  if (!opened.ok) return opened.response;
  const parsed = await readJson(req, UpdateApplicationSchema, 1_000_000);
  if (!parsed.ok) return parsed.response;
  const { id } = await ctx.params;
  try {
    const application = await opened.repo.update(opened.userId, id, parsed.data);
    return jsonOk({ application });
  } catch (error) {
    const response = fromStore(error);
    if (response) return response;
    await logApiError({ route: "/api/applications/[id]", error, statusCode: 500 });
    return jsonError(500, "applications_error", "Não foi possível atualizar a candidatura.");
  }
}

export async function DELETE(req: Request, ctx: RouteContext<"/api/applications/[id]">) {
  const limited = await checkRateLimit(req, "applications", 30);
  if (limited) return limited;
  const opened = await open(req);
  if (!opened.ok) return opened.response;
  const { id } = await ctx.params;
  const removed = await opened.repo.delete(opened.userId, id);
  if (!removed) return jsonError(404, "not_found", "Candidatura não encontrada.");
  return jsonOk({ ok: true });
}
