import * as Sentry from "@sentry/nextjs";

import { readSentryDsn } from "@/lib/observability/sentry-env";
import { scrubSentryErrorEvent, scrubSentrySpan, scrubSentryTransaction, sentryDataCollection } from "@/lib/observability/sentry-scrub";

const dsn = readSentryDsn();

if (dsn) {
  Sentry.init({
    dsn,
    // O @vercel/otel já registrou o provider. Ligar o setup do Sentry
    // criaria outro e ainda desligaria o tracing de fetch do Next.
    enableOpenTelemetrySetup: false,
    includeLocalVariables: false,
    dataCollection: sentryDataCollection,
    integrations: (integrations) => {
      const rest = integrations.filter((integration) => integration.name !== "VercelAI");
      if (rest.some((integration) => integration.name === "OpenTelemetry")) return rest;
      return [...rest, Sentry.openTelemetryIntegration()];
    },
    beforeSend: scrubSentryErrorEvent,
    beforeSendTransaction: scrubSentryTransaction,
    beforeSendSpan: scrubSentrySpan,
  });
}
