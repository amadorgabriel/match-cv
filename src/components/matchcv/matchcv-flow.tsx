"use client";

import { useRef, useState } from "react";

import { concurrencyForProvider, mapWithConcurrency, RETRY_ATTEMPTS, retryAsync, retryDelayMs } from "@/lib/async/pool";
import { ApiError, fetchSalary, generate, isRetryableClientError, parseResume, type GeneratePayload, type Results } from "@/lib/client/api";
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
  const abortRef = useRef<AbortController | null>(null);

  const setStep = (id: StepId, patch: Partial<StepState>) =>
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  async function runArtifact(artifact: Artifact, payload: GeneratePayload, signal?: AbortSignal) {
    setStep(artifact, { status: "running", error: undefined, detail: undefined });
    try {
      const r = await retryAsync(() => generate(artifact, payload, signal), {
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

  async function runSalary(jobDescription: string, signal?: AbortSignal) {
    setStep("salary", { status: "running", error: undefined });
    try {
      const salary = await fetchSalary(jobDescription, signal);
      setResults((prev) => ({ ...prev, salary }));
      setStep("salary", { status: "done" });
    } catch (err) {
      if (signal?.aborted) return;
      setStep("salary", { status: "error", error: errorMessage(err) });
    }
  }

  async function start(v: FormValues) {
    const stepIds = processingStepsFor(v.outputs);
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
        const cvPromise = parseResume(v.file, signal).then((parsed) => {
          if (parsed.empty) throw new Error("Não encontramos texto no PDF. Ele pode ser uma imagem escaneada.");
          return parsed;
        });
        const achievementsPromise = v.achievementsFile
          ? parseResume(v.achievementsFile, signal).then((parsed) => {
              if (parsed.empty) throw new Error("Não encontramos texto no PDF de conquistas. Ele pode ser uma imagem escaneada.");
              return parsed;
            })
          : Promise.resolve(null);
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
      ...(stepIds.includes("salary") ? [() => runSalary(v.jobDescription, signal)] : []),
    ];
    await mapWithConcurrency(tasks, concurrencyForProvider(v.provider), (task) => task());
    if (!signal.aborted) setPhase("results");
  }

  async function regenerate(step: Artifact | "salary") {
    const payload = payloadRef.current;
    if (!payload) return;
    setRegenerating(step);
    try {
      if (step === "salary") await runSalary(payload.jobDescription);
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
        outputs={values.outputs}
        results={results}
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
