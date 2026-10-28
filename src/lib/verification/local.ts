import type { Brief } from "@/lib/schemas/brief";
import { parseSeniority, type Seniority } from "@/lib/salary/job";

import type { ClaimStatus, VerificationArtifact, VerificationClaim, VerificationReport, VerifyRequest } from "./types";

const LEVELS: Seniority[] = ["estágio", "júnior", "pleno", "sênior", "lead"];

const STOPWORDS = new Set([
  "para",
  "como",
  "mais",
  "entre",
  "pelo",
  "pela",
  "sobre",
  "com",
  "sem",
  "uma",
  "uns",
  "umas",
  "que",
  "dos",
  "das",
  "nos",
  "nas",
  "por",
  "em",
  "na",
  "no",
  "de",
  "da",
  "do",
  "os",
  "as",
  "um",
  "ao",
  "se",
  "ou",
  "e",
  "a",
  "o",
]);

/**
 * Nota 0–100:
 * - 50 pontos: fração dos mustHave presentes no CV original, conquistas e brief
 * - 25 pontos: fração das keywords técnicas presentes nessa mesma base
 * - 15 pontos: senioridade alinhada; 8 se indeterminada ou um nível ao lado; 0 se distante
 * - 10 pontos: fração dos mustHave que aparecem nas experiências (cargo ou destaque)
 */
export function verifyLocally(input: VerifyRequest): VerificationReport {
  const evidence = evidenceCorpus(input);
  const experience = experienceCorpus(input.brief);
  const mustHave = input.brief?.job.mustHave ?? [];
  const keywords = input.brief?.job.keywords ?? [];
  const covered = mustHave.filter((item) => covers(item, evidence));
  const missing = mustHave.filter((item) => !covers(item, evidence));
  const keywordHits = keywords.filter((item) => covers(item, evidence));
  const keywordMisses = keywords.filter((item) => !covers(item, evidence));
  const proven = mustHave.filter((item) => covers(item, experience));
  const seniority = alignSeniority(input);
  const matchScore = score({
    mustHits: covered.length,
    mustTotal: mustHave.length,
    keywordHits: keywordHits.length,
    keywordTotal: keywords.length,
    provenHits: proven.length,
    seniorityPoints: seniority.points,
  });

  return {
    matchScore,
    covered,
    missing,
    keywordHits,
    keywordMisses,
    seniorityAlignment: seniority.alignment,
    claims: extractClaims(input).map((claim) => classifyClaim(claim.text, evidence, claim.artifact)),
    engine: "local",
  };
}

export function score(input: {
  mustHits: number;
  mustTotal: number;
  keywordHits: number;
  keywordTotal: number;
  provenHits: number;
  seniorityPoints: number;
}): number {
  const raw =
    ratio(input.mustHits, input.mustTotal, 50) +
    ratio(input.keywordHits, input.keywordTotal, 25) +
    input.seniorityPoints +
    ratio(input.provenHits, input.mustTotal, 10);
  return Math.max(0, Math.min(100, Math.round(raw)));
}

function ratio(hits: number, total: number, weight: number): number {
  if (total <= 0) return 0;
  return (hits / total) * weight;
}

export function classifyClaim(text: string, corpus: string, artifact: VerificationArtifact): VerificationClaim {
  if (contradictingPercentage(text, corpus)) {
    return {
      artifact,
      text,
      status: "contradicted",
      reason: "O número diverge do que está no currículo original.",
    };
  }
  const status: ClaimStatus = supported(text, corpus) ? "supported" : "unverified";
  return {
    artifact,
    text,
    status,
    reason:
      status === "supported"
        ? "Há trecho correspondente no currículo ou nas conquistas."
        : "Não há apoio direto no currículo original.",
  };
}

function evidenceCorpus(input: VerifyRequest): string {
  const profile = input.brief?.profile;
  const parts = [
    input.resumeText,
    input.achievements,
    input.achievementsDocument,
    profile?.summary,
    profile?.headline,
    profile?.skills.join(" "),
    profile?.achievements.join(" "),
    profile?.experience.map((item) => [item.role, item.company, item.highlights.join(" ")].join(" ")).join(" "),
  ];
  return fold(parts.filter(Boolean).join("\n"));
}

