import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
// Só força HTTPS no deploy (Vercel); em `npm start` local o app roda em http://localhost.
const isVercel = process.env.VERCEL === "1";

/**
 * CSP básica sem nonce. Todo o tráfego de IA passa pelas rotas /api do
 * próprio app, então o navegador só fala com a mesma origem (connect-src 'self').
 * 'unsafe-inline' em script-src é exigido pelo Next sem nonce. Para uma CSP
 * mais rígida, migre para nonce via proxy.ts (ver docs do Next: Content Security Policy).
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
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

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  cacheComponents: true,
  partialPrefetching: true,
  // unpdf traz o pdf.js; manter fora do bundle do servidor.
  serverExternalPackages: ["unpdf", "@react-pdf/renderer"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      // Respostas da API nunca vão para cache (podem ter dados pessoais).
      { source: "/api/(.*)", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
