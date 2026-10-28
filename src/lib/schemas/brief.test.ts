import { describe, expect, it } from "vitest";

import { BriefSchema } from "./brief";

const base = {
  profile: {
    fullName: "Ana Souza",
    headline: "Desenvolvedora",
    summary: "Back-end com Node.js.",
    experience: [],
    skills: [],
    education: [],
    achievements: [],
  },
  job: {
    title: "Desenvolvedora",
    mustHave: [],
    keywords: [],
  },
};

describe("BriefSchema", () => {
  it("aceita o brief antigo sem os campos novos", () => {
    const parsed = BriefSchema.parse(base);
    expect(parsed.profile.email).toBeUndefined();
    expect(parsed.profile.yearsOfExperience).toBeUndefined();
    expect(parsed.job.normalizedSearchTitle).toBeUndefined();
    expect(parsed.job.company).toBeUndefined();
    expect(parsed.job.workModel).toBeUndefined();
  });

  it("guarda contato, cargo canônico e modelo de trabalho e zera empresa vazia", () => {
    const parsed = BriefSchema.parse({
      profile: {
        ...base.profile,
        email: " ana@example.com ",
        phone: "",
        yearsOfExperience: 4,
        inferredSeniority: "sênior",
        languages: ["Português"],
      },
      job: {
        ...base.job,
        company: null,
        normalizedSearchTitle: "Engenheiro de Software Back-end",
        workModel: "hibrido",
        location: "São Paulo",
      },
    });
    expect(parsed.profile.email).toBe("ana@example.com");
    expect(parsed.profile.phone).toBe("");
    expect(parsed.profile.yearsOfExperience).toBe(4);
    expect(parsed.job.company).toBeNull();
    expect(parsed.job.normalizedSearchTitle).toBe("Engenheiro de Software Back-end");
    expect(parsed.job.workModel).toBe("hibrido");
  });

  it("ignora um modelo de trabalho fora da lista em vez de derrubar o brief", () => {
    const parsed = BriefSchema.parse({
      ...base,
      job: { ...base.job, workModel: "híbrido" },
    });
    expect(parsed.job.workModel).toBeUndefined();
  });
});
