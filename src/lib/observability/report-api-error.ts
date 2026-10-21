import "server-only";

import * as Sentry from "@sentry/nextjs";

import { buildApiErrorReport, type ApiErrorInput } from "./api-error-report";
import { isSentryEnabled } from "./sentry-env";

/** Envia o erro já mascarado. Sem DSN, não faz nada. */
export async function reportApiError(input: ApiErrorInput): Promise<void> {
  if (!isSentryEnabled()) return;
  const report = buildApiErrorReport(input);
  Sentry.withScope((scope) => {
    scope.setLevel(report.level);
    scope.setTag("route", report.tags.route);
    scope.setTag("artifact", report.tags.artifact);
    scope.setTag("provider", report.tags.provider);
    scope.setTag("model", report.tags.model);
    scope.setTag("status_code", report.tags.status_code);
    const error = new Error(report.message);
    error.name = report.name;
    if (report.stack) error.stack = report.stack;
    Sentry.captureException(error);
  });
  await Sentry.flush(2_000);
}
