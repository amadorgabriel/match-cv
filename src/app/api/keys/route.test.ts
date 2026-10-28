import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const generateArtifact = vi.fn();
vi.mock("@/lib/ai/generate", () => ({
  generateArtifact: (...args: unknown[]) => generateArtifact(...args),
}));

import { DELETE as deleteAccount, GET as getAccount } from "@/app/api/account/route";
import { POST as generate } from "@/app/api/generate/[artifact]/route";
import { DELETE as deleteKey, GET as listKeys, POST as saveKey } from "@/app/api/keys/route";
import { GET as listApplications } from "@/app/api/applications/route";

const API_KEY = "sk-or-v1-envelope-secret-9876";

function headers(ip: string, cookie?: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    "x-forwarded-for": ip,
    ...(cookie ? { cookie } : {}),
  };
}

function cookiePair(response: Response): string {
  const header = response.headers.get("set-cookie");
  if (!header) throw new Error("cookie ausente");
  return header.split(";")[0] ?? header;
}

describe("chave cifrada e exclusão local", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    generateArtifact.mockReset();
    generateArtifact.mockResolvedValue({ artifact: "cv", data: { fullName: "Ana" }, mock: true, promptVersion: "cv@test" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("devolve só metadados, decifra no handler e apaga o cofre na exclusão LGPD", async () => {
    const save = await saveKey(
      new Request("http://localhost/api/keys", {
        method: "POST",
        headers: headers("198.51.100.20"),
        body: JSON.stringify({ provider: "openrouter", apiKey: API_KEY }),
      }),
    );
    expect(save.status).toBe(201);
    const saved = await save.json();
    const blob = JSON.stringify(saved);
    expect(saved.key).toMatchObject({ provider: "openrouter", last4: "9876", status: "active" });
    expect(Object.keys(saved.key).sort()).toEqual(["createdAt", "id", "last4", "provider", "status", "updatedAt"]);
    expect(blob).not.toContain(API_KEY);
    expect(blob).not.toContain("envelope-secret");
    expect(blob).not.toContain("ciphertext");
    expect(save.headers.get("set-cookie")).toContain("HttpOnly");
    expect(save.headers.get("set-cookie")).toContain("matchcv_key_vault=");

    const listed = await listKeys(new Request("http://localhost/api/keys", { headers: headers("198.51.100.21", cookiePair(save)) }));
    expect(listed.status).toBe(200);
    const listBody = await listed.json();
    expect(listBody.keys).toHaveLength(1);
    expect(JSON.stringify(listBody)).not.toContain("envelope-secret");

    const audit = vi.mocked(console.info).mock.calls.map((call) => String(call[0])).join("\n");
    expect(audit).toContain('"action":"key_save"');
    expect(audit).toContain('"userId":"local"');
    expect(audit).not.toContain(API_KEY);
    expect(audit).not.toContain("envelope-secret");

    const generated = await generate(
      new Request("http://localhost/api/generate/cv", {
        method: "POST",
        headers: headers("198.51.100.22", cookiePair(save)),
        body: JSON.stringify({
          provider: "openrouter",
          model: "openrouter/free",
          useSavedKey: true,
          resumeText: "Currículo de Ana com TypeScript, React e Node.js em São Paulo desde 2020.",
          jobDescription: "Vaga de desenvolvedor full stack pleno. Empresa: Ênfases. Requisitos: TypeScript e React.",
          achievements: "",
          achievementsDocument: "",
        }),
      }),
      { params: Promise.resolve({ artifact: "cv" }) },
    );
    expect(generated.status).toBe(200);
    expect(generateArtifact.mock.calls[0]?.[1]).toMatchObject({ apiKey: API_KEY, useSavedKey: true });
    expect(JSON.stringify(generateArtifact.mock.calls[0]?.[2])).not.toContain(API_KEY);
    expect(JSON.stringify(await generated.clone().json())).not.toContain(API_KEY);

    const removed = await deleteKey(
      new Request("http://localhost/api/keys", {
        method: "DELETE",
        headers: headers("198.51.100.25", cookiePair(save)),
        body: JSON.stringify({ provider: "openrouter" }),
      }),
    );
    expect(removed.status).toBe(200);
    const deletedAudit = vi.mocked(console.info).mock.calls.map((call) => String(call[0])).join("\n");
    expect(deletedAudit).toContain('"action":"key_delete"');
    expect(deletedAudit).not.toContain("envelope-secret");

    const erased = await deleteAccount(new Request("http://localhost/api/account", { method: "DELETE", headers: headers("198.51.100.23", cookiePair(save)) }));
    expect(erased.status).toBe(200);
    await expect(erased.json()).resolves.toMatchObject({ ok: true, scope: "local", deletedUser: false });
    const clearing = erased.headers.get("set-cookie") ?? "";
    expect(clearing).toContain("matchcv_key_vault=");
    expect(clearing).toContain("Max-Age=0");

    const account = await getAccount(new Request("http://localhost/api/account", { headers: headers("198.51.100.24") }));
    await expect(account.json()).resolves.toMatchObject({ mode: "anonymous", authEnabled: false, user: null });
  });

  it("recusa o dashboard no servidor quando não há sessão", async () => {
    const response = await listApplications(new Request("http://localhost/api/applications", { headers: headers("198.51.100.30") }));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "anonymous" } });
  });
});
