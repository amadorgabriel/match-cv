import type { ProviderId } from "@/lib/ai/catalog";
import type { Envelope } from "@/lib/security/envelope-encryption";

export const KEY_STATUSES = ["active", "invalid"] as const;
export type KeyStatus = (typeof KEY_STATUSES)[number];

export interface StoredApiKey {
  id: string;
  userId: string;
  provider: ProviderId;
  last4: string;
  status: KeyStatus;
  envelope: Envelope;
  createdAt: string;
  updatedAt: string;
}

/** O que o navegador pode ver. Nunca inclui ciphertext nem a chave. */
export interface KeyMetadata {
  id: string;
  provider: ProviderId;
  last4: string;
  status: KeyStatus;
  createdAt: string;
  updatedAt: string;
}

export function toKeyMetadata(record: StoredApiKey): KeyMetadata {
  return {
    id: record.id,
    provider: record.provider,
    last4: record.last4,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
