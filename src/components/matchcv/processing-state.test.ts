import { describe, expect, it } from "vitest";

import {
  activeStageMessages,
  canViewPartialResults,
  createStepStates,
  liveAnnouncement,
  prefersReducedMotionClass,
  processingHeadline,
  processingOutcome,
  progressPercent,
  reduceStep,
  retryStep,
  retryWaitMessage,
  stageMessage,
} from "./processing-state";
import { STEP_MESSAGES, type StepId, type StepState } from "./types";

const pipeline: StepId[] = ["parse", "brief", "cv", "email", "cover-letter", "interview", "salary"];

function apply(steps: StepState[], events: Parameters<typeof reduceStep>[1][]): StepState[] {
  return events.reduce(reduceStep, steps);
}

describe("estado por etapa", () => {
  it("mostra a mensagem da etapa em andamento, sem fila por tempo", () => {
    let steps = createStepStates(["parse", "brief", "cv"]);
    expect(activeStageMessages(steps)).toEqual([]);
    expect(stageMessage(steps[0]!)).toBe(STEP_MESSAGES.parse);

    steps = reduceStep(steps, { type: "start", id: "parse" });
    expect(activeStageMessages(steps)).toEqual(["Lendo o currículo…"]);
    expect(processingHeadline(steps).title).toBe("Gerando seus materiais");

    steps = reduceStep(steps, { type: "done", id: "parse" });
    steps = reduceStep(steps, { type: "start", id: "brief" });
    expect(activeStageMessages(steps)).toEqual(["Analisando a vaga…"]);
    expect(steps.find((step) => step.id === "cv")?.status).toBe("pending");
  });

  it("anuncia as etapas que rodam juntas, na ordem do fluxo", () => {
    const steps = apply(createStepStates(["brief", "cv", "salary"]), [
      { type: "start", id: "brief" },
      { type: "start", id: "cv" },
    ]);
    expect(activeStageMessages(steps)).toEqual(["Analisando a vaga…", "Gerando o CV…"]);
  });

  it("troca a mensagem para a espera do retry automático", () => {
    const detail = retryWaitMessage({ seconds: 2, nextAttempt: 2, attempts: 3 });
    const steps = apply(createStepStates(["salary"]), [
      { type: "start", id: "salary" },
      { type: "retry-wait", id: "salary", detail },
    ]);
    expect(steps[0]).toMatchObject({ status: "retrying", detail, error: undefined });
    expect(activeStageMessages(steps)).toEqual([detail]);
    expect(liveAnnouncement(steps)).toBe(`Pesquisar a faixa salarial: aguardando retry. ${detail}`);
    expect(progressPercent(steps)).toBe(50);
  });

  it("usa a mensagem do provedor no retry de limite", () => {
    expect(
      retryWaitMessage({
        seconds: 15,
        nextAttempt: 2,
        attempts: 3,
        providerMessage: "Limite do provedor. Nova tentativa em 15 s.",
      }),
    ).toBe("Limite do provedor. Nova tentativa em 15 s. (tentativa 2 de 3)");
  });

  it("marca erro só na etapa que falhou e mantém as outras pendentes", () => {
    const steps = apply(createStepStates(pipeline), [
      { type: "start", id: "parse" },
      { type: "error", id: "parse", error: "PDF ilegível" },
    ]);
    expect(steps.map((step) => step.status)).toEqual(["error", "pending", "pending", "pending", "pending", "pending", "pending"]);
    expect(steps[0]?.error).toBe("PDF ilegível");
    expect(processingOutcome(steps)).toBe("processing");
    expect(canViewPartialResults(steps)).toBe(false);
    expect(processingHeadline(steps).messages).toEqual([{ key: "parse", text: "Ler o currículo: erro. PDF ilegível" }]);
  });

  it("tentar de novo só recoloca aquela etapa em andamento", () => {
    let steps = apply(createStepStates(["cv", "email", "salary"]), [
      { type: "done", id: "cv" },
      { type: "error", id: "email", error: "limite" },
      { type: "done", id: "salary" },
    ]);
    const ignored = retryStep(steps, "cv");
    expect(ignored).toBe(steps);

    steps = retryStep(steps, "email");
    expect(steps.find((step) => step.id === "cv")?.status).toBe("done");
    expect(steps.find((step) => step.id === "salary")?.status).toBe("done");
    expect(steps.find((step) => step.id === "email")).toMatchObject({ status: "running", error: undefined });
    expect(progressPercent(steps)).toBe(83);
  });

  it("não reabre etapa concluída nem a que já está aguardando retry", () => {
    const steps = apply(createStepStates(["cv", "email"]), [
      { type: "done", id: "cv" },
      { type: "retry-wait", id: "email", detail: "Tentando de novo em 1 s (tentativa 2 de 3)" },
    ]);
    expect(retryStep(steps, "cv")).toBe(steps);
    expect(retryStep(steps, "email")).toBe(steps);
    expect(canViewPartialResults(steps)).toBe(false);
  });

  it("segue para os resultados só quando toda etapa concluída", () => {
    let steps = apply(createStepStates(["parse", "cv"]), [
      { type: "done", id: "parse" },
      { type: "done", id: "cv" },
    ]);
    expect(processingOutcome(steps)).toBe("results");

    steps = reduceStep(steps, { type: "error", id: "cv", error: "falhou" });
    expect(processingOutcome(steps)).toBe("processing");
  });

  it("libera resultados parciais quando o material pronto convive com erro parado", () => {
    const ready = apply(createStepStates(["parse", "brief", "cv", "email"]), [
      { type: "done", id: "parse" },
      { type: "error", id: "brief", error: "análise indisponível" },
      { type: "done", id: "cv" },
      { type: "error", id: "email", error: "falhou" },
    ]);
    expect(canViewPartialResults(ready)).toBe(true);
    expect(liveAnnouncement(ready)).toContain("Analisar a vaga: erro. análise indisponível");
    expect(liveAnnouncement(ready)).toContain("Gerar o CV ATS: concluído.");
    expect(liveAnnouncement(ready)).not.toContain("pendente");
  });

  it("ajusta a leitura quando há PDF de conquistas", () => {
    const steps = createStepStates(["parse", "cv"], { achievementsFile: true });
    expect(steps[0]?.label).toBe("Ler o currículo e as conquistas");
    expect(stageMessage({ ...steps[0]!, status: "running" })).toBe("Lendo o currículo e as conquistas…");
  });

  it("identifica cada mensagem mesmo quando o texto do retry se repete", () => {
    const detail = "Tentando de novo em 2 s (tentativa 2 de 3)";
    const steps = apply(createStepStates(["cv", "email"]), [
      { type: "retry-wait", id: "cv", detail },
      { type: "retry-wait", id: "email", detail },
    ]);
    expect(processingHeadline(steps).messages.map((message) => message.key)).toEqual(["cv", "email"]);
  });

  it("omite animação quando o usuário prefere menos movimento", () => {
    expect(prefersReducedMotionClass(true, "animate-spin")).toBe("");
    expect(prefersReducedMotionClass(false, "animate-spin")).toBe("animate-spin");
  });
});
