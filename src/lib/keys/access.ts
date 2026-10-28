import "server-only";

import type { ProviderId } from "@/lib/ai/catalog";
import { isDatabaseConfigured } from "@/lib/auth/env";
import { readAuthUser } from "@/lib/auth/server";
import { getDb } from "@/lib/db";
import {
  assertKeyIsValid,
  buildStoredKey,
  metadataOf,
  readStoredKey,
  SavedKeyError,
} from "@/lib/keys/service";
import { copyVaultKeys, deleteStoredKey, listStoredKeys, markStoredKeyInvalid, upsertStoredKey } from "@/lib/keys/postgres";
import { CookieKeyVault } from "@/lib/keys/vault";
import { EnvelopeError, logKeyAudit } from "@/lib/security/envelope-encryption";
import { logApiWarning } from "@/lib/security/redact";

import type { KeyMetadata, StoredApiKey } from "./types";

export interface KeyAccess {
  userId: string;
  source: "database" | "vault";
  list(): Promise<KeyMetadata[]>;
  save(provider: string, apiKey: string): Promise<KeyMetadata>;
  remove(selector: { id?: string; provider?: string }): Promise<KeyMetadata | null>;
  decrypt(provider: ProviderId): Promise<string>;
  cookies(req: Request): string[];
}

function cookieList(vault: CookieKeyVault, req: Request): string[] {
  const cookie = vault.setCookie(req);
  return cookie ? [cookie] : [];
}

export async function openKeyAccess(req: Request): Promise<KeyAccess> {
  const vault = new CookieKeyVault(req.headers.get("cookie"));
  const user = isDatabaseConfigured() ? await readAuthUser(req) : null;
  const db = user ? getDb() : null;
  if (user && db) {
    try {
      const stored = await listStoredKeys(db, user.id);
      const known = new Set(stored.map((record) => record.provider));
      const incoming = vault.recordsForMigration().filter((record) => !known.has(record.provider));
      if (incoming.length > 0) {
        await copyVaultKeys(db, user.id, incoming);
        vault.clear();
      }
      return databaseAccess(db, user.id, vault);
    } catch (error) {
      logApiWarning(`chave no banco indisponível: ${error instanceof Error ? error.message : "erro"}`);
    }
  }
  return vaultAccess(vault);
}

function databaseAccess(db: NonNullable<ReturnType<typeof getDb>>, userId: string, vault: CookieKeyVault): KeyAccess {
  return {
    userId,
    source: "database",
    async list() {
      return (await listStoredKeys(db, userId)).map(metadataOf);
    },
    async save(provider, apiKey) {
      const valid = await assertKeyIsValid(provider, apiKey);
      const record = buildStoredKey(userId, valid, apiKey);
      await upsertStoredKey(db, record);
      logKeyAudit({ action: "key_save", userId, provider: record.provider, last4: record.last4 }, [apiKey]);
      return metadataOf(record);
    },
    async remove(selector) {
      const removed = await deleteStoredKey(db, userId, selector);
      if (!removed) return null;
      logKeyAudit({ action: "key_delete", userId, provider: removed.provider, last4: removed.last4 });
      return metadataOf(removed);
    },
    async decrypt(provider) {
      const record = (await listStoredKeys(db, userId)).find((item) => item.provider === provider && item.status === "active");
      if (!record) throw new SavedKeyError("Não há chave salva para este provedor.", 404, "saved_key_missing");
      return decryptRecord(record, userId, async () => {
        await markStoredKeyInvalid(db, userId, record.id);
      });
    },
    cookies(req) {
      return cookieList(vault, req);
    },
  };
}

function vaultAccess(vault: CookieKeyVault): KeyAccess {
  const userId = "local";
  return {
    userId,
    source: "vault",
    async list() {
      return vault.list();
    },
    async save(provider, apiKey) {
      const valid = await assertKeyIsValid(provider, apiKey);
      const record = buildStoredKey(userId, valid, apiKey);
      vault.upsert(record);
      logKeyAudit({ action: "key_save", userId, provider: record.provider, last4: record.last4 }, [apiKey]);
      return metadataOf(record);
    },
    async remove(selector) {
      const removed = vault.remove(selector);
      if (!removed) return null;
      logKeyAudit({ action: "key_delete", userId, provider: removed.provider, last4: removed.last4 });
      return metadataOf(removed);
    },
    async decrypt(provider) {
      const record = vault.find(provider);
      if (!record) throw new SavedKeyError("Não há chave salva para este provedor.", 404, "saved_key_missing");
      return decryptRecord(record, userId, async () => {
        vault.markInvalid(record.id);
      });
    },
    cookies(req) {
      return cookieList(vault, req);
    },
  };
}

async function decryptRecord(record: StoredApiKey, userId: string, markInvalid: () => Promise<void>): Promise<string> {
  try {
    return readStoredKey(record, userId);
  } catch (error) {
    if (error instanceof EnvelopeError) {
      await markInvalid();
      throw new SavedKeyError("A chave salva não pôde ser lida. Salve de novo.", 409, "saved_key_invalid");
    }
    throw error;
  }
}
