"use client";

import { ShieldCheckIcon } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { VerificationClaim, VerificationReport } from "@/lib/verification/types";

const STATUS_LABEL: Record<VerificationClaim["status"], string> = {
  supported: "Com apoio no CV",
  unverified: "Sem apoio no CV original",
  contradicted: "Contradiz o CV original",
};

const ALIGNMENT_LABEL: Record<VerificationReport["seniorityAlignment"], string> = {
  alinhada: "Senioridade alinhada",
  abaixo: "Senioridade abaixo da vaga",
  acima: "Senioridade acima da vaga",
  indeterminada: "Senioridade não informada",
};

export function VerificationPanel({
  report,
  state,
}: {
  report: VerificationReport | null;
  state: "idle" | "loading" | "ready" | "error";
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheckIcon className="size-5" />
          Compatibilidade CV × Vaga & Checagem de Fidelidade
        </CardTitle>
        <CardDescription>
          A nota usa os requisitos da vaga e o currículo original. Afirmações sem apoio direto ficam destacadas.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {state === "loading" || state === "idle" ? (
          <p className="text-muted-foreground text-sm">Conferindo compatibilidade e fidelidade…</p>
        ) : null}
        {state === "error" ? (
          <p className="text-sm">Não foi possível concluir a checagem agora. Os materiais continuam disponíveis.</p>
        ) : null}
        {report && state === "ready" ? <VerificationBody report={report} /> : null}
      </CardContent>
    </Card>
  );
}

function VerificationBody({ report }: { report: VerificationReport }) {
  const unsupported = report.claims.filter((claim) => claim.status !== "supported");
  return (
    <>
      <div className="flex flex-wrap items-end gap-4">
        <p className="text-3xl font-semibold tabular-nums">{report.matchScore}</p>
        <p className="text-muted-foreground pb-1 text-sm">de 100 na compatibilidade com a vaga</p>
      </div>
      <p className="text-sm">{ALIGNMENT_LABEL[report.seniorityAlignment]}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <RequirementList title="Requisitos cobertos" items={report.covered} empty="Nenhum requisito obrigatório foi encontrado no currículo original." />
        <RequirementList title="Requisitos ausentes" items={report.missing} empty="Nenhuma lacuna nos requisitos obrigatórios." />
      </div>
      {report.keywordMisses.length > 0 ? (
        <p className="text-muted-foreground text-sm">Palavras-chave sem apoio no CV: {report.keywordMisses.join(", ")}.</p>
      ) : null}
      <div>
        <p className="text-sm font-medium">Afirmações verificadas</p>
        {report.claims.length === 0 ? (
          <p className="text-muted-foreground mt-1 text-sm">Ainda não há texto gerado para checar.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {report.claims.map((claim, index) => (
              <li
                key={`${claim.artifact}-${index}`}
                className={
                  claim.status === "supported"
                    ? "rounded-lg border p-3 text-sm"
                    : "rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
                }
              >
                <p className="text-xs font-medium uppercase">{STATUS_LABEL[claim.status]}</p>
                <p className="mt-1">{claim.text}</p>
                <p className="text-muted-foreground mt-1 text-xs">{claim.reason}</p>
              </li>
            ))}
          </ul>
        )}
        {unsupported.length > 0 ? (
          <p className="mt-2 text-sm">{unsupported.length} trecho(s) sem apoio direto no currículo original.</p>
        ) : null}
      </div>
      <p className="text-muted-foreground text-xs">
        {report.engine === "jev"
          ? "Nota e status das afirmações conferidos pelo Jev. A lista de requisitos continua calculada no servidor."
          : "Verificação local em português. O Jev entra quando TYPESAFE_API_KEY está configurada no servidor."}
      </p>
    </>
  );
}

function RequirementList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div>
      <p className="text-sm font-medium">{title}</p>
      {items.length === 0 ? (
        <p className="text-muted-foreground mt-1 text-sm">{empty}</p>
      ) : (
        <ul className="mt-1 list-disc pl-4 text-sm">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
