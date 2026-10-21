import * as Sentry from "@sentry/nextjs";

import { readSentryDsn, readTracesSampleRate } from "@/lib/observability/sentry-env";
import { scrubSentryErrorEvent, scrubSentrySpan, scrubSentryTransaction, sentryDataCollection } from "@/lib/observability/sentry-scrub";

const dsn = readSentryDsn();

if (dsn) {
  Sentry.init({
    dsn,
    // O edge não registra o @vercel/otel. A taxa vale só para os spans do próprio Sentry.
    enableOpenTelemetrySetup: false,
    tracesSampleRate: readTracesSampleRate(),
    dataCollection: sentryDataCollection,
    ignoreSpans: [/\/monitoring/],
    beforeSend: scrubSentryErrorEvent,
    beforeSendTransaction: scrubSentryTransaction,
    beforeSendSpan: scrubSentrySpan,
  });
}
