import * as Sentry from "@sentry/nextjs";

import { readSentryDsn, readTracesSampleRate } from "@/lib/observability/sentry-env";
import { scrubSentryErrorEvent, scrubSentrySpan, scrubSentryTransaction, sentryDataCollection } from "@/lib/observability/sentry-scrub";
import { SENTRY_TUNNEL_PATH } from "@/lib/observability/sentry-tunnel";

const dsn = readSentryDsn({ NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN });

if (dsn) {
  Sentry.init({
    dsn,
    tunnel: SENTRY_TUNNEL_PATH,
    tracesSampleRate: readTracesSampleRate({
      NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
    }),
    dataCollection: sentryDataCollection,
    ignoreSpans: [/\/monitoring/],
    beforeSend: scrubSentryErrorEvent,
    beforeSendTransaction: scrubSentryTransaction,
    beforeSendSpan: scrubSentrySpan,
  });
}

export function onRouterTransitionStart(href: string, navigationType: string): void {
  if (!readSentryDsn({ NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN })) return;
  Sentry.captureRouterTransitionStart(href, navigationType);
}
