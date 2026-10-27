/** Amostra padrão dos traces. Erros não usam esta taxa. */
export const DEFAULT_TRACES_SAMPLE_RATE = 0.1;

const MAX_ERROR_MESSAGE = 300;

/**
 * Subconjunto lido pelo Sentry. Objetos parciais são necessários no cliente:
 * o Next só injeta `NEXT_PUBLIC_*` em acesso direto a `process.env.NOME`.
 */
export type SentryEnv = {
  SENTRY_DSN?: string;
  NEXT_PUBLIC_SENTRY_DSN?: string;
  SENTRY_TRACES_SAMPLE_RATE?: string;
  NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE?: string;
};

function resolveEnv(env?: SentryEnv): SentryEnv {
  if (env) return env;
  return {
    SENTRY_DSN: process.env.SENTRY_DSN,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    SENTRY_TRACES_SAMPLE_RATE: process.env.SENTRY_TRACES_SAMPLE_RATE,
    NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
  };
}

export function readSentryDsn(env?: SentryEnv): string | undefined {
  const source = resolveEnv(env);
  const value = (source.SENTRY_DSN || source.NEXT_PUBLIC_SENTRY_DSN || "").trim();
  if (!value.startsWith("https://") || !value.includes("@")) return undefined;
  return value;
}

export function isSentryEnabled(env?: SentryEnv): boolean {
  return readSentryDsn(env) !== undefined;
}

/**
 * `SENTRY_TRACES_SAMPLE_RATE` no servidor e
 * `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` no navegador. Sem valor válido, 0.1.
 */
export function readTracesSampleRate(env?: SentryEnv): number {
  const source = resolveEnv(env);
  const raw = source.SENTRY_TRACES_SAMPLE_RATE ?? source.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE;
  if (raw === undefined || raw.trim() === "") return DEFAULT_TRACES_SAMPLE_RATE;
  const value = Number(raw);
  if (!Number.isFinite(value)) return DEFAULT_TRACES_SAMPLE_RATE;
  return Math.min(1, Math.max(0, value));
}

export function clipErrorMessage(message: string): string {
  if (message.length <= MAX_ERROR_MESSAGE) return message;
  const name = message.split(":", 1)[0] || "Error";
  return `${name}: [mensagem omitida]`;
}
