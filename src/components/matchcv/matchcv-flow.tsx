"use client";

import { useRef, useState } from "react";

import { concurrencyForProvider, mapWithConcurrency, RETRY_ATTEMPTS, retryAsync, retryDelayMs } from "@/lib/async/pool";
import { ApiError, fetchBrief, fetchSalary, generate, isRetryableClientError, parseResume, type GeneratePayload, type Results } from "@/lib/client/api";
import { analyzeJob, salaryProgressMessages } from "@/lib/salary/job";
import { ARTIFACTS, type Artifact } from "@/lib/schemas/outputs";
import { DEFAULT_OUTPUT_SELECTION, processingStepsFor } from "@/lib/schemas/requests";

import { FormStep } from "./form-step";
import { ProcessingStep } from "./processing-step";
import { ResultsStep } from "./results-step";
import { STEP_LABELS, type FormValues, type StepId, type StepState } from "./types";

type Phase = "form" | "processing" | "results";

function isArtifact(id: StepId): id is Artifact {
  return (ARTIFACTS as readonly string[]).includes(id);
}

function toStepStates(ids: StepId[], achievementsFile: File | null): StepState[] {
  return ids.map((id) => ({
    id,
    label: id === "parse" && achievementsFile ? "Ler o currículo e as conquistas" : STEP_LABELS[id],
    status: "pending",
  }));
}

function errorMessage(err: unknown): string {
  return err instanceof Error && err.message ? err.message : "Falhou.";
}

/**
 * Fluxo das telas 2 a 4 (formulário, processamento, resultados).
 * Tudo fica em memória: ao recarregar a página, os dados somem.
 */
