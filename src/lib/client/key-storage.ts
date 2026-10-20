/**
 * "Lembrar nesta aba": guarda a chave em sessionStorage, que some ao fechar
 * a aba. NUNCA usar localStorage (persiste depois de fechar o navegador).
 */
const STORAGE_KEY = "matchcv:session-key";

export interface StoredKey {
  provider: string;
  model: string;
  apiKey: string;
}

export function readStoredKey(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function parseStoredKey(raw: string | null): StoredKey | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<StoredKey>;
    return v.apiKey && v.provider && v.model ? (v as StoredKey) : null;
  } catch {
    return null;
  }
}

export function saveStoredKey(value: StoredKey): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // modo privado ou storage bloqueado: segue só em memória
  }
}

export function clearStoredKey(): void {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Para useSyncExternalStore: o valor não muda sozinho dentro da aba. */
export function subscribeNoop(): () => void {
  return () => {};
}
