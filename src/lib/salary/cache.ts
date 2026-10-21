/** Cache curto em memória. A chave nunca entra na chave do cache. */

const TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 50;
const store = new Map<string, { at: number; value: string }>();

export function salaryCacheKey(parts: Array<string | undefined>): string {
  return parts.map((part) => (part ?? "").trim().toLowerCase()).join("\u001f");
}

export function readSalaryCache(key: string, now = Date.now()): string | undefined {
  const hit = store.get(key);
  if (!hit) return undefined;
  if (now - hit.at > TTL_MS) {
    store.delete(key);
    return undefined;
  }
  return hit.value;
}

export function writeSalaryCache(key: string, value: string, now = Date.now()): void {
  store.set(key, { at: now, value });
  if (store.size <= MAX_ENTRIES) return;
  const oldest = store.keys().next().value;
  if (oldest) store.delete(oldest);
}

export function clearSalaryCache(): void {
  store.clear();
}
