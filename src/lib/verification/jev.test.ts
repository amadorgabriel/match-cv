import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { Brief } from "@/lib/schemas/brief";
import { redactSecrets } from "@/lib/security/secrets";

import { verifyLocally } from "./local";
import type { VerifyRequest } from "./types";
import { verifyCandidate } from "./jev";

const KEY = "ts_live_VERIFICATION_SECRET_99";

const brief = {
  profile: {
    fullName: "Ana Souza",
    headline: "Desenvolvedora back-end sênior",
    summary: "Back-end com Node.js, TypeScript e Kubernetes.",
    inferredSeniority: "sênior",
    yearsOfExperience: 4,
    experience: [
      {
        company: "Empresa Alfa",
        role: "Desenvolvedora back-end",
        dates: "2020-2024",
        highlights: ["Reduzi o tempo de deploy em 40% com Node.js e Kubernetes."],
      },
    ],
    skills: ["Node.js", "TypeScript", "Kubernetes", "PostgreSQL"],
    education: [],
    achievements: ["Reduzi o tempo de deploy em 40%."],
  },
  job: {
    title: "Engenheiro de Software Back-end",
    normalizedSearchTitle: "Engenheiro de Software Back-end",
    seniority: "sênior",
    company: "Empresa Beta",
    mustHave: ["Node.js", "TypeScript", "Kubernetes"],
    keywords: ["PostgreSQL", "APIs"],
    workModel: "remoto" as const,
  },
} satisfies Brief;

const input: VerifyRequest = {
  resumeText: `
Ana Souza
Desenvolvedora back-end sênior
Empresa Alfa, 2020-2024
Reduzi o tempo de deploy em 40% com Node.js e Kubernetes.
TypeScript, PostgreSQL.
`,
  jobDescription: "Engenheiro de Software Back-end Sênior. Requisitos: Node.js, TypeScript, Kubernetes e PostgreSQL.",
  achievements: "Na Empresa Alfa, reduzi o tempo de deploy em 40%.",
  achievementsDocument: "",
  brief,
  cv: {
    fullName: "Ana Souza",
    headline: "Desenvolvedora back-end",
    contact: { links: [] },
    summary: "Back-end.",
    experience: [
      {
        company: "Empresa Alfa",
        role: "Desenvolvedora back-end",
        start: "2020",
        bullets: [
          "Reduzi o tempo de deploy em 40% na Empresa Alfa.",
          "Aumentei o faturamento em 300% liderando um time de 50 pessoas.",
          "Reduzi o tempo de deploy em 80% com uma plataforma nova.",
        ],
      },
    ],
    education: [],
    skills: ["Node.js"],
    certifications: [],
    languages: [],
    language: "pt-BR",
  },
};

afterEach(() => {
  delete process.env.TYPESAFE_API_KEY;
  vi.unstubAllGlobals();
});

describe("verificação local em português", () => {
  it("calcula a nota e separa afirmação apoiada, sem apoio e contradita", () => {
    const report = verifyLocally(input);
    // 3/3 requisitos = 50; 1/2 keywords = 12,5; senioridade alinhada = 15; 2/3 experiências = 6,666... → 84
    expect(report.matchScore).toBe(84);
    expect(report.engine).toBe("local");
    expect(report.covered).toEqual(["Node.js", "TypeScript", "Kubernetes"]);
    expect(report.missing).toEqual([]);
    expect(report.keywordHits).toEqual(["PostgreSQL"]);
    expect(report.keywordMisses).toEqual(["APIs"]);
    expect(report.seniorityAlignment).toBe("alinhada");
    expect(report.claims.map((claim) => claim.status)).toEqual(["supported", "unverified", "contradicted"]);
    expect(report.claims[1]?.reason).toMatch(/não há apoio/i);
    expect(JSON.stringify(report)).not.toContain(KEY);
  });
});

describe("Jev opcional", () => {
  it("não chama a rede sem TYPESAFE_API_KEY", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const report = await verifyCandidate(input, { fetch: fetchMock });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(report.engine).toBe("local");
    expect(report.matchScore).toBe(84);
  });

  it("usa a nota do Jev quando a chave existe e a API responde", async () => {
    process.env.TYPESAFE_API_KEY = KEY;
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          model: "jev-1.13.0",
          answers: {
            match: { type: "score", score: 2 },
            claim_0: { type: "choice", choice: "supported" },
            claim_1: { type: "choice", choice: "unverified" },
            claim_2: { type: "choice", choice: "contradicted" },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const report = await verifyCandidate(input, { fetch: fetchMock });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.typesafe.ai/v1/systemone");
    expect(new Headers(init.headers).get("authorization")).toBe(`Bearer ${KEY}`);
    expect(report.engine).toBe("jev");
    expect(report.matchScore).toBe(50);
    expect(report.covered).toEqual(["Node.js", "TypeScript", "Kubernetes"]);
    expect(JSON.stringify(report)).not.toContain(KEY);
    expect(redactSecrets(`erro ${KEY}`)).not.toContain(KEY);
  });

  it("volta para o verificador local se a chamada externa falha", async () => {
    process.env.TYPESAFE_API_KEY = KEY;
    const fetchMock = vi.fn(async () => {
      throw new Error(`network down ${KEY}`);
    });
    const report = await verifyCandidate(input, { fetch: fetchMock });
    expect(report.engine).toBe("local");
    expect(report.matchScore).toBe(84);
    expect(JSON.stringify(report)).not.toContain(KEY);
  });
});
