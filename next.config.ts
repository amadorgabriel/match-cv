import type { NextConfig } from "next";

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
