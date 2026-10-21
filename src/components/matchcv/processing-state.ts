import { STEP_LABELS, STEP_MESSAGES, type StepId, type StepState, type StepStatus } from "./types";

export interface CreateStepOptions {
  /** PDF opcional de conquistas muda o texto da leitura do currículo. */
  achievementsFile?: boolean;
}

export function createStepStates(ids: readonly StepId[], options?: CreateStepOptions): StepState[] {
  return ids.map((id) => ({
    id,
    label: id === "parse" && options?.achievementsFile ? "Ler o currículo e as conquistas" : STEP_LABELS[id],
    status: "pending",
  }));
}

export type StepEvent =
  | { type: "start"; id: StepId }
  | { type: "retry-wait"; id: StepId; detail: string }
  | { type: "done"; id: StepId }
  | { type: "error"; id: StepId; error: string };

function withStep(steps: readonly StepState[], id: StepId, patch: Partial<StepState>): StepState[] {
  if (!steps.some((step) => step.id === id)) {
    return [...steps, { id, label: STEP_LABELS[id], status: "pending", ...patch }];
  }
  return steps.map((step) => (step.id === id ? { ...step, ...patch } : step));
}

/** Atualiza uma etapa e deixa as outras como estão. */
export function reduceStep(steps: readonly StepState[], event: StepEvent): StepState[] {
  switch (event.type) {
    case "start":
      return withStep(steps, event.id, { status: "running", error: undefined, detail: undefined });
    case "retry-wait":
      return withStep(steps, event.id, { status: "retrying", detail: event.detail, error: undefined });
    case "done":
      return withStep(steps, event.id, { status: "done", error: undefined, detail: undefined });
    case "error":
      return withStep(steps, event.id, { status: "error", error: event.error, detail: undefined });
    default: {
      const exhaustive: never = event;
      return exhaustive;
    }
  }
}

/**
 * Recoloca só a etapa com erro em andamento.
 * Etapa pendente, em andamento, aguardando retry ou concluída não muda.
 */
export function retryStep(steps: readonly StepState[], id: StepId): StepState[] {
  const target = steps.find((step) => step.id === id);
  if (!target || target.status !== "error") return steps as StepState[];
  return reduceStep(steps, { type: "start", id });
}

const PROGRESS_WEIGHT: Record<StepStatus, number> = {
  pending: 0,
  running: 0.5,
  retrying: 0.5,
  done: 1,
  error: 0,
};

/** Percentual a partir do status de cada etapa. Não avança com o relógio. */
export function progressPercent(steps: readonly Pick<StepState, "status">[]): number {
  if (steps.length === 0) return 0;
  const score = steps.reduce((sum, step) => sum + PROGRESS_WEIGHT[step.status], 0);
  return Math.round((score / steps.length) * 100);
}

export function stageMessage(step: Pick<StepState, "id" | "label" | "status" | "detail">): string {
  if (step.status === "retrying" && step.detail) return step.detail;
  if (step.id === "parse" && step.label.includes("conquistas")) return "Lendo o currículo e as conquistas…";
  return STEP_MESSAGES[step.id];
}

/** Mensagens das etapas que estão em andamento ou aguardando retry, na ordem do fluxo. */
export function activeStageMessages(steps: readonly StepState[]): string[] {
  return steps.filter((step) => step.status === "running" || step.status === "retrying").map((step) => stageMessage(step));
}

export interface HeadlineMessage {
  key: string;
  text: string;
}

export function processingHeadline(steps: readonly StepState[]): { title: string; messages: HeadlineMessage[] } {
  const active = steps.filter((step) => step.status === "running" || step.status === "retrying");
  if (active.length > 0) {
    return {
      title: "Gerando seus materiais",
      messages: active.map((step) => ({ key: step.id, text: stageMessage(step) })),
    };
  }
  if (steps.some((step) => step.status === "error")) {
    return {
      title: "Algumas etapas falharam",
      messages: steps.filter((step) => step.status === "error").map((step) => ({ key: step.id, text: statusAnnouncement(step) })),
    };
  }
  if (steps.length > 0 && steps.every((step) => step.status === "done")) {
    return { title: "Tudo pronto", messages: [{ key: "done", text: "Abrindo os resultados…" }] };
  }
  return { title: "Gerando seus materiais", messages: [{ key: "prepare", text: "Preparando as etapas…" }] };
}

export function processingOutcome(steps: readonly Pick<StepState, "status">[]): "results" | "processing" {
  if (steps.length > 0 && steps.every((step) => step.status === "done")) return "results";
  return "processing";
}

const OUTPUT_STEP: ReadonlySet<StepId> = new Set(["cv", "email", "cover-letter", "interview", "salary"]);

/** Há material pronto e alguma etapa parada em erro, sem trabalho pendente. */
export function canViewPartialResults(steps: readonly StepState[]): boolean {
  const busy = steps.some((step) => step.status === "pending" || step.status === "running" || step.status === "retrying");
  if (busy) return false;
  const hasOutput = steps.some((step) => OUTPUT_STEP.has(step.id) && step.status === "done");
  const hasError = steps.some((step) => step.status === "error");
  return hasOutput && hasError;
}

export function statusAnnouncement(step: StepState): string {
  switch (step.status) {
    case "pending":
      return `${step.label}: pendente.`;
    case "running":
      return `${step.label}: em andamento.`;
    case "retrying":
      return `${step.label}: aguardando retry.${step.detail ? ` ${step.detail}` : ""}`;
    case "done":
      return `${step.label}: concluído.`;
    case "error":
      return `${step.label}: erro. ${step.error ?? "Tente de novo."}`;
    default: {
      const exhaustive: never = step.status;
      return exhaustive;
    }
  }
}

/** Texto do aria-live. Etapas pendentes ficam de fora para não repetir a lista inteira. */
export function liveAnnouncement(steps: readonly StepState[]): string {
  return steps
    .filter((step) => step.status !== "pending")
    .map((step) => statusAnnouncement(step))
    .join(" ");
}

export function retryWaitMessage(input: {
  seconds: number;
  nextAttempt: number;
  attempts: number;
  providerMessage?: string;
}): string {
  const base = input.providerMessage?.trim() || `Tentando de novo em ${input.seconds} s`;
  return `${base} (tentativa ${input.nextAttempt} de ${input.attempts})`;
}

/** Classe de animação. Com movimento reduzido, a tela só troca o estado. */
export function prefersReducedMotionClass(reduced: boolean, animated: string): string {
  return reduced ? "" : animated;
}
