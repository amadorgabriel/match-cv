import type { Brief } from "@/lib/schemas/brief";

/** Perfil de exemplo usado quando a IA real está desligada. */
export const MOCK_BRIEF: Brief = {
  profile: {
    fullName: "Nome do Candidato (exemplo)",
    headline: "Desenvolvedor Full Stack Pleno",
    location: "São Paulo, SP",
    summary: "Desenvolvedor full stack com 5 anos em TypeScript, React e Node.js. Migrou 12 serviços para Kubernetes e reduziu o tempo de deploy em 40%.",
    experience: [
      {
        company: "Empresa Exemplo",
        role: "Desenvolvedor Full Stack",
        dates: "03/2022 a atual",
        highlights: ["Migrou 12 serviços Node.js para Kubernetes e reduziu o tempo de deploy em 40%."],
      },
    ],
    skills: ["TypeScript", "React", "Node.js"],
    education: [{ institution: "Universidade Exemplo", degree: "Bacharelado em Ciência da Computação" }],
    achievements: ["Reduziu o tempo de deploy em 40%."],
  },
  job: {
    title: "Desenvolvedor full stack",
    seniority: "pleno",
    company: "Empresa da vaga",
    location: "remoto",
    mustHave: ["TypeScript", "React"],
    keywords: ["Node.js", "full stack"],
  },
};
