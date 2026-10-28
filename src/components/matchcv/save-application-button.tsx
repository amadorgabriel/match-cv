"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { Results } from "@/lib/client/api";
import { saveApplication } from "@/lib/applications/browser";
import { draftFromResults } from "@/lib/applications/store";

export function SaveApplicationButton({ jobDescription, results }: { jobDescription: string; results: Results }) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  async function save() {
    setState("saving");
    setMessage("");
    try {
      await saveApplication({ ...draftFromResults(jobDescription, results), status: "aplicado" });
      setState("saved");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar a candidatura.");
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" onClick={save} disabled={state === "saving" || state === "saved"}>
        {state === "saving" ? "Salvando…" : state === "saved" ? "Candidatura salva" : "Salvar candidatura no Dashboard"}
      </Button>
      {state === "saved" ? (
        <Link href="/dashboard" className="text-sm underline underline-offset-2">
          Abrir dashboard
        </Link>
      ) : null}
      {state === "error" ? <p className="text-destructive text-xs">{message}</p> : null}
    </div>
  );
}
