import { LIMITS } from "@/lib/schemas/requests";

export const DOCUMENT_KINDS = ["cv", "achievements", "portfolio"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];
export type DocumentSource = "pdf" | "text";

export interface DocumentDraft {
  id: string;
  kind: DocumentKind;
  source: DocumentSource;
  text: string;
  file: File | null;
}

export interface DocumentTextInput {
  kind: DocumentKind;
  source: DocumentSource;
  /** Texto colado, quando a origem é texto. */
  text?: string;
  /** Texto extraído do PDF, quando a origem é PDF. */
  extracted?: string;
}

export interface ComposedDocuments {
  cvText: string;
  achievementsText: string;
  resumeText: string;
  achievements: string;
  achievementsDocument: string;
}

export function createDocumentDraft(kind: DocumentKind = "cv", source: DocumentSource = "pdf"): DocumentDraft {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `doc-${Date.now()}`;
  return { id, kind, source, text: "", file: null };
}

export function defaultDocuments(): DocumentDraft[] {
  return [createDocumentDraft("cv", "pdf")];
}

function join(parts: Array<string | undefined>): string {
  return parts
    .map((part) => part?.trim() ?? "")
    .filter(Boolean)
    .join("\n\n");
}

/** Junta os documentos no formato que brief, geração e salário já entendem. */
export function composeDocuments(entries: readonly DocumentTextInput[]): ComposedDocuments {
  const cvText = join(
    entries.filter((entry) => entry.kind === "cv").map((entry) => (entry.source === "pdf" ? entry.extracted : entry.text)),
  ).slice(0, LIMITS.maxResumeChars);
  const pasted = join(
    entries
      .filter((entry) => entry.kind !== "cv" && entry.source === "text")
      .map((entry) => (entry.kind === "portfolio" ? `Contexto extra:\n${entry.text ?? ""}` : entry.text)),
  );
  const extracted = join(
    entries
      .filter((entry) => entry.kind !== "cv" && entry.source === "pdf")
      .map((entry) => (entry.kind === "portfolio" ? `Contexto extra:\n${entry.extracted ?? ""}` : entry.extracted)),
  );
  const achievements = pasted.slice(0, LIMITS.maxAchievementsChars);
  const overflow = pasted.slice(LIMITS.maxAchievementsChars);
  const achievementsDocument = join([extracted, overflow]).slice(0, LIMITS.maxResumeChars);
  const achievementsText = join([achievements, achievementsDocument]).slice(0, LIMITS.maxResumeChars);
  return { cvText, achievementsText, resumeText: cvText, achievements, achievementsDocument };
}

export function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export function validateDocuments(entries: readonly DocumentDraft[]): Record<string, string> {
  const errors: Record<string, string> = {};
  if (entries.length === 0) errors.documents = "Adicione ao menos um currículo.";
  for (const entry of entries) {
    if (entry.source === "pdf") {
      if (!entry.file) {
        if (entry.kind === "cv") errors[entry.id] = "Envie o PDF do currículo ou troque para texto.";
        continue;
      }
      if (!isPdfFile(entry.file)) errors[entry.id] = "Por enquanto só aceitamos PDF.";
      else if (entry.file.size > LIMITS.maxFileBytes) errors[entry.id] = "O PDF precisa ter até 4 MB.";
    } else if (entry.text.length > LIMITS.maxResumeChars) {
      errors[entry.id] = "Texto longo demais.";
    } else if (entry.kind === "cv" && entry.text.trim().length > 0 && entry.text.trim().length < 50) {
      errors[entry.id] = "O texto do currículo precisa ter pelo menos 50 caracteres.";
    }
  }
  const hasCv = entries.some((entry) => {
    if (entry.kind !== "cv" || errors[entry.id]) return false;
    if (entry.source === "pdf") return Boolean(entry.file);
    return entry.text.trim().length >= 50;
  });
  if (!hasCv) errors.documents = "Adicione um currículo em PDF ou com pelo menos 50 caracteres.";
  return errors;
}
