/**
 * CSP da página. O nonce entra em script-src no lugar de 'unsafe-inline'.
 *
 * style-src mantém 'unsafe-inline' porque atributo style (React) não aceita
 * nonce. Só elementos <style> e <script> recebem o nonce do Next.
 * A prévia do CV usa iframe com blob:, então frame-src e object-src
 * permitem blob: e nada além disso.
 * connect-src continua 'self'. O browser fala com o Sentry pelo túnel
 * /monitoring, no mesmo origin.
 */
export function contentSecurityPolicy(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  const isVercel = process.env.VERCEL === "1";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-src 'self' blob:",
    "object-src blob:",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isVercel ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}
