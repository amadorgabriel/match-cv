"use client";

import {
  AlertTriangleIcon,
  BriefcaseIcon,
  DownloadIcon,
  FileTextIcon,
  LoaderCircleIcon,
  MailIcon,
  MessagesSquareIcon,
  RefreshCwIcon,
  WalletIcon,
} from "lucide-react";
import { useState } from "react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { downloadCvPdf, type Results } from "@/lib/client/api";
import type { Artifact, Salary, ValidationReport } from "@/lib/schemas/outputs";

import { CopyButton } from "./copy-button";
import type { StepId, StepState } from "./types";

interface Props {
  results: Results;
  steps: StepState[];
  isMock: boolean;
  regenerating: StepId | null;
  onRegenerate: (step: Artifact | "salary") => void;
  onEdit: () => void;
  onReset: () => void;
}

const brl = (v: number, currency: string) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);

function StepError({ steps, id }: { steps: StepState[]; id: StepId }) {
  const s = steps.find((x) => x.id === id);
  if (s?.status !== "error") return null;
  return <p className="text-destructive text-sm">{s.error ?? "Falhou."}</p>;
}

function ValidationNotice({ report }: { report?: ValidationReport }) {
  if (!report || report.ok) return null;
  return (
    <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
      <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
      <div>
        <p className="font-medium">Revise estes trechos antes de enviar:</p>
        <ul className="mt-1 list-disc pl-4">
          {report.violations.map((v, i) => (
            <li key={i}>{v.message}{v.match ? `: "${v.match}"` : ""}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function RegenerateButton({ id, regenerating, onClick }: { id: Artifact | "salary"; regenerating: StepId | null; onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick} disabled={regenerating !== null}>
      {regenerating === id ? <LoaderCircleIcon className="animate-spin" /> : <RefreshCwIcon />}
      Gerar novamente
    </Button>
  );
}

function Paragraphs({ text }: { text: string }) {
  // Saída do modelo renderizada como texto puro (nunca dangerouslySetInnerHTML).
  return (
    <div className="flex flex-col gap-3 text-sm leading-relaxed">
      {text.split(/\n{2,}/).map((p, i) => (
        <p key={i} className="whitespace-pre-line">
          {p}
        </p>
      ))}
    </div>
  );
}

function SalaryCard({ salary }: { salary: Salary }) {
  const period = salary.period === "month" ? "por mês" : "por ano";
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Mínimo", salary.min],
          ["Mediana", salary.median],
          ["Máximo", salary.max],
        ].map(([label, value]) => (
          <div key={label as string} className="bg-muted/50 rounded-lg p-4">
            <p className="text-muted-foreground text-xs uppercase">{label}</p>
            <p className="text-lg font-semibold">{typeof value === "number" ? brl(value, salary.currency) : "n/d"}</p>
            <p className="text-muted-foreground text-xs">{period}</p>
          </div>
        ))}
      </div>
      <p className="text-muted-foreground text-sm">
        Busca: <strong>{salary.query.jobTitle}</strong>
        {salary.query.location ? ` em ${salary.query.location}` : ""}
        {salary.sampleSize ? `, com base em ${salary.sampleSize} anúncios` : ""}.
      </p>
      <p className="text-muted-foreground text-xs">{salary.disclaimer}</p>
      <div className="border-t pt-3 text-sm">
        Fonte:{" "}
        {salary.sources.map((s) => (
          <span key={s.url}>
            <a href={s.url} target="_blank" rel="noreferrer noopener" className="font-medium underline underline-offset-2">
              {s.name}
            </a>
            {s.note ? <span className="text-muted-foreground"> ({s.note})</span> : null}
          </span>
        ))}
        <p className="text-muted-foreground mt-1 text-xs">Jobs by Adzuna. Estimativas salariais: Adzuna Jobsworth.</p>
      </div>
    </div>
  );
}

export function ResultsStep({ results, steps, isMock, regenerating, onRegenerate, onEdit, onReset }: Props) {
  const [downloading, setDownloading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const cv = results.cv?.data;

  async function download() {
    if (!cv) return;
    setDownloading(true);
    setPdfError(null);
    try {
      await downloadCvPdf(cv);
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : "Falha ao gerar o PDF.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Seus materiais estão prontos</h1>
          <p className="text-muted-foreground mt-1 text-sm">Revise tudo antes de enviar. A IA pode errar.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onEdit}>
            Editar dados
          </Button>
          <Button variant="ghost" onClick={onReset}>
            Nova candidatura
          </Button>
        </div>
      </div>

      {isMock && (
        <div className="rounded-lg border border-sky-300 bg-sky-50 p-3 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200">
          Modo de exemplo: os textos abaixo são dados fictícios. A geração real com IA entra quando
          <code className="mx-1">MATCHCV_ENABLE_AI=true</code>
          estiver configurado.
        </div>
      )}

      <Tabs defaultValue="cv">
        <TabsList className="flex h-auto w-full flex-wrap">
          <TabsTrigger value="cv"><FileTextIcon />CV ATS</TabsTrigger>
          <TabsTrigger value="email"><MailIcon />E-mail</TabsTrigger>
          <TabsTrigger value="cover-letter"><BriefcaseIcon />Cover letter</TabsTrigger>
          <TabsTrigger value="interview"><MessagesSquareIcon />Entrevista</TabsTrigger>
          <TabsTrigger value="salary"><WalletIcon />Faixa salarial</TabsTrigger>
        </TabsList>

        <TabsContent value="cv">
          <Card>
            <CardHeader>
              <CardTitle>CV compatível com ATS</CardTitle>
              <CardDescription>Coluna única, fonte padrão e texto selecionável.</CardDescription>
              <CardAction>
                <RegenerateButton id="cv" regenerating={regenerating} onClick={() => onRegenerate("cv")} />
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <StepError steps={steps} id="cv" />
              {cv && (
                <>
                  <div className="rounded-lg border p-4 text-sm">
                    <p className="text-base font-semibold">{cv.fullName}</p>
                    <p className="text-muted-foreground">{cv.headline}</p>
                    <p className="mt-3">{cv.summary}</p>
                    <ul className="mt-3 flex flex-col gap-2">
                      {cv.experience.map((e) => (
                        <li key={`${e.company}-${e.start}`}>
                          <span className="font-medium">{e.role}</span>, {e.company} ({e.start} a {e.end ?? "atual"})
                        </li>
                      ))}
                    </ul>
                  </div>
                  <ValidationNotice report={results.cv?.validation} />
                  <div>
                    <Button onClick={download} disabled={downloading}>
                      {downloading ? <LoaderCircleIcon className="animate-spin" /> : <DownloadIcon />}
                      Baixar CV em PDF
                    </Button>
                    {pdfError && <p className="text-destructive mt-2 text-sm">{pdfError}</p>}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email">
          <Card>
            <CardHeader>
              <CardTitle>E-mail para a empresa</CardTitle>
              <CardDescription>{results.email ? `Assunto: ${results.email.data.subject}` : ""}</CardDescription>
              <CardAction className="flex gap-1">
                {results.email && (
                  <CopyButton text={`Assunto: ${results.email.data.subject}\n\n${results.email.data.body}`} />
                )}
                <RegenerateButton id="email" regenerating={regenerating} onClick={() => onRegenerate("email")} />
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <StepError steps={steps} id="email" />
              {results.email && <Paragraphs text={results.email.data.body} />}
              <ValidationNotice report={results.email?.validation} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cover-letter">
          <Card>
            <CardHeader>
              <CardTitle>Cover letter</CardTitle>
              <CardDescription>Até cerca de 350 palavras, em parágrafos.</CardDescription>
              <CardAction className="flex gap-1">
                {results["cover-letter"] && <CopyButton text={results["cover-letter"].data.body} />}
                <RegenerateButton id="cover-letter" regenerating={regenerating} onClick={() => onRegenerate("cover-letter")} />
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <StepError steps={steps} id="cover-letter" />
              {results["cover-letter"] && <Paragraphs text={results["cover-letter"].data.body} />}
              <ValidationNotice report={results["cover-letter"]?.validation} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="interview">
          <Card>
            <CardHeader>
              <CardTitle>Roteiro de entrevista</CardTitle>
              <CardDescription>Abra cada seção para ver as perguntas e as respostas sugeridas.</CardDescription>
              <CardAction>
                <RegenerateButton id="interview" regenerating={regenerating} onClick={() => onRegenerate("interview")} />
              </CardAction>
            </CardHeader>
            <CardContent>
              <StepError steps={steps} id="interview" />
              {results.interview && (
                <Accordion multiple defaultValue={[results.interview.data.sections[0]?.title]}>
                  {results.interview.data.sections.map((section) => (
                    <AccordionItem key={section.title} value={section.title}>
                      <AccordionTrigger>
                        {section.title} ({section.items.length})
                      </AccordionTrigger>
                      <AccordionContent>
                        <ul className="flex flex-col gap-4">
                          {section.items.map((item, i) => (
                            <li key={i}>
                              <p className="font-medium">{item.question}</p>
                              {item.suggestedAnswer && <p className="text-muted-foreground mt-1">{item.suggestedAnswer}</p>}
                              {item.notes && <p className="mt-1 text-amber-700 dark:text-amber-300">{item.notes}</p>}
                            </li>
                          ))}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="salary">
          <Card>
            <CardHeader>
              <CardTitle>Faixa salarial estimada</CardTitle>
              <CardDescription>Baseada em anúncios de vagas publicados na Adzuna.</CardDescription>
              <CardAction>
                <RegenerateButton id="salary" regenerating={regenerating} onClick={() => onRegenerate("salary")} />
              </CardAction>
            </CardHeader>
            <CardContent>
              <StepError steps={steps} id="salary" />
              {results.salary && <SalaryCard salary={results.salary} />}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
