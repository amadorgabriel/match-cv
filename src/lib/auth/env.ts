export function isDatabaseConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.DATABASE_URL?.trim());
}

/** Better Auth só liga com Postgres e um segredo de pelo menos 32 caracteres. */
export function isAuthConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  const secret = env.BETTER_AUTH_SECRET?.trim();
  return isDatabaseConfigured(env) && Boolean(secret && secret.length >= 32);
}

export function authProviderFlags(env: NodeJS.ProcessEnv = process.env) {
  const authEnabled = isAuthConfigured(env);
  return {
    authEnabled,
    database: isDatabaseConfigured(env),
    magicLink: authEnabled,
    github: authEnabled && Boolean(env.GITHUB_CLIENT_ID?.trim() && env.GITHUB_CLIENT_SECRET?.trim()),
    google: authEnabled && Boolean(env.GOOGLE_CLIENT_ID?.trim() && env.GOOGLE_CLIENT_SECRET?.trim()),
    emailDelivery: Boolean(env.RESEND_API_KEY?.trim() && env.EMAIL_FROM?.trim()),
  };
}

export function appBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  if (env.BETTER_AUTH_URL?.trim()) return env.BETTER_AUTH_URL.trim().replace(/\/$/, "");
  if (env.NEXT_PUBLIC_APP_URL?.trim()) return env.NEXT_PUBLIC_APP_URL.trim().replace(/\/$/, "");
  if (env.VERCEL_URL?.trim()) return `https://${env.VERCEL_URL.trim()}`;
  return "http://localhost:3000";
}
