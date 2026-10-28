import { isProviderId, type ProviderId } from "@/lib/ai/catalog";
import { clearCookieHeader, readCookie, requestIsSecure, setCookieHeader } from "@/lib/security/cookies";
import { decryptSecret, encryptSecret, type Envelope } from "@/lib/security/envelope-encryption";

import { toKeyMetadata, type KeyMetadata, type StoredApiKey } from "./types";

export const KEY_VAULT_COOKIE = "matchcv_key_vault";
const MAX_AGE = 60 * 60 * 24 * 180;

export function readVault(cookieHeader: string | null): { records: StoredApiKey[]; invalid: boolean } {
  const raw = readCookie(cookieHeader, KEY_VAULT_COOKIE);
  if (!raw) return { records: [], invalid: false };
  try {
    const envelope = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Envelope;
    const json = decryptSecret(envelope);
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return { records: [], invalid: true };
    const records = parsed.filter(isStoredKey);
    return { records, invalid: records.length !== parsed.length };
  } catch {
    return { records: [], invalid: true };
  }
}

export function sealVault(records: StoredApiKey[]): string {
  const { envelope } = encryptSecret(JSON.stringify(records), { purpose: "vault" });
  return Buffer.from(JSON.stringify(envelope), "utf8").toString("base64url");
}

function isStoredKey(value: unknown): value is StoredApiKey {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<StoredApiKey>;
  return Boolean(record.id && record.provider && isProviderId(record.provider) && record.envelope && record.last4);
}

/** Cofre em memória de um request. A resposta só ganha Set-Cookie quando muda. */
export class CookieKeyVault {
  private records: StoredApiKey[];
  private dirty: boolean;

  constructor(cookieHeader: string | null) {
    const read = readVault(cookieHeader);
    this.records = read.records;
    this.dirty = read.invalid;
  }

  list(): KeyMetadata[] {
    return this.records.map(toKeyMetadata);
  }

  recordsForMigration(): StoredApiKey[] {
    return [...this.records];
  }

  find(provider: ProviderId): StoredApiKey | null {
    return this.records.find((record) => record.provider === provider && record.status === "active") ?? null;
  }

  upsert(record: StoredApiKey): void {
    this.records = this.records.filter((item) => item.provider !== record.provider);
    this.records.push(record);
    this.dirty = true;
  }

  remove(selector: { id?: string; provider?: string }): StoredApiKey | null {
    const index = this.records.findIndex((record) => (selector.id ? record.id === selector.id : record.provider === selector.provider));
    if (index < 0) return null;
    const [removed] = this.records.splice(index, 1);
    this.dirty = true;
    return removed ?? null;
  }

  markInvalid(id: string): void {
    const record = this.records.find((item) => item.id === id);
    if (!record || record.status === "invalid") return;
    record.status = "invalid";
    this.dirty = true;
  }

  clear(): void {
    if (this.records.length === 0 && !this.dirty) return;
    this.records = [];
    this.dirty = true;
  }

  setCookie(req: Request): string | null {
    if (!this.dirty) return null;
    const secure = requestIsSecure(req);
    if (this.records.length === 0) return clearCookieHeader(KEY_VAULT_COOKIE, secure);
    return setCookieHeader(KEY_VAULT_COOKIE, sealVault(this.records), { maxAge: MAX_AGE, secure });
  }
}
