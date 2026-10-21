import { SpanStatusCode, trace, type Tracer } from "@opentelemetry/api";

import { modelSpanAttributes, sanitizeModelCallContext, type ModelCallContext } from "./telemetry-context";

/** Span com os cinco atributos permitidos. O erro não é gravado: a mensagem pode trazer a chave. */
export async function withModelSpan<T>(input: object, fn: () => Promise<T>, tracer: Tracer = trace.getTracer("matchcv")): Promise<T> {
  const context: ModelCallContext = sanitizeModelCallContext(input);
  return tracer.startActiveSpan(
    `matchcv.${context.artifact}`,
    { attributes: modelSpanAttributes(context) },
    async (span) => {
      try {
        return await fn();
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        span.end();
      }
    },
  );
}
