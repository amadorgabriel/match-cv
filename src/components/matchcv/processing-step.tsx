"use client";

import { CheckCircle2Icon, CircleIcon, ClockIcon, LoaderCircleIcon, XCircleIcon } from "lucide-react";
import { useEffect, useRef, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "cn";

import {
  canViewPartialResults,
  liveAnnouncement,
  prefersReducedMotionClass,
  processingHeadline,
  progressPercent,
} from "./processing-state";
import { STEP_STATUS_LABEL, type StepId, type StepState, type StepStatus } from "./types";

function subscribeReducedMotion(onChange: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function reducedMotionSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(subscribeReducedMotion, reducedMotionSnapshot, () => false);
}

export function ProcessingStep({
  steps,
  onCancel,
  onRetry,
  onContinue,
}: {
  steps: StepState[];
  onCancel: () => void;
  onRetry: (id: StepId) => void;
  onContinue: () => void;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const previousStatus = useRef(new Map<StepId, StepStatus>());
  const headline = processingHeadline(steps);
  const progress = progressPercent(steps);
  const busy = steps.some((step) => step.status === "running" || step.status === "retrying");
  const partial = canViewPartialResults(steps);

  useEffect(() => {
    const fresh: StepId[] = [];
    for (const step of steps) {
      if (step.status === "error" && previousStatus.current.get(step.id) !== "error") fresh.push(step.id);
      previousStatus.current.set(step.id, step.status);
    }
    const id = fresh[0];
    if (!id) return;
    document.getElementById(`retry-${id}`)?.focus();
  }, [steps]);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-8 py-10 text-center">
      <div className="relative flex size-20 items-center justify-center" aria-hidden="true">
        {busy && !reducedMotion ? <span className="bg-primary/10 absolute inset-0 animate-ping rounded-full motion-reduce:hidden" /> : null}
        {busy ? (
          <span className={cn("inline-flex", prefersReducedMotionClass(reducedMotion, "animate-spin"), "motion-reduce:animate-none")}>
            <LoaderCircleIcon className="text-primary size-10" />
          </span>
        ) : steps.some((step) => step.status === "error") ? (
          <XCircleIcon className="text-destructive size-10" />
        ) : (
          <CheckCircle2Icon className="size-10 text-emerald-600" />
        )}
      </div>

      <div className="min-h-14">
        <h1 className="text-xl font-semibold">{headline.title}</h1>
        {headline.messages.map((message) => (
          <p
            key={message.key}
            className={cn(
              "text-muted-foreground mt-2",
              prefersReducedMotionClass(reducedMotion, "animate-in fade-in slide-in-from-bottom-1 duration-500"),
              "motion-reduce:animate-none",
            )}
          >
            {message.text}
          </p>
        ))}
      </div>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {liveAnnouncement(steps)}
      </p>

      <div
        className="bg-muted h-2 w-full overflow-hidden rounded-full"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progresso do processamento"
      >
        <div
          className={cn(
            "bg-primary h-full",
            prefersReducedMotionClass(reducedMotion, "transition-all duration-500"),
            "motion-reduce:transition-none",
          )}
          style={{ width: `${progress}%` }}
        />
      </div>

      <Card className="w-full text-left">
        <CardContent>
          <ul className="flex flex-col gap-3" aria-label="Etapas do processamento">
            {steps.map((step) => (
              <li key={step.id} className="flex items-start gap-3 text-sm" data-step={step.id} data-status={step.status}>
                <StepIcon status={step.status} reducedMotion={reducedMotion} />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className={step.status === "pending" ? "text-muted-foreground" : "font-medium"}>{step.label}</span>
                    <span className={step.status === "error" ? "text-destructive text-xs" : "text-muted-foreground text-xs"}>
                      {STEP_STATUS_LABEL[step.status]}
                    </span>
                  </span>
                  {step.status === "running" || step.status === "retrying" ? (
                    step.detail ? <span className="text-muted-foreground text-xs">{step.detail}</span> : null
                  ) : null}
                  {step.status === "error" ? (
                    <span className="flex flex-col items-start gap-2">
                      <span className="text-destructive text-xs">{step.error ?? "Falhou."}</span>
                      <Button
                        id={`retry-${step.id}`}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onRetry(step.id)}
                        aria-label={`Tentar de novo: ${step.label}`}
                      >
                        Tentar de novo
                      </Button>
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {partial ? (
          <Button type="button" onClick={onContinue}>
            Ver resultados
          </Button>
        ) : null}
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar e voltar ao formulário
        </Button>
      </div>
    </div>
  );
}

function StepIcon({ status, reducedMotion }: { status: StepStatus; reducedMotion: boolean }) {
  if (status === "done") return <CheckCircle2Icon aria-hidden="true" className="mt-0.5 size-4 text-emerald-600" />;
  if (status === "running") {
    return (
      <span
        aria-hidden="true"
        className={cn("mt-0.5 inline-flex", prefersReducedMotionClass(reducedMotion, "animate-spin"), "motion-reduce:animate-none")}
      >
        <LoaderCircleIcon className="text-primary size-4" />
      </span>
    );
  }
  if (status === "retrying") return <ClockIcon aria-hidden="true" className="text-primary mt-0.5 size-4" />;
  if (status === "error") return <XCircleIcon aria-hidden="true" className="text-destructive mt-0.5 size-4" />;
  return <CircleIcon aria-hidden="true" className="text-muted-foreground mt-0.5 size-4" />;
}
