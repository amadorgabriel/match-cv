import { createPostgresApplicationRepository } from "@/lib/applications/postgres";
import { filterApplications } from "@/lib/applications/store";
import { APPLICATION_STATUSES, ApplicationStoreError, CreateApplicationSchema, type ApplicationStatus } from "@/lib/applications/types";
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

export async function GET(req: Request) {
  const limited = await checkRateLimit(req, "applications", 30);
  if (limited) return limited;
  const opened = await open(req);
  if (!opened.ok) return opened.response;
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  if (status && !(APPLICATION_STATUSES as readonly string[]).includes(status)) {
    return jsonError(400, "invalid_status", "Status inválido.");
  }
  try {
    const applications = filterApplications(await opened.repo.list(opened.userId), {
      status: (status as ApplicationStatus | null) || undefined,
      query: url.searchParams.get("q") ?? undefined,
    });
    return jsonOk({ applications });
  } catch (error) {
    const response = fromStore(error);
    if (response) return response;
    await logApiError({ route: "/api/applications", error, statusCode: 500 });
    return jsonError(500, "applications_error", "Não foi possível listar as candidaturas.");
  }
}

export async function POST(req: Request) {
  const limited = await checkRateLimit(req, "applications", 30);
  if (limited) return limited;
  const opened = await open(req);
  if (!opened.ok) return opened.response;
  const parsed = await readJson(req, CreateApplicationSchema, 1_000_000);
  if (!parsed.ok) return parsed.response;
  try {
    const application = await opened.repo.create(opened.userId, parsed.data);
    return jsonOk({ application }, { status: 201 });
  } catch (error) {
    const response = fromStore(error);
    if (response) return response;
    await logApiError({ route: "/api/applications", error, statusCode: 500 });
    return jsonError(500, "applications_error", "Não foi possível salvar a candidatura.");
  }
}
