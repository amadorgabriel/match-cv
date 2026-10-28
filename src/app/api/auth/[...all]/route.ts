import { getAuth } from "@/lib/auth/server";
import { checkRateLimit, jsonError, jsonOk } from "@/lib/security/http";
import { toNextJsHandler } from "better-auth/next-js";

async function disabled(req: Request) {
  const url = new URL(req.url);
  if (req.method === "GET" && (url.pathname.endsWith("/get-session") || url.pathname.endsWith("/ok"))) {
    return jsonOk({ user: null, session: null, mode: "anonymous" });
  }
  return jsonError(503, "auth_disabled", "Login desligado neste ambiente. O modo anônimo continua disponível.");
}

async function handle(req: Request) {
  const limited = await checkRateLimit(req, "auth", 30);
  if (limited) return limited;
  const auth = await getAuth();
  if (!auth) return disabled(req);
  const handlers = toNextJsHandler(auth);
  if (req.method === "GET") return handlers.GET(req);
  if (req.method === "POST") return handlers.POST(req);
  if (req.method === "PATCH") return handlers.PATCH(req);
  if (req.method === "PUT") return handlers.PUT(req);
  if (req.method === "DELETE") return handlers.DELETE(req);
  return jsonError(405, "method_not_allowed", "Método não suportado.");
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
