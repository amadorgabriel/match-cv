/**
 * Mascaramento de chaves, sem `server-only`, para o log e para o Sentry
 * (o cliente também precisa limpar o evento antes do envio).
 */
const SECRET_PATTERNS = [
  /sk-(?:ant-|or-)?[A-Za-z0-9_-]{8,}/g,
  /AIza[0-9A-Za-z_-]{10,}/g,
  /Bearer\s+[A-Za-z0-9._~+/=-]{8,}/gi,
  /(?:api[_-]?key|app[_-]?key|x-api-key|x-goog-api-key|authorization)\s*[=:]\s*["']?[^\s"'&,}]+/gi,
  /postgres(?:ql)?:\/\/[^\s"'<>]+/gi,
  /(?:KEY_ENCRYPTION_SECRET(?:_PREVIOUS|_V\d+)?|BETTER_AUTH_SECRET|DATABASE_URL)\s*[=:]\s*["']?[^\s"'&,}]+/gi,
];

export function redactSecrets(text: string, secrets: Array<string | undefined> = []): string {
  let out = text;
  const unique = [...new Set(secrets.filter((secret): secret is string => !!secret && secret.length >= 6))];
  unique.sort((a, b) => b.length - a.length);
  for (const secret of unique) out = out.split(secret).join("[redacted]");
  for (const pattern of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    out = out.replace(pattern, "[redacted]");
  }
  return out;
}
