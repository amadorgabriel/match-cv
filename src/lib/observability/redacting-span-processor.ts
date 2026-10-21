import type { Context } from "@opentelemetry/api";
import { SamplingDecision, TraceIdRatioBasedSampler, type ReadableSpan, type Span, type SpanProcessor } from "@opentelemetry/sdk-trace-base";

import { mentionsSentryTunnel, scrubAttributes, scrubString } from "./sentry-scrub";

interface MutableSpan {
  name: string;
  attributes: Record<string, unknown>;
  events?: Array<{ name: string; attributes?: Record<string, unknown> }>;
}

function asMutable(span: ReadableSpan): MutableSpan {
  return span as unknown as MutableSpan;
}

export function traceIsSampled(traceId: string, ratio: number): boolean {
  if (ratio >= 1) return /^[0-9a-f]{32}$/i.test(traceId);
  if (ratio <= 0) return false;
  const decision = new TraceIdRatioBasedSampler(ratio).shouldSample(undefined as unknown as Context, traceId);
  return decision.decision === SamplingDecision.RECORD_AND_SAMPLED;
}

function spanText(span: ReadableSpan): string {
  const mutable = asMutable(span);
  return `${mutable.name} ${JSON.stringify(mutable.attributes)}`;
}

/** Amostra e mascara o span antes de um exporter. Não cria span novo. */
export class RedactingSpanProcessor implements SpanProcessor {
  private readonly samplerRatio: number;

  constructor(
    private readonly inner: SpanProcessor,
    sampleRate: number,
  ) {
    this.samplerRatio = sampleRate;
  }

  onStart(span: Span, parentContext: Context): void {
    this.inner.onStart(span, parentContext);
  }

  onEnd(span: ReadableSpan): void {
    const traceId = span.spanContext().traceId;
    if (!traceIsSampled(traceId, this.samplerRatio)) return;
    const mutable = asMutable(span);
    if (mentionsSentryTunnel(spanText(span))) return;
    mutable.name = scrubString(mutable.name);
    mutable.attributes = scrubAttributes(mutable.attributes);
    if (mutable.events) {
      mutable.events = mutable.events.map((event) => ({
        ...event,
        name: scrubString(event.name),
        attributes: event.attributes ? scrubAttributes(event.attributes) : undefined,
      }));
    }
    if (mentionsSentryTunnel(spanText(span))) return;
    this.inner.onEnd(span);
  }

  shutdown(): Promise<void> {
    return this.inner.shutdown();
  }

  forceFlush(): Promise<void> {
    return this.inner.forceFlush();
  }
}
