"use client";

import { useRef, useState } from "react";

import { concurrencyForProvider, mapWithConcurrency, RETRY_ATTEMPTS, retryAsync, retryDelayMs } from "@/lib/async/pool";
import { ApiError, fetchBrief, fetchSalary, generate, isRetryableClientError, parseResume, type GeneratePayload, type Results } from "@/lib/client/api";
import { ARTIFACTS, type Artifact } from "@/lib/schemas/outputs";
import { DEFAULT_OUTPUT_SELECTION, processingStepsFor } from "@/lib/schemas/requests";

import { FormStep } from "./form-step";
import { ProcessingStep } from "./processing-step";
import { canViewPartialResults, createStepStates, processingOutcome, reduceStep, retryStep, retryWaitMessage, type StepEvent } from "./processing-state";
import { ResultsStep } from "./results-step";
import type { FormValues, StepId, StepState } from "./types";

type Phase = "form" | "processing" | "results";

const EARLY_STEPS: readonly StepId[] = ["brief", "cv", "salary"];
const LATER_STEPS: readonly StepId[] = ["email", "cover-letter", "interview"];

function isArtifact(id: StepId): id is Artifact {
  return (ARTIFACTS as readonly string[]).includes(id);
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
  const [steps, setSteps] = useState<StepState[]>(() => createStepStates(processingStepsFor(DEFAULT_OUTPUT_SELECTION)));
  const [results, setResults] = useState<Results>({});
  const [regenerating, setRegenerating] = useState<StepId | null>(null);
  const payloadRef = useRef<GeneratePayload | null>(null);
  const valuesRef = useRef<FormValues | null>(null);
  const briefFlight = useRef<Promise<void> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stepsRef = useRef(steps);

  function dispatch(event: StepEvent) {
    const next = reduceStep(stepsRef.current, event);
    stepsRef.current = next;
    setSteps(next);
  }

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

  async function runWithRetry<T>(id: StepId, fn: (attempt: number) => Promise<T>, signal?: AbortSignal): Promise<T> {
    return retryAsync(
      (attempt) => {
        dispatch({ type: "start", id });
        return fn(attempt);
      },
      {
        attempts: RETRY_ATTEMPTS,
        signal,
        shouldRetry: (error) => !signal?.aborted && isRetryableClientError(error),
        delayMs: (error, attempt) => retryDelayMs(attempt, error instanceof ApiError ? error.retryAfterSec : undefined),
        onRetry: ({ nextAttempt, delayMs, error }) => {
          const seconds = Math.max(1, Math.ceil(delayMs / 1000));
          const providerMessage = error instanceof ApiError && error.status === 429 ? error.message : undefined;
          dispatch({
            type: "retry-wait",
            id,
            detail: retryWaitMessage({ seconds, nextAttempt, attempts: RETRY_ATTEMPTS, providerMessage }),
          });
        },
      },
    );
  }

  async function runArtifact(artifact: Artifact, payload: GeneratePayload, signal?: AbortSignal, options?: { loadBrief?: boolean }) {
    dispatch({ type: "start", id: artifact });
    try {
      if (options?.loadBrief && artifact !== "cv") await loadBrief(payload, signal);
      if (signal?.aborted) return;
      const result = await runWithRetry(artifact, (attempt) => generate(artifact, payload, signal, attempt), signal);
      if (signal?.aborted) return;
      setResults((prev) => ({ ...prev, [artifact]: result }));
      dispatch({ type: "done", id: artifact });
    } catch (err) {
      if (signal?.aborted) return;
      dispatch({ type: "error", id: artifact, error: errorMessage(err) });
    }
  }

  async function runSalary(payload: GeneratePayload, signal?: AbortSignal) {
    dispatch({ type: "start", id: "salary" });
    try {
      const salary = await runWithRetry(
        "salary",
        (attempt) =>
          fetchSalary(
            {
              jobDescription: payload.jobDescription,
              provider: payload.provider,
              model: payload.model,
              apiKey: payload.apiKey,
              useSavedKey: payload.useSavedKey,
            },
            signal,
            attempt,
          ),
        signal,
      );
      if (signal?.aborted) return;
      setResults((prev) => ({ ...prev, salary }));
      dispatch({ type: "done", id: "salary" });
    } catch (err) {
      if (signal?.aborted) return;
      dispatch({ type: "error", id: "salary", error: errorMessage(err) });
    }
  }

  async function runBrief(payload: GeneratePayload, signal?: AbortSignal) {
    dispatch({ type: "start", id: "brief" });
    try {
      const brief = await runWithRetry("brief", (attempt) => fetchBrief(payload, signal, attempt), signal);
      if (signal?.aborted) return;
      payload.brief = brief;
      briefFlight.current = null;
      dispatch({ type: "done", id: "brief" });
    } catch (err) {
      if (signal?.aborted) return;
      briefFlight.current = null;
      dispatch({
        type: "error",
        id: "brief",
        error: `${errorMessage(err)} E-mail, carta e entrevista seguem sem essa análise.`,
      });
    }
  }

  async function runParse(form: FormValues, payload: GeneratePayload, signal: AbortSignal): Promise<boolean> {
    dispatch({ type: "start", id: "parse" });
    try {
      const cvPromise = parseResume(form.file, signal);
      const achievementsPromise = form.achievementsFile ? parseResume(form.achievementsFile, signal) : Promise.resolve(null);
      const [parsed, achievementsPdf] = await Promise.all([cvPromise, achievementsPromise]);
      if (signal.aborted) return false;
      payload.resumeText = parsed.text;
      payload.achievementsDocument = achievementsPdf?.text ?? "";
      dispatch({ type: "done", id: "parse" });
      return true;
    } catch (err) {
      if (signal.aborted) return false;
      dispatch({ type: "error", id: "parse", error: errorMessage(err) });
      return false;
    }
  }

  async function runOutputs(payload: GeneratePayload, signal: AbortSignal, ids: readonly StepId[]) {
    const wanted = new Set(ids);
    const early = EARLY_STEPS.filter((id) => wanted.has(id));
    const later = LATER_STEPS.filter((id) => wanted.has(id));
    const limit = concurrencyForProvider(payload.provider);
    const runOne = (id: StepId) => {
      if (id === "brief") return runBrief(payload, signal);
      if (id === "salary") return runSalary(payload, signal);
      if (isArtifact(id)) return runArtifact(id, payload, signal);
      return Promise.resolve();
    };
    if (early.length > 0) await mapWithConcurrency(early, limit, runOne);
    if (signal.aborted) return;
    if (later.length > 0) await mapWithConcurrency(later, limit, runOne);
  }

  function maybeFinish() {
    if (abortRef.current?.signal.aborted) return;
    if (processingOutcome(stepsRef.current) === "results") setPhase("results");
  }

  async function start(form: FormValues) {
    const requested = processingStepsFor(form.outputs);
    // O texto do CV fica em memória mesmo se o material não foi marcado, para o botão Gerar de cada aba.
    const stepIds: StepId[] = requested.includes("parse") ? requested : ["parse", ...requested];
    const initial = createStepStates(stepIds, { achievementsFile: Boolean(form.achievementsFile) });
    const payload: GeneratePayload = {
      provider: form.provider,
      model: form.model,
      apiKey: form.useSavedKey ? undefined : form.apiKey,
      useSavedKey: form.useSavedKey,
      resumeText: "",
      jobDescription: form.jobDescription,
      achievements: form.achievements,
      achievementsDocument: "",
    };
    const controller = new AbortController();
    abortRef.current = controller;
    valuesRef.current = form;
    payloadRef.current = payload;
    briefFlight.current = null;
    stepsRef.current = initial;
    setValues(form);
    setResults({});
    setSteps(initial);
    setPhase("processing");

    const { signal } = controller;
    if (stepIds.includes("parse")) {
      const ok = await runParse(form, payload, signal);
      if (!ok || signal.aborted) return;
    }
    await runOutputs(
      payload,
      signal,
      stepIds.filter((id) => id !== "parse"),
    );
    if (!signal.aborted) maybeFinish();
  }

  async function retry(id: StepId) {
    const payload = payloadRef.current;
    const form = valuesRef.current;
    const signal = abortRef.current?.signal;
    if (!payload || !form || !signal || signal.aborted) return;
    const next = retryStep(stepsRef.current, id);
    if (next === stepsRef.current) return;
    stepsRef.current = next;
    setSteps(next);

    if (id === "parse") {
      const ok = await runParse(form, payload, signal);
      if (!ok || signal.aborted) return;
      const pending = stepsRef.current.filter((step) => step.status === "pending").map((step) => step.id);
      if (pending.length > 0) await runOutputs(payload, signal, pending);
    } else if (id === "brief") {
      await runBrief(payload, signal);
    } else if (id === "salary") {
      await runSalary(payload, signal);
    } else if (isArtifact(id)) {
      await runArtifact(id, payload, signal);
    }
    if (!signal.aborted) maybeFinish();
  }

  async function regenerate(step: Artifact | "salary") {
    const payload = payloadRef.current;
    if (!payload) return;
    setRegenerating(step);
    try {
      if (step === "salary") await runSalary(payload);
      else await runArtifact(step, payload, undefined, { loadBrief: true });
    } finally {
      setRegenerating(null);
    }
  }

  function cancel() {
    abortRef.current?.abort();
    setPhase("form");
  }

  function showResults() {
    if (abortRef.current?.signal.aborted) return;
    if (!canViewPartialResults(stepsRef.current)) return;
    setPhase("results");
  }

  function reset() {
    abortRef.current?.abort();
    briefFlight.current = null;
    payloadRef.current = null;
    valuesRef.current = null;
    setResults({});
    setValues((prev) => (prev ? { ...prev, jobDescription: "", achievements: "", achievementsFile: null } : prev));
    const initial = createStepStates(processingStepsFor(DEFAULT_OUTPUT_SELECTION));
    stepsRef.current = initial;
    setSteps(initial);
    setPhase("form");
  }

  if (phase === "processing") return <ProcessingStep steps={steps} onCancel={cancel} onRetry={retry} onContinue={showResults} />;
  if (phase === "results" && values)
    return (
      <ResultsStep
        results={results}
        jobDescription={values.jobDescription}
        steps={steps}
        isMock={Object.values(results).some((result) => result && typeof result === "object" && ("mock" in result ? result.mock : "isMock" in result && result.isMock))}
        regenerating={regenerating}
        onRegenerate={regenerate}
        onEdit={() => setPhase("form")}
        onReset={reset}
      />
    );
  return <FormStep initial={values} onSubmit={start} />;
}
