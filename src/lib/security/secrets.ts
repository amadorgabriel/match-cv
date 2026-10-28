/**
 * Mascaramento de chaves, sem `server-only`, para o log e para o Sentry
 * (o cliente também precisa limpar o evento antes do envio).
 */
const SECRET_PATTERNS = [
  /sk-(?:ant-|or-)?[A-Za-z0-9_-]{8,}/g,
  /AIza[0-9A-Za-z_-]{10,}/g,
  /Bearer\s+[A-Za-z0-9._~+/=-]{8,}/gi,
  /(?:api[_-]?key|app[_-]?key|x-api-key|x-goog-api-key|authorization|typesafe[_-]?api[_-]?key)\s*[=:]\s*["']?[^\s"'&,}]+/gi,
];

/** Segredos do servidor. Acesso dinâmico para a chave não entrar no bundle do browser. */
function configuredSecrets(): string[] {
  const typesafe = process.env["TYPESAFE_API_KEY"];
  return typesafe && typesafe.length >= 6 ? [typesafe] : [];
}

export function redactSecrets(text: string, secrets: Array<string | undefined> = []): string {
  let out = text;
  const unique = [
    ...new Set([...secrets, ...configuredSecrets()].filter((secret): secret is string => !!secret && secret.length >= 6)),
  ];
  unique.sort((a, b) => b.length - a.length);
  for (const secret of unique) out = out.split(secret).join("[redacted]");
  for (const pattern of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    out = out.replace(pattern, "[redacted]");
  }
  return out;
}