function experienceCorpus(brief: Brief | undefined): string {
  if (!brief) return "";
  return fold(
    brief.profile.experience
      .map((item) => [item.role, item.company, ...item.highlights].join(" "))
      .join("\n"),
  );
}

function covers(requirement: string, corpus: string): boolean {
  const folded = fold(requirement);
  if (folded.length >= 3 && corpus.includes(folded)) return true;
  const tokens = significantTokens(requirement);
  if (tokens.length === 0) return false;
  const hits = tokens.filter((token) => corpus.includes(token));
  return hits.length / tokens.length >= 0.6;
}

function supported(claim: string, corpus: string): boolean {
  const tokens = significantTokens(claim);
  if (tokens.length === 0) return false;
  const hits = tokens.filter((token) => corpus.includes(token)).length;
  if (hits / tokens.length < 0.45) return false;
  return numbersIn(claim).every((value) => corpus.includes(value));
}

function contradictingPercentage(claim: string, corpus: string): boolean {
  const claimPercents = percentContexts(claim);
  const corpusPercents = percentContexts(corpus);
  for (const item of claimPercents) {
    for (const source of corpusPercents) {
      if (item.value === source.value) continue;
      if (sharesContentToken(item.context, source.context)) return true;
    }
  }
  return false;
}

function percentContexts(text: string): Array<{ value: string; context: string }> {
  const found: Array<{ value: string; context: string }> = [];
  for (const match of text.matchAll(/(\d+(?:[.,]\d+)?)\s*%/g)) {
    const index = match.index ?? 0;
    found.push({
      value: match[1].replace(",", "."),
      context: fold(text.slice(Math.max(0, index - 48), index + match[0].length + 48)),
    });
  }
  return found;
}

function sharesContentToken(left: string, right: string): boolean {
  const rightTokens = new Set(significantTokens(right).filter((token) => token.length >= 5));
  return significantTokens(left).some((token) => token.length >= 5 && rightTokens.has(token));
}

function numbersIn(text: string): string[] {
  return [...text.matchAll(/\d+(?:[.,]\d+)?/g)].map((match) => match[0].replace(",", "."));
}

function significantTokens(text: string): string[] {
  return fold(text)
    .split(/[^a-z0-9+#]+/)
    .filter((token) => token.length >= 4 && !STOPWORDS.has(token) && !/^\d+$/.test(token));
}

function alignSeniority(input: VerifyRequest): { alignment: VerificationReport["seniorityAlignment"]; points: number } {
  const jobLevel = parseSeniority(input.brief?.job.seniority) ?? parseSeniority(input.brief?.job.title) ?? parseSeniority(input.jobDescription.slice(0, 240));
  const candidateLevel =
    parseSeniority(input.brief?.profile.inferredSeniority) ??
    parseSeniority(input.brief?.profile.headline) ??
    parseSeniority(input.resumeText.slice(0, 400));
  if (!jobLevel || !candidateLevel) return { alignment: "indeterminada", points: 8 };
  const gap = LEVELS.indexOf(candidateLevel) - LEVELS.indexOf(jobLevel);
  if (gap === 0) return { alignment: "alinhada", points: 15 };
  const alignment = gap < 0 ? "abaixo" : "acima";
  return { alignment, points: Math.abs(gap) === 1 ? 8 : 0 };
}

function extractClaims(input: VerifyRequest): Array<{ artifact: VerificationArtifact; text: string }> {
  const claims: Array<{ artifact: VerificationArtifact; text: string }> = [];
  const push = (artifact: VerificationArtifact, text: string | undefined) => {
    const cleaned = text?.replace(/\s+/g, " ").trim();
    if (!cleaned || cleaned.length < 24 || claims.length >= 20) return;
    claims.push({ artifact, text: cleaned });
  };

  if (input.cv) {
    push("cv", input.cv.summary);
    for (const experience of input.cv.experience) {
      for (const bullet of experience.bullets) push("cv", bullet);
    }
  }
  if (input.email) {
    for (const sentence of sentences(input.email.body)) push("email", sentence);
  }
  if (input.coverLetter) {
    for (const sentence of sentences(input.coverLetter.body)) push("cover-letter", sentence);
  }
  if (input.interview) {
    for (const section of input.interview.sections) {
      for (const item of section.items) push("interview", item.suggestedAnswer);
    }
  }
  return claims;
}

function sentences(text: string): string[] {
  return text
    .split(/\n+|(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function fold(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}