export function MatchCvFlow() {
  const [phase, setPhase] = useState<Phase>("form");
  const [values, setValues] = useState<FormValues | null>(null);
  const [steps, setSteps] = useState<StepState[]>(() => toStepStates(processingStepsFor(DEFAULT_OUTPUT_SELECTION), null));
  const [results, setResults] = useState<Results>({});
  const [regenerating, setRegenerating] = useState<StepId | null>(null);
  const payloadRef = useRef<GeneratePayload | null>(null);
  const briefFlight = useRef<Promise<void> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const setStep = (id: StepId, patch: Partial<StepState>) =>
    setSteps((prev) => {
      if (!prev.some((step) => step.id === id)) {
        return [...prev, { id, label: STEP_LABELS[id], status: "pending", ...patch }];
      }
      return prev.map((step) => (step.id === id ? { ...step, ...patch } : step));
    });

  function loadBrief(payload: GeneratePayload, signal?: AbortSignal): Promise<void> {
    if (payload.brief) return Promise.resolve();
    if (!briefFlight.current) {
      const flight = fetchBrief(payload, signal)
        .then((brief) => {
          payload.brief = brief;
        })
        .catch(() => {
          // Sem o perfil, e-mail, carta e entrevista seguem com o texto bruto.
        })
        .finally(() => {
          if (briefFlight.current === flight) briefFlight.current = null;
        });
      briefFlight.current = flight;
    }
    return briefFlight.current;
  }

  async function runArtifact(artifact: Artifact, payload: GeneratePayload, signal?: AbortSignal) {
    setStep(artifact, { status: "running", error: undefined, detail: undefined });
    try {
      if (artifact !== "cv") await loadBrief(payload, signal);
      if (signal?.aborted) return;
      const r = await retryAsync((attempt) => generate(artifact, payload, signal, attempt), {
        attempts: RETRY_ATTEMPTS,
        signal,
        shouldRetry: (error) => !signal?.aborted && isRetryableClientError(error),
        delayMs: (error, attempt) => retryDelayMs(attempt, error instanceof ApiError ? error.retryAfterSec : undefined),
        onRetry: ({ nextAttempt, delayMs, error }) => {
          const seconds = Math.max(1, Math.ceil(delayMs / 1000));
          const base = error instanceof ApiError && error.status === 429
            ? error.message
            : `Tentando de novo em ${seconds} s`;
          setStep(artifact, { detail: `${base} (tentativa ${nextAttempt} de ${RETRY_ATTEMPTS})` });
        },
      });
      setResults((prev) => ({ ...prev, [artifact]: r }));
      setStep(artifact, { status: "done", detail: undefined });
    } catch (err) {
      if (signal?.aborted) return;
      setStep(artifact, { status: "error", error: errorMessage(err), detail: undefined });
    }
  }

  async function runSalary(payload: GeneratePayload, signal?: AbortSignal) {
    const messages = salaryProgressMessages(analyzeJob({ jobDescription: payload.jobDescription }));
    let index = 0;
    let hold = false;
    setStep("salary", { status: "running", error: undefined, detail: messages[0] });
    const timer = setInterval(() => {
      if (hold) return;
      index = Math.min(index + 1, messages.length - 1);
      setStep("salary", { detail: messages[index] });
    }, 1600);
    try {
      const salary = await retryAsync(
        (attempt) => {
          hold = false;
          return fetchSalary(
            {
              jobDescription: payload.jobDescription,
              provider: payload.provider,
              model: payload.model,
              apiKey: payload.apiKey,
            },
            signal,
            attempt,
          );
        },
        {
          attempts: RETRY_ATTEMPTS,
          signal,
          shouldRetry: (error) => !signal?.aborted && isRetryableClientError(error),
          delayMs: (error, attempt) => retryDelayMs(attempt, error instanceof ApiError ? error.retryAfterSec : undefined),
          onRetry: ({ nextAttempt, delayMs, error }) => {
            hold = true;
            const seconds = Math.max(1, Math.ceil(delayMs / 1000));
            const base = error instanceof ApiError && error.status === 429 ? error.message : `Tentando de novo em ${seconds} s`;
            setStep("salary", { detail: `${base} (tentativa ${nextAttempt} de ${RETRY_ATTEMPTS})` });
          },
        },
      );
      setResults((prev) => ({ ...prev, salary }));
      setStep("salary", { status: "done", detail: undefined });
    } catch (err) {
      if (signal?.aborted) return;
      setStep("salary", { status: "error", error: errorMessage(err), detail: undefined });
    } finally {
      clearInterval(timer);
    }
  }

  async function start(v: FormValues) {
    const requested = processingStepsFor(v.outputs);
    // O texto do CV fica em memória mesmo se o material não foi marcado, para o botão Gerar de cada aba.
    const stepIds: StepId[] = requested.includes("parse") ? requested : ["parse", ...requested];
    setValues(v);
    setResults({});
    setSteps(toStepStates(stepIds, v.achievementsFile));
    setPhase("processing");

    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;

    let resumeText = "";
    let achievementsDocument = "";
    if (stepIds.includes("parse")) {
      setStep("parse", { status: "running" });
      try {
        const cvPromise = parseResume(v.file, signal);
        const achievementsPromise = v.achievementsFile ? parseResume(v.achievementsFile, signal) : Promise.resolve(null);
        const [parsed, achievementsPdf] = await Promise.all([cvPromise, achievementsPromise]);
        resumeText = parsed.text;
        achievementsDocument = achievementsPdf?.text ?? "";
        setStep("parse", { status: "done" });
      } catch (err) {
        if (signal.aborted) return;
        setStep("parse", { status: "error", error: errorMessage(err) });
        for (const id of stepIds.slice(1)) setStep(id, { status: "error", error: "Pulado" });
        setTimeout(() => setPhase("form"), 2500);
        return;
      }
    }

    briefFlight.current = null;
    const payload: GeneratePayload = {
      provider: v.provider,
      model: v.model,
      apiKey: v.apiKey,
      resumeText,
      jobDescription: v.jobDescription,
      achievements: v.achievements,
      achievementsDocument,
    };
    payloadRef.current = payload;

    const tasks: Array<() => Promise<void>> = [
      ...stepIds.filter(isArtifact).map((artifact) => () => runArtifact(artifact, payload, signal)),
      ...(stepIds.includes("salary") ? [() => runSalary(payload, signal)] : []),
    ];
    await mapWithConcurrency(tasks, concurrencyForProvider(v.provider), (task) => task());
    if (!signal.aborted) setPhase("results");
  }

  async function regenerate(step: Artifact | "salary") {
    const payload = payloadRef.current;
    if (!payload) return;
    setRegenerating(step);
    try {
      if (step === "salary") await runSalary(payload);
      else await runArtifact(step, payload);
    } finally {
      setRegenerating(null);
    }
  }

  function cancel() {
    abortRef.current?.abort();
    setPhase("form");
  }

  function reset() {
    briefFlight.current = null;
    payloadRef.current = null;
    setResults({});
    setValues((prev) => (prev ? { ...prev, jobDescription: "", achievements: "", achievementsFile: null } : prev));
    setSteps(toStepStates(processingStepsFor(DEFAULT_OUTPUT_SELECTION), null));
    setPhase("form");
  }

  if (phase === "processing") return <ProcessingStep steps={steps} onCancel={cancel} />;
  if (phase === "results" && values)
    return (
      <ResultsStep
        results={results}
        jobDescription={values.jobDescription}
        steps={steps}
        isMock={Object.values(results).some((r) => r && typeof r === "object" && ("mock" in r ? r.mock : "isMock" in r && r.isMock))}
        regenerating={regenerating}
        onRegenerate={regenerate}
        onEdit={() => setPhase("form")}
        onReset={reset}
      />
    );
  return <FormStep initial={values} onSubmit={start} />;
}
