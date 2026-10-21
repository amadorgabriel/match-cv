import type { ArtifactOutput, Salary } from "@/lib/schemas/outputs";

/**
 * Dados de exemplo devolvidos enquanto a IA real está desligada
 * (MATCHCV_ENABLE_AI != "true"). Seguem as regras anti-IA de propósito.
 */
export const MOCK_OUTPUTS: ArtifactOutput = {
  cv: {
    fullName: "Nome do Candidato (exemplo)",
    headline: "Desenvolvedor Full Stack Pleno",
    contact: {
      email: "candidato@exemplo.com",
      phone: "+55 11 90000-0000",
      location: "São Paulo, SP",
      links: ["linkedin.com/in/exemplo", "github.com/exemplo"],
    },
    summary:
      "Desenvolvedor full stack com 5 anos de experiência em TypeScript, React e Node.js. Nos últimos 2 anos liderei a migração de 12 serviços para Kubernetes e reduzi o tempo de deploy em 40%.",
    experience: [
      {
        company: "Empresa Exemplo",
        role: "Desenvolvedor Full Stack",
        start: "03/2022",
        end: "atual",
        location: "Remoto",
        bullets: [
          "Migrei 12 serviços Node.js para Kubernetes, o que reduziu o tempo de deploy em 40%.",
          "Criei a biblioteca de componentes React usada por 4 squads.",
          "Atendi em média 20 chamados de suporte por semana como ponto focal do time.",
        ],
      },
      {
        company: "Outra Empresa Exemplo",
        role: "Desenvolvedor Front-end",
        start: "01/2020",
        end: "02/2022",
        bullets: ["Implementei o novo checkout em Next.js, que aumentou a conversão em 8%."],
      },
    ],
    education: [{ institution: "Universidade Exemplo", degree: "Bacharelado em Ciência da Computação", end: "2019" }],
    skills: ["TypeScript", "React", "Next.js", "Node.js", "PostgreSQL", "Docker", "Kubernetes"],
    certifications: [],
    languages: ["Português (nativo)", "Inglês (avançado)"],
    language: "pt-BR",
  },
  email: {
    subject: "Candidatura: Desenvolvedor Full Stack Pleno",
    body: [
      "Olá, time de recrutamento,",
      "Vi a vaga de Desenvolvedor Full Stack Pleno e quero me candidatar. Nos últimos 2 anos migrei 12 serviços para Kubernetes e reduzi o tempo de deploy em 40%, algo bem próximo do desafio que vocês descrevem.",
      "Envio meu currículo em anexo. Posso conversar em qualquer dia desta semana.",
      "Obrigado,\nNome do Candidato",
    ].join("\n\n"),
  },
  "cover-letter": {
    body: [
      "Quero trabalhar na plataforma de pagamentos de vocês porque passei os últimos 2 anos resolvendo problemas parecidos: deploys lentos e serviços difíceis de escalar.",
      "Na Empresa Exemplo, migrei 12 serviços Node.js para Kubernetes. O tempo de deploy caiu 40% e o time passou a publicar várias vezes por dia. Também criei a biblioteca de componentes React que hoje 4 squads usam.",
      "A vaga pede experiência com Next.js e PostgreSQL. Usei os dois no checkout que implementei na Outra Empresa Exemplo, que aumentou a conversão em 8%.",
      "Tenho disponibilidade para conversar nesta semana.",
    ].join("\n\n"),
  },
  interview: {
    sections: [
      {
        title: "Perguntas técnicas prováveis",
        items: [
          {
            question: "Como você estruturaria a migração de um monólito para Kubernetes?",
            suggestedAnswer:
              "Conte como fez a migração dos 12 serviços: ordem de prioridade, como mediu o tempo de deploy antes e depois e o que daria para fazer diferente.",
          },
          {
            question: "Quando usar Server Components no Next.js?",
            suggestedAnswer: "Use o exemplo do checkout e explique o que ficou no servidor e o que ficou no cliente.",
          },
        ],
      },
      {
        title: "Perguntas comportamentais",
        items: [
          {
            question: "Conte sobre um conflito técnico no time e como você resolveu.",
            suggestedAnswer: "Monte no formato STAR com uma situação real do seu histórico.",
          },
        ],
      },
      {
        title: "Perguntas para fazer à empresa",
        items: [
          { question: "Como é o processo de deploy hoje e qual é a frequência?" },
          { question: "Como o time divide o trabalho entre front-end e back-end?" },
        ],
      },
      {
        title: "Pontos de atenção",
        items: [
          {
            question: "A vaga pede experiência com mensageria (Kafka).",
            notes: "O currículo não menciona Kafka. Seja honesto e cite o que você já usou de filas.",
          },
        ],
      },
    ],
  },
};

export function mockSalary(jobTitle: string, location?: string): Salary {
  return {
    currency: "BRL",
    period: "month",
    min: 9000,
    median: 12500,
    max: 16000,
    query: { jobTitle, location },
    sampleSize: 0,
    isEstimate: true,
    isMock: true,
    available: true,
    confidence: "media",
    sources: [
      {
        name: "Adzuna",
        url: "https://www.adzuna.com.br",
        note: "Dados de exemplo. Configure ADZUNA_APP_ID e ADZUNA_APP_KEY para consultar a API real.",
      },
    ],
    disclaimer:
      "Estimativa baseada em anúncios de vagas. Não distingue CLT de PJ e depende do volume de anúncios para o cargo e a cidade.",
  };
}
