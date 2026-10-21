"use client";

import {
  AlertTriangleIcon,
  BriefcaseIcon,
  FileTextIcon,
  LoaderCircleIcon,
  MailIcon,
  MessagesSquareIcon,
  RefreshCwIcon,
  WalletIcon,
} from "lucide-react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Results } from "@/lib/client/api";
import type { Artifact, Salary, ValidationReport } from "@/lib/schemas/outputs";
import { CopyButton } from "./copy-button";
import { CvPdfPreview } from "./cv-pdf-preview";
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

function NotGenerated({
  id,
  steps,
  regenerating,
  onGenerate,
}: {
  id: Artifact | "salary";
  steps: StepState[];
  regenerating: StepId | null;
  onGenerate: () => void;
}) {
  const running = regenerating === id;
  const detail = steps.find((step) => step.id === id)?.detail;
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-sm">Este conteúdo não foi gerado.</p>
      <Button onClick={onGenerate} disabled={regenerating !== null}>
        {running ? <LoaderCircleIcon className="animate-spin" /> : null}
        Gerar
      </Button>
      {running && detail ? <p className="text-muted-foreground text-sm">{detail}</p> : null}
      <StepError steps={steps} id={id} />
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

const CONFIDENCE_LABEL = { alta: "Alta", media: "Média", baixa: "Baixa" } as const;

function SalarySources({ salary }: { salary: Salary }) {
  const showsAdzuna = salary.sources.some((source) => source.name.toLowerCase() === "adzuna");
  return (
    <div className="border-t pt-3 text-sm">
      {salary.sources.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {salary.sources.map((source) => (
            <li key={source.url}>
              <a href={source.url} target="_blank" rel="noreferrer noopener" className="font-medium underline underline-offset-2">
                {source.name}
              </a>
              {source.date ? <span className="text-muted-foreground"> · {source.date}</span> : null}
              {source.note ? <span className="text-muted-foreground"> ({source.note})</span> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">Nenhuma fonte devolveu um link desta vez.</p>
      )}
      {showsAdzuna ? <p className="text-muted-foreground mt-2 text-xs">Jobs by Adzuna. Estimativas salariais: Adzuna Jobsworth.</p> : null}
    </div>
  );
}

function SalaryCard({ salary }: { salary: Salary }) {
  const unavailable = salary.available === false || salary.min === undefined || salary.max === undefined;
  const period = salary.period === "month" ? "por mês" : "por ano";
  return (
    <div className="flex flex-col gap-4">
      {unavailable ? (
        <div className="rounded-lg border p-4">
          <p className="font-medium">Faixa não disponível</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Consultamos as fontes desta vaga e não houve números suficientes para montar uma faixa.
          </p>
        </div>
      ) : (
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
      )}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {salary.confidence ? (
          <span className="bg-muted rounded-full px-2 py-0.5 text-xs font-medium">Confiança {CONFIDENCE_LABEL[salary.confidence]}</span>
        ) : null}
        {salary.contract ? <span className="text-muted-foreground text-xs">Vínculo: {salary.contract}</span> : null}
      </div>
      <p className="text-muted-foreground text-sm">
        Busca: <strong>{salary.query.jobTitle}</strong>
        {salary.query.company ? ` na ${salary.query.company}` : ""}
        {salary.query.location ? ` em ${salary.query.location}` : ""}
        {salary.sampleSize ? `, com base em ${salary.sampleSize} anúncios` : ""}.
      </p>
      {salary.query.matchedQuery ? (
        <p className="text-muted-foreground text-sm">Consulta que encontrou a faixa: {salary.query.matchedQuery}.</p>
      ) : null}
      {salary.similarRoleNote ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          {salary.similarRoleNote}
        </p>
      ) : null}
      {salary.tried && salary.tried.length > 0 ? (
        <div>
          <p className="text-sm font-medium">O que foi consultado</p>
          <ul className="text-muted-foreground mt-1 list-disc pl-4 text-sm">
            {salary.tried.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="text-muted-foreground text-xs">{salary.disclaimer}</p>
      <SalarySources salary={salary} />
    </div>
  );
}

export function ResultsStep({ results, steps, isMock, regenerating, onRegenerate, onEdit, onReset }: Props) {
  const cv = results.cv?.data;
  const missing = (id: Artifact | "salary") => (
    <NotGenerated id={id} steps={steps} regenerating={regenerating} onGenerate={() => onRegenerate(id)} />
  );

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
              {cv ? (
                <CardAction>
                  <RegenerateButton id="cv" regenerating={regenerating} onClick={() => onRegenerate("cv")} />
                </CardAction>
              ) : null}
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {cv ? (
                <>
                  <StepError steps={steps} id="cv" />
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
                  <CvPdfPreview cv={cv} />
                </>
              ) : (
                missing("cv")
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email">
          <Card>
            <CardHeader>
              <CardTitle>E-mail para a empresa</CardTitle>
              <CardDescription>{results.email ? `Assunto: ${results.email.data.subject}` : "Mensagem curta para enviar com o currículo."}</CardDescription>
              {results.email ? (
                <CardAction className="flex gap-1">
                  <CopyButton text={`Assunto: ${results.email.data.subject}\n\n${results.email.data.body}`} />
                  <RegenerateButton id="email" regenerating={regenerating} onClick={() => onRegenerate("email")} />
                </CardAction>
              ) : null}
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {results.email ? (
                <>
                  <StepError steps={steps} id="email" />
                  <Paragraphs text={results.email.data.body} />
                  <ValidationNotice report={results.email.validation} />
                </>
              ) : (
                missing("email")
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cover-letter">
          <Card>
            <CardHeader>
              <CardTitle>Cover letter</CardTitle>
              <CardDescription>Até cerca de 350 palavras, em parágrafos.</CardDescription>
              {results["cover-letter"] ? (
                <CardAction className="flex gap-1">
                  <CopyButton text={results["cover-letter"].data.body} />
                  <RegenerateButton id="cover-letter" regenerating={regenerating} onClick={() => onRegenerate("cover-letter")} />
                </CardAction>
              ) : null}
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {results["cover-letter"] ? (
                <>
                  <StepError steps={steps} id="cover-letter" />
                  <Paragraphs text={results["cover-letter"].data.body} />
                  <ValidationNotice report={results["cover-letter"].validation} />
                </>
              ) : (
                missing("cover-letter")
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="interview">
          <Card>
            <CardHeader>
              <CardTitle>Roteiro de entrevista</CardTitle>
              <CardDescription>Abra cada seção para ver as perguntas e as respostas sugeridas.</CardDescription>
              {results.interview ? (
                <CardAction>
                  <RegenerateButton id="interview" regenerating={regenerating} onClick={() => onRegenerate("interview")} />
                </CardAction>
              ) : null}
            </CardHeader>
            <CardContent>
              {results.interview ? (
                <>
                  <StepError steps={steps} id="interview" />
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
                </>
              ) : (
                missing("interview")
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="salary">
          <Card>
            <CardHeader>
              <CardTitle>Faixa salarial estimada</CardTitle>
              <CardDescription>Adzuna e, quando o provedor permite, busca pública na web. Sem número, a faixa fica indisponível.</CardDescription>
              {results.salary ? (
                <CardAction>
                  <RegenerateButton id="salary" regenerating={regenerating} onClick={() => onRegenerate("salary")} />
                </CardAction>
              ) : null}
            </CardHeader>
            <CardContent>
              {results.salary ? (
                <>
                  <StepError steps={steps} id="salary" />
                  <SalaryCard salary={results.salary} />
                </>
              ) : (
                missing("salary")
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
