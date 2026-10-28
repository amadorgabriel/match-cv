import "server-only";

import { isAuthConfigured } from "@/lib/auth/env";
import { logApiWarning } from "@/lib/security/redact";

import type { AuthInstance } from "./instance";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  image: string | null;
}

let authPromise: Promise<AuthInstance> | null = null;

export async function getAuth(): Promise<AuthInstance | null> {
  if (!isAuthConfigured()) return null;
  try {
    authPromise ??= import("./instance").then((mod) => mod.createAuth());
    return await authPromise;
  } catch (error) {
    authPromise = null;
    logApiWarning(`auth indisponível: ${error instanceof Error ? error.message : "erro"}`);
    return null;
  }
}

export async function readAuthUser(req: Request): Promise<AuthUser | null> {
  try {
    const auth = await getAuth();
    if (!auth) return null;
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id || !session.user.email) return null;
    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      image: session.user.image ?? null,
    };
  } catch (error) {
    logApiWarning(`sessão indisponível: ${error instanceof Error ? error.message : "erro"}`);
    return null;
  }
}
