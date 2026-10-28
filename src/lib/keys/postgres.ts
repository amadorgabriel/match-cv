import "server-only";

import { and, eq } from "drizzle-orm";

import { isProviderId, type ProviderId } from "@/lib/ai/catalog";
import type { Database } from "@/lib/db";
import { savedApiKeys } from "@/lib/db/schema";
import { ENVELOPE_ALGORITHM, type Envelope } from "@/lib/security/envelope-encryption";

import type { StoredApiKey } from "./types";

function toRecord(row: typeof savedApiKeys.$inferSelect): StoredApiKey | null {
  if (!isProviderId(row.provider)) return null;
  const envelope: Envelope = {
    algorithm: ENVELOPE_ALGORITHM,
    purpose: "data",
    kekVersion: row.kekVersion,
    iv: row.iv,
    authTag: row.authTag,
    ciphertext: row.ciphertext,
    wrappedDek: {
      iv: row.wrappedDekIv,
      authTag: row.wrappedDekAuthTag,
      ciphertext: row.wrappedDekCiphertext,
    },
  };
  return {
    id: row.id,
    userId: row.userId,
    provider: row.provider,
    last4: row.last4,
    status: row.status === "invalid" ? "invalid" : "active",
    envelope,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listStoredKeys(db: Database, userId: string): Promise<StoredApiKey[]> {
  const rows = await db.select().from(savedApiKeys).where(eq(savedApiKeys.userId, userId));
  return rows.flatMap((row) => {
    const record = toRecord(row);
    return record ? [record] : [];
  });
}

export async function upsertStoredKey(db: Database, record: StoredApiKey): Promise<void> {
  const values = {
    id: record.id,
    userId: record.userId,
    provider: record.provider,
    last4: record.last4,
    status: record.status,
    kekVersion: record.envelope.kekVersion,
    iv: record.envelope.iv,
    authTag: record.envelope.authTag,
    ciphertext: record.envelope.ciphertext,
    wrappedDekIv: record.envelope.wrappedDek.iv,
    wrappedDekAuthTag: record.envelope.wrappedDek.authTag,
    wrappedDekCiphertext: record.envelope.wrappedDek.ciphertext,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
  await db
    .insert(savedApiKeys)
    .values(values)
    .onConflictDoUpdate({
      target: [savedApiKeys.userId, savedApiKeys.provider],
      set: {
        id: values.id,
        last4: values.last4,
        status: values.status,
        kekVersion: values.kekVersion,
        iv: values.iv,
        authTag: values.authTag,
        ciphertext: values.ciphertext,
        wrappedDekIv: values.wrappedDekIv,
        wrappedDekAuthTag: values.wrappedDekAuthTag,
        wrappedDekCiphertext: values.wrappedDekCiphertext,
        updatedAt: values.updatedAt,
      },
    });
}

export async function deleteStoredKey(
  db: Database,
  userId: string,
  selector: { id?: string; provider?: string },
): Promise<StoredApiKey | null> {
  const where = selector.id
    ? and(eq(savedApiKeys.userId, userId), eq(savedApiKeys.id, selector.id))
    : selector.provider
      ? and(eq(savedApiKeys.userId, userId), eq(savedApiKeys.provider, selector.provider))
      : null;
  if (!where) return null;
  const [row] = await db.delete(savedApiKeys).where(where).returning();
  return row ? toRecord(row) : null;
}

export async function markStoredKeyInvalid(db: Database, userId: string, id: string): Promise<void> {
  await db
    .update(savedApiKeys)
    .set({ status: "invalid", updatedAt: new Date() })
    .where(and(eq(savedApiKeys.userId, userId), eq(savedApiKeys.id, id)));
}

export async function copyVaultKeys(db: Database, userId: string, records: StoredApiKey[]): Promise<void> {
  for (const record of records) {
    await upsertStoredKey(db, { ...record, userId, id: record.id });
  }
}

export function providerOf(value: string): ProviderId | null {
  return isProviderId(value) ? value : null;
}
