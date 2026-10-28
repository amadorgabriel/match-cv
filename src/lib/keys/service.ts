import "server-only";

import { isProviderId, type ProviderId } from "@/lib/ai/catalog";
import { validateProviderKey } from "@/lib/ai/validate-provider-key";
import { decryptSecret, encryptSecret, EnvelopeError, logKeyAudit } from "@/lib/security/envelope-encryption";

import { toKeyMetadata, type KeyMetadata, type StoredApiKey } from "./types";

export class SavedKeyError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
    this.name = "SavedKeyError";
  }
}

export function buildStoredKey(userId: string, provider: ProviderId, apiKey: string, now = new Date()): StoredApiKey {
  const { envelope, last4 } = encryptSecret(apiKey.trim(), { purpose: "data" });
  const iso = now.toISOString();
  return {
    id: crypto.randomUUID(),
    userId,
    provider,
    last4,
    status: "active",
    envelope,
    createdAt: iso,
    updatedAt: iso,
  };
}

export function readStoredKey(record: StoredApiKey, userId: string): string {
  try {
    const apiKey = decryptSecret(record.envelope);
    logKeyAudit({ action: "key_decrypt", userId, provider: record.provider, last4: record.last4 }, [apiKey]);
    return apiKey;
  } catch (error) {
    if (error instanceof EnvelopeError) throw error;
    throw new EnvelopeError();
  }
}

export async function assertKeyIsValid(provider: string, apiKey: string): Promise<ProviderId> {
  if (!isProviderId(provider)) {
    throw new SavedKeyError("Provedor inválido.", 400, "invalid_provider");
  }
  const result = await validateProviderKey(provider, apiKey);
  if (!result.ok) throw new SavedKeyError(result.message, result.status, result.code);
  return provider;
}

export function metadataOf(record: StoredApiKey): KeyMetadata {
  return toKeyMetadata(record);
}
