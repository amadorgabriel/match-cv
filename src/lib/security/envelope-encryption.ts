import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

import { redactSecrets } from "./secrets";

/** Envelope AES-256-GCM: a API key é cifrada por uma DEK, e a DEK por uma KEK versionada. */
export const ENVELOPE_ALGORITHM = "AES-256-GCM" as const;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const DEK_BYTES = 32;

export type EnvelopePurpose = "data" | "vault";

export interface WrappedDek {
  iv: string;
  authTag: string;
  ciphertext: string;
}

export interface Envelope {
  algorithm: typeof ENVELOPE_ALGORITHM;
  purpose: EnvelopePurpose;
  kekVersion: number;
  iv: string;
  authTag: string;
  ciphertext: string;
  wrappedDek: WrappedDek;
}

export class EnvelopeError extends Error {
  constructor(message = "Não foi possível ler o segredo cifrado.") {
    super(message);
    this.name = "EnvelopeError";
  }
}

export interface KekResolver {
  (version: number): string | undefined;
}

export function secretLast4(value: string): string {
  return value.trim().slice(-4);
}

export function currentKekVersion(env: NodeJS.ProcessEnv = process.env): number {
  const parsed = Number(env.KEY_ENCRYPTION_KEK_VERSION ?? "1");
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1000) return 1;
  return parsed;
}

/**
 * KEK da versão pedida.
 * Ordem: KEY_ENCRYPTION_SECRET_V{n}, segredo atual, segredo anterior, fallback de desenvolvimento.
 */
export function resolveKekSecret(version: number, env: NodeJS.ProcessEnv = process.env): string | undefined {
  const named = env[`KEY_ENCRYPTION_SECRET_V${version}`]?.trim();
  if (named) return named;
  const current = currentKekVersion(env);
  if (version === current) {
    const secret = env.KEY_ENCRYPTION_SECRET?.trim() || env.BETTER_AUTH_SECRET?.trim();
    if (secret) return secret;
    if (env.NODE_ENV !== "production") return "matchcv-dev-only-key-encryption-fallback";
    return undefined;
  }
  if (version === current - 1) return env.KEY_ENCRYPTION_SECRET_PREVIOUS?.trim() || undefined;
  return undefined;
}

function deriveKek(secret: string, version: number, purpose: EnvelopePurpose): Buffer {
  const info = purpose === "vault" ? "matchcv-cookie-vault" : "matchcv-envelope-kek";
  return Buffer.from(hkdfSync("sha256", Buffer.from(secret, "utf8"), Buffer.from(`matchcv-kek-salt-v${version}`), Buffer.from(info), 32));
}

function encode(bytes: Buffer): string {
  return bytes.toString("base64url");
}

function decode(value: string, expected?: number): Buffer {
  const bytes = Buffer.from(value, "base64url");
  if (expected !== undefined && bytes.length !== expected) throw new EnvelopeError();
  return bytes;
}

function seal(key: Buffer, plaintext: Buffer): { iv: string; authTag: string; ciphertext: string } {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_BYTES });
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { iv: encode(iv), authTag: encode(cipher.getAuthTag()), ciphertext: encode(ciphertext) };
}

function open(key: Buffer, sealed: { iv: string; authTag: string; ciphertext: string }): Buffer {
  const decipher = createDecipheriv("aes-256-gcm", key, decode(sealed.iv, IV_BYTES), { authTagLength: TAG_BYTES });
  decipher.setAuthTag(decode(sealed.authTag, TAG_BYTES));
  return Buffer.concat([decipher.update(decode(sealed.ciphertext)), decipher.final()]);
}

export function encryptSecret(
  plaintext: string,
  options?: { kekVersion?: number; purpose?: EnvelopePurpose; resolveSecret?: KekResolver },
): { envelope: Envelope; last4: string } {
  const purpose = options?.purpose ?? "data";
  const kekVersion = options?.kekVersion ?? currentKekVersion();
  const secret = (options?.resolveSecret ?? resolveKekSecret)(kekVersion);
  if (!secret) throw new EnvelopeError("Configure KEY_ENCRYPTION_SECRET para cifrar segredos.");
  const dek = randomBytes(DEK_BYTES);
  const data = seal(dek, Buffer.from(plaintext, "utf8"));
  const wrapped = seal(deriveKek(secret, kekVersion, purpose), dek);
  return {
    last4: secretLast4(plaintext),
    envelope: {
      algorithm: ENVELOPE_ALGORITHM,
      purpose,
      kekVersion,
      iv: data.iv,
      authTag: data.authTag,
      ciphertext: data.ciphertext,
      wrappedDek: wrapped,
    },
  };
}

export function decryptSecret(envelope: Envelope, options?: { resolveSecret?: KekResolver }): string {
  if (envelope.algorithm !== ENVELOPE_ALGORITHM) throw new EnvelopeError();
  const secret = (options?.resolveSecret ?? resolveKekSecret)(envelope.kekVersion);
  if (!secret) throw new EnvelopeError();
  try {
    const dek = open(deriveKek(secret, envelope.kekVersion, envelope.purpose), envelope.wrappedDek);
    if (dek.length !== DEK_BYTES) throw new EnvelopeError();
    return open(dek, envelope).toString("utf8");
  } catch (error) {
    if (error instanceof EnvelopeError) throw error;
    throw new EnvelopeError();
  }
}

export interface KeyAuditEvent {
  action: "key_decrypt" | "key_save" | "key_delete";
  userId: string;
  provider: string;
  last4: string;
}

/** Auditoria sem o valor da chave. O mascaramento ainda passa por cima da linha. */
export function logKeyAudit(event: KeyAuditEvent, secrets: Array<string | undefined> = []): void {
  console.info(
    redactSecrets(
      JSON.stringify({
        event: "key_audit",
        action: event.action,
        userId: event.userId,
        provider: event.provider,
        last4: event.last4,
      }),
      secrets,
    ),
  );
}
