import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

import { SENTRY_TUNNEL_PATH } from "./src/lib/observability/sentry-tunnel";

/**
 * A CSP com nonce fica em src/proxy.ts. Um segundo header CSP aqui
 * cruzaria com o do proxy e recolocaria 'unsafe-inline' nos scripts.
 * frame-src e object-src com blob: também estão no proxy, para a prévia do CV.
 */
const securityHeaders = [
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
  experimental: {
    // O proxy do next dev corta a rota em 30s e o navegador mostra
    // net::ERR_EMPTY_RESPONSE. Modelo gratuito passa disso. 130s fica
    // acima do prazo da geração (100s) e do maxDuration (120s).
    proxyTimeout: 130_000,
  },
  partialPrefetching: true,
  // unpdf traz o pdf.js; manter fora do bundle do servidor.
  serverExternalPackages: ["unpdf", "@react-pdf/renderer", "postgres"],
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

const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;
const uploadSourceMaps = Boolean(sentryAuthToken);

/** Projeto SaaS já criado. O DSN e o token continuam só em variável de ambiente. */
const SENTRY_ORG = process.env.SENTRY_ORG || "amador-gabriel-rc";
const SENTRY_PROJECT = process.env.SENTRY_PROJECT || "match-cv";

export default withSentryConfig(nextConfig, {
  org: SENTRY_ORG,
  project: SENTRY_PROJECT,
  authToken: sentryAuthToken,
  silent: !process.env.CI,
  tunnelRoute: SENTRY_TUNNEL_PATH,
  widenClientFileUpload: uploadSourceMaps,
  telemetry: false,
  sourcemaps: {
    disable: !uploadSourceMaps,
  },
  release: {
    create: uploadSourceMaps,
    finalize: uploadSourceMaps,
  },
  // O @vercel/otel já instrumenta o servidor. Este hook injetaria outro tracing.
  buildTimeInstrumentation: false,
  errorHandler: (error) => {
    if (sentryAuthToken) throw error;
    console.warn(`Sentry build: ${error.message}`);
  },
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
  },
});
