import type { Instrumentation } from "next";
import * as Sentry from "@sentry/nextjs";

import { readSentryDsn } from "@/lib/observability/sentry-env";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerNodeTelemetry } = await import("@/lib/ai/otel-register");
    await registerNodeTelemetry();
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  if (!readSentryDsn()) return;
  Sentry.captureRequestError(error, request, context);
};
