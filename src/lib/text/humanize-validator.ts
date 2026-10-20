import { ALL_BANNED_PHRASES } from "./banned-phrases";

/**
 * Validador anti-IA (seção 8 do escopo). Roda depois de cada geração de
 * CV, cover letter e e-mail.
 *
 * Fluxo previsto:
 *   1. autoFix(): correções determinísticas seguras (travessão, til).
 *   2. validateHumanText(): se sobrar violação, 1 regeneração com a lista.
 *   3. Se persistir, a UI destaca os trechos para revisão.
 */

export type RuleId =
  | "dash"
  | "tilde-number"
  | "banned-phrase"
  | "alem-disso-repeat"
  | "emoji"
  | "placeholder"
  | "word-limit"
  | "exclamation";

export interface Violation {
  rule: RuleId;
  message: string;
  match?: string;
}

export interface ValidateOptions {
  /** Limite de palavras (ex.: 150 para e-mail, 350 para cover letter). */
  maxWords?: number;
  /** Frases banidas extras, além da lista padrão. */
  extraBannedPhrases?: readonly string[];
}

const DASH_RE = /[\u2014\u2013]/g; // travessão (—) e meia-risca (–)
const TILDE_NUMBER_RE = /~\s?\d/g;
const EMOJI_RE = /\p{Extended_Pictographic}/gu;
const PLACEHOLDER_RE = /\[[^\]\n]{1,80}?\]/g;
const ALEM_DISSO_RE = /\balém disso\b/giu;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Word boundary que entende acentos (\b do JS só conhece ASCII). */
function phraseRegex(phrase: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(phrase)}(?![\\p{L}\\p{N}])`, "giu");
}

export function countWords(text: string): number {
  const words = text.trim().match(/[\p{L}\p{N}][\p{L}\p{N}'’.-]*/gu);
  return words ? words.length : 0;
}

export function validateHumanText(text: string, options: ValidateOptions = {}): Violation[] {
  const violations: Violation[] = [];

  for (const m of text.matchAll(DASH_RE)) {
    violations.push({ rule: "dash", message: "Travessão ou meia-risca usado como pontuação", match: m[0] });
  }

  for (const m of text.matchAll(TILDE_NUMBER_RE)) {
    violations.push({
      rule: "tilde-number",
      message: 'Til antes de número. Use "em média", "cerca de" ou "aproximadamente"',
      match: m[0],
    });
  }

  const phrases = [...ALL_BANNED_PHRASES, ...(options.extraBannedPhrases ?? [])];
  for (const phrase of phrases) {
    const m = text.match(phraseRegex(phrase));
    if (m) {
      violations.push({ rule: "banned-phrase", message: `Frase banida: "${phrase}"`, match: m[0] });
    }
  }

  const alemDisso = text.match(ALEM_DISSO_RE);
  if (alemDisso && alemDisso.length > 1) {
    violations.push({
      rule: "alem-disso-repeat",
      message: `"Além disso" aparece ${alemDisso.length} vezes (máximo 1)`,
    });
  }

  for (const m of text.matchAll(EMOJI_RE)) {
    violations.push({ rule: "emoji", message: "Emoji no texto", match: m[0] });
  }

  for (const m of text.matchAll(PLACEHOLDER_RE)) {
    violations.push({ rule: "placeholder", message: "Placeholder entre colchetes", match: m[0] });
  }

  const exclamations = (text.match(/!/g) ?? []).length;
  if (exclamations > 1) {
    violations.push({ rule: "exclamation", message: `${exclamations} pontos de exclamação (máximo 1)` });
  }

  if (options.maxWords !== undefined) {
    const words = countWords(text);
    if (words > options.maxWords) {
      violations.push({
        rule: "word-limit",
        message: `${words} palavras (limite de ${options.maxWords})`,
      });
    }
  }

  return violations;
}

/**
 * Correções determinísticas e seguras:
 * - "2020–2023" vira "2020-2023" (intervalo numérico usa hífen)
 * - " — " / " – " entre palavras vira ", "
 * - travessão colado vira ", "
 * - "~20" vira "cerca de 20"
 */
export function autoFix(text: string): string {
  return text
    .replace(/(\d)\s*[\u2014\u2013]\s*(\d)/g, "$1-$2")
    .replace(/\s+[\u2014\u2013]\s+/g, ", ")
    .replace(/[\u2014\u2013]/g, ", ")
    .replace(/~\s?(\d)/g, "cerca de $1")
    .replace(/,\s*,/g, ",")
    .replace(/ {2,}/g, " ");
}

export interface HumanizeResult {
  text: string;
  autoFixed: boolean;
  violations: Violation[];
}

/** Aplica autoFix e devolve as violações restantes. */
export function humanize(text: string, options: ValidateOptions = {}): HumanizeResult {
  const fixed = autoFix(text);
  return {
    text: fixed,
    autoFixed: fixed !== text,
    violations: validateHumanText(fixed, options),
  };
}

/** Texto para o prompt de regeneração: "reescreva corrigindo: ...". */
export function violationsToPrompt(violations: Pick<Violation, "message" | "match">[]): string {
  return violations
    .map((v) => `- ${v.message}${v.match ? ` (trecho: "${v.match}")` : ""}`)
    .join("\n");
}
