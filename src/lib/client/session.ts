import { isSessionId } from "@/lib/ai/telemetry-context";

/** Identificador anônimo desta aba. Não é a chave de API e some ao fechar a aba. */
const STORAGE_KEY = "matchcv:anon-session";

export function anonymousSessionId(): string {
  if (typeof window === "undefined") return "none";
  try {
    const existing = window.sessionStorage.getItem(STORAGE_KEY);
    if (existing && isSessionId(existing)) return existing;
    const id = crypto.randomUUID();
    window.sessionStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    return "none";
  }
}
