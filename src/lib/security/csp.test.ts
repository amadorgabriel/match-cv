import { describe, expect, it } from "vitest";

import { contentSecurityPolicy } from "./csp";

describe("contentSecurityPolicy", () => {
  it("usa nonce nos scripts e libera só blob: na prévia do PDF", () => {
    const csp = contentSecurityPolicy("abc+/=nonce");
    expect(csp).toContain("script-src 'self' 'nonce-abc+/=nonce' 'strict-dynamic'");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(csp).toContain("frame-src 'self' blob:");
    expect(csp).toContain("object-src blob:");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).not.toContain("sentry.io");
    expect(csp).not.toContain("upstash");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });
});
