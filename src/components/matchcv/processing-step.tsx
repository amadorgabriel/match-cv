"use client";

import { CheckCircle2Icon, CircleIcon, LoaderCircleIcon, XCircleIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import type { StepState } from "./types";

const ROTATING_MESSAGES = [
  "Lendo o seu currículo com calma...",
  "Cruzando suas experiências com os requisitos da vaga...",
  "Escolhendo as palavras-chave que o ATS procura...",
  "Tirando os clichês do texto...",
  "Conferindo se nada foi inventado...",
  "Montando perguntas prováveis da entrevista...",
  "Consultando anúncios de vagas para a faixa salarial...",
];

export function ProcessingStep({ steps, onCancel }: { steps: StepState[]; onCancel: () => void }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % ROTATING_MESSAGES.length), 2200);
    return () => clearInterval(id);
  }, []);

  const done = steps.filter((s) => s.status === "done" || s.status === "error").length;
  const progress = Math.round((done / steps.length) * 100);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-8 py-10 text-center">
      <div className="relative flex size-20 items-center justify-center">
        <span className="bg-primary/10 absolute inset-0 animate-ping rounded-full" />
        <LoaderCircleIcon className="text-primary size-10 animate-spin" />
      </div>

      <div className="min-h-14" aria-live="polite">
        <h1 className="text-xl font-semibold">Gerando seus materiais</h1>
        <p key={index} className="text-muted-foreground animate-in fade-in slide-in-from-bottom-1 mt-2 duration-500">
          {ROTATING_MESSAGES[index]}
        </p>
      </div>

      <div className="bg-muted h-2 w-full overflow-hidden rounded-full" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
        <div className="bg-primary h-full transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      <Card className="w-full text-left">
        <CardContent>
          <ul className="flex flex-col gap-3">
            {steps.map((s) => (
              <li key={s.id} className="flex items-center gap-3 text-sm">
                {s.status === "done" && <CheckCircle2Icon className="size-4 text-emerald-600" />}
                {s.status === "running" && <LoaderCircleIcon className="text-primary size-4 animate-spin" />}
                {s.status === "pending" && <CircleIcon className="text-muted-foreground size-4" />}
                {s.status === "error" && <XCircleIcon className="text-destructive size-4" />}
                <span className={s.status === "pending" ? "text-muted-foreground" : ""}>{s.label}</span>
                {s.error && <span className="text-destructive ml-auto text-xs">{s.error}</span>}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Button variant="ghost" onClick={onCancel}>
        Cancelar e voltar ao formulário
      </Button>
    </div>
  );
}
