import { describe, expect, it, vi } from "vitest";

import { decryptSecret, encryptSecret, logKeyAudit, secretLast4, type Envelope } from "./envelope-encryption";

const KEY = "sk-or-v1-envelope-secret-9876";
const V1 = "kek-versao-1-com-entropia-suficiente";
const V2 = "kek-versao-2-com-entropia-suficiente";

function resolver(version: number): string | undefined {
  if (version === 1) return V1;
  if (version === 2) return V2;
  return undefined;
}

function flip(value: string): string {
  const bytes = Buffer.from(value, "base64url");
  bytes[0] = (bytes[0] ?? 0) ^ 0xff;
  return bytes.toString("base64url");
}

describe("envelope AES-256-GCM", () => {
  it("cifra e decifra com DEK e KEK", () => {
    const { envelope, last4 } = encryptSecret(KEY, { kekVersion: 1, resolveSecret: resolver });
    expect(envelope.algorithm).toBe("AES-256-GCM");
    expect(envelope.kekVersion).toBe(1);
    expect(Buffer.from(envelope.iv, "base64url")).toHaveLength(12);
    expect(Buffer.from(envelope.authTag, "base64url")).toHaveLength(16);
    expect(Buffer.from(envelope.wrappedDek.authTag, "base64url")).toHaveLength(16);
    expect(last4).toBe("9876");
    expect(decryptSecret(envelope, { resolveSecret: resolver })).toBe(KEY);
    expect(JSON.stringify(envelope)).not.toContain(KEY);
    expect(JSON.stringify(envelope)).not.toContain("envelope-secret");
  });

  it("recusa ciphertext e auth tag adulterados", () => {
    const { envelope } = encryptSecret(KEY, { kekVersion: 1, resolveSecret: resolver });
    const badCipher: Envelope = { ...envelope, ciphertext: flip(envelope.ciphertext) };
    const badTag: Envelope = { ...envelope, authTag: flip(envelope.authTag) };
    const badDek: Envelope = { ...envelope, wrappedDek: { ...envelope.wrappedDek, ciphertext: flip(envelope.wrappedDek.ciphertext) } };
    expect(() => decryptSecret(badCipher, { resolveSecret: resolver })).toThrow(/cifrado/);
    expect(() => decryptSecret(badTag, { resolveSecret: resolver })).toThrow(/cifrado/);
    expect(() => decryptSecret(badDek, { resolveSecret: resolver })).toThrow(/cifrado/);
    for (const error of [badCipher, badTag, badDek]) {
      try {
        decryptSecret(error, { resolveSecret: resolver });
      } catch (err) {
        expect(String(err)).not.toContain(KEY);
        expect(String(err)).not.toContain("envelope-secret");
      }
    }
  });

  it("lê um envelope antigo depois da rotação de kekVersion", () => {
    const { envelope } = encryptSecret(KEY, { kekVersion: 1, resolveSecret: resolver });
    const current = encryptSecret("outra-chave-salva-4321", { kekVersion: 2, resolveSecret: resolver });
    expect(decryptSecret(envelope, { resolveSecret: resolver })).toBe(KEY);
    expect(decryptSecret(current.envelope, { resolveSecret: resolver })).toBe("outra-chave-salva-4321");
    expect(() => decryptSecret(envelope, { resolveSecret: (version) => (version === 2 ? V2 : undefined) })).toThrow();
  });

  it("expõe só os últimos 4 caracteres e audita sem a chave", () => {
    const metadata = { id: "1", provider: "openrouter", last4: secretLast4(KEY), status: "active" as const };
    expect(metadata.last4).toBe("9876");
    expect(JSON.stringify(metadata)).not.toContain("envelope-secret");
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    logKeyAudit({ action: "key_decrypt", userId: "user-1", provider: "openrouter", last4: metadata.last4 }, [KEY]);
    const line = String(spy.mock.calls[0]?.[0]);
    expect(line).toContain('"action":"key_decrypt"');
    expect(line).toContain('"userId":"user-1"');
    expect(line).toContain('"last4":"9876"');
    expect(line).not.toContain(KEY);
    expect(line).not.toContain("envelope-secret");
    spy.mockRestore();
  });
});
