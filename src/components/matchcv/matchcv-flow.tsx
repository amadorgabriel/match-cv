"use client";

import { useRef, useState } from "react";

import { fetchSalary, generate, type GeneratePayload, parseResume, type Results } from "@/lib/client/api";
import { ARTIFACTS, type Artifact } from "@/lib/schemas/outputs";

import { FormStep } from "./form-step";
import { ProcessingStep } from "./processing-step";
import { ResultsStep } from "./results-step";
import { STEP_LABELS, type FormValues, type StepId, type StepState } from "./types";

type Phase = "form" | "processing" | "results";

const ALL_STEPS: StepId[] = ["parse", ...ARTIFACTS, "salary"];

function initialSteps(): StepState[] {
  return ALL_STEPS.map((id) => ({ id, label: STEP_LABELS[id], status: "pending" }));
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
  const [steps, setSteps] = useState<StepState[]>(initialSteps);
  const [results, setResults] = useState<Results>({});
  const [regenerating, setRegenerating] = useState<StepId | null>(null);
  const payloadRef = useRef<GeneratePayload | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const setStep = (id: StepId, patch: Partial<StepState>) =>
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  async function runArtifact(artifact: Artifact, payload: GeneratePayload, signal?: AbortSignal) {
    setStep(artifact, { status: "running", error: undefined });
    try {
      const r = await generate(artifact, payload, signal);
      setResults((prev) => ({ ...prev, [artifact]: r }));
      setStep(artifact, { status: "done" });
    } catch (err) {
      if (signal?.aborted) return;
      setStep(artifact, { status: "error", error: errorMessage(err) });
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
    setValues(v);
    setResults({});
    setSteps(initialSteps());
    setPhase("processing");

    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;

    setStep("parse", { status: "running" });
    let resumeText: string;
    try {
      const parsed = await parseResume(v.file, signal);
      if (parsed.empty) throw new Error("Não encontramos texto no PDF. Ele pode ser uma imagem escaneada.");
      resumeText = parsed.text;
      setStep("parse", { status: "done" });
    } catch (err) {
      if (signal.aborted) return;
      setStep("parse", { status: "error", error: errorMessage(err) });
      for (const id of ALL_STEPS.slice(1)) setStep(id, { status: "error", error: "Pulado" });
      setTimeout(() => setPhase("form"), 2500);
      return;
    }

    const payload: GeneratePayload = {
      provider: v.provider,
      model: v.model,
      apiKey: v.apiKey,
      resumeText,
      jobDescription: v.jobDescription,
      achievements: v.achievements,
    };
    payloadRef.current = payload;

    await Promise.all([
      ...ARTIFACTS.map((a) => runArtifact(a, payload, signal)),
      runSalary(v.jobDescription, signal),
    ]);
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
    setSteps(initialSteps());
    setValues((prev) => (prev ? { ...prev, jobDescription: "", achievements: "" } : prev));
    setPhase("form");
  }

  if (phase === "processing") return <ProcessingStep steps={steps} onCancel={cancel} />;
  if (phase === "results")
    return (
      <ResultsStep
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
