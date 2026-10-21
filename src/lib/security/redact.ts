import "server-only";

/**
 * Tira chaves e tokens de uma mensagem antes de logar.
 * Cobre sk-, sk-ant-, sk-or-, AIza, Bearer e os nomes de header/campo
 * que a API usa. O valor exato da chave do request entra em `secrets`.
 */
const SECRET_PATTERNS = [
  /sk-(?:ant-|or-)?[A-Za-z0-9_-]{8,}/g,
  /AIza[0-9A-Za-z_-]{10,}/g,
  /Bearer\s+[A-Za-z0-9._~+/=-]{8,}/gi,
  /(?:api[_-]?key|app[_-]?key|x-api-key|x-goog-api-key|authorization)\s*[=:]\s*["']?[^\s"'&,}]+/gi,
];

export function redactSecrets(text: string, secrets: Array<string | undefined> = []): string {
  let out = text;
  const unique = [...new Set(secrets.filter((secret): secret is string => !!secret && secret.length >= 6))];
  unique.sort((a, b) => b.length - a.length);
  for (const secret of unique) out = out.split(secret).join("[redacted]");
  for (const pattern of SECRET_PATTERNS) out = out.replace(pattern, "[redacted]");
  return out;
}

export function logApiError(input: {
  route: string;
  error: unknown;
  statusCode?: number;
  provider?: string;
  model?: string;
  artifact?: string;
  durationMs?: number;
  secrets?: Array<string | undefined>;
}): void {
  const name = input.error instanceof Error ? input.error.name : "Error";
  const raw = input.error instanceof Error ? input.error.message : String(input.error);
  const message = redactSecrets(`${name}: ${raw}`, input.secrets);
  console.error(
    JSON.stringify({
      route: input.route,
      statusCode: input.statusCode ?? null,
      provider: input.provider ?? null,
      model: input.model ?? null,
      artifact: input.artifact ?? null,
      durationMs: input.durationMs ?? null,
      message,
    }),
  );
}
