"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyButton } from "@/components/matchcv/copy-button";
import { CoverLetterPdf } from "@/components/matchcv/cover-letter-pdf";
import { CvPdfPreview } from "@/components/matchcv/cv-pdf-preview";
import type { ApplicationMaterials } from "@/lib/applications/types";

function Paragraphs({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-3 text-sm leading-relaxed">
      {text.split(/\n{2,}/).map((paragraph, index) => (
        <p key={index} className="whitespace-pre-line">
          {paragraph}
        </p>
      ))}
    </div>
  );
}

export function SavedMaterials({ materials, company }: { materials: ApplicationMaterials; company?: string }) {
  const salary = materials.salary;
  return (
    <Tabs defaultValue="cv">
      <TabsList className="flex h-auto w-full flex-wrap">
        <TabsTrigger value="cv">CV ATS</TabsTrigger>
        <TabsTrigger value="email">E-mail</TabsTrigger>
        <TabsTrigger value="cover-letter">Cover letter</TabsTrigger>
        <TabsTrigger value="interview">Entrevista</TabsTrigger>
        <TabsTrigger value="salary">Faixa salarial</TabsTrigger>
      </TabsList>
      <TabsContent value="cv" className="flex flex-col gap-3">
        {materials.cv ? (
          <>
            <p className="font-medium">{materials.cv.fullName}</p>
            <p className="text-muted-foreground text-sm">{materials.cv.headline}</p>
            <Paragraphs text={materials.cv.summary} />
            <CvPdfPreview cv={materials.cv} company={company} />
          </>
        ) : (
          <p className="text-muted-foreground text-sm">CV não foi salvo nesta candidatura.</p>
        )}
      </TabsContent>
      <TabsContent value="email" className="flex flex-col gap-3">
        {materials.email ? (
          <>
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium">{materials.email.subject}</p>
              <CopyButton text={`Assunto: ${materials.email.subject}\n\n${materials.email.body}`} />
            </div>
            <Paragraphs text={materials.email.body} />
          </>
        ) : (
          <p className="text-muted-foreground text-sm">E-mail não foi salvo nesta candidatura.</p>
        )}
      </TabsContent>
      <TabsContent value="cover-letter" className="flex flex-col gap-3">
        {materials.coverLetter ? (
          <>
            <div className="flex justify-end">
              <CopyButton text={materials.coverLetter.body} />
            </div>
            <Paragraphs text={materials.coverLetter.body} />
            <CoverLetterPdf body={materials.coverLetter.body} fullName={materials.cv?.fullName} company={company} />
          </>
        ) : (
          <p className="text-muted-foreground text-sm">Cover letter não foi salva nesta candidatura.</p>
        )}
      </TabsContent>
      <TabsContent value="interview">
        {materials.interview ? (
          <Accordion multiple>
            {materials.interview.sections.map((section) => (
              <AccordionItem key={section.title} value={section.title}>
                <AccordionTrigger>
                  {section.title} ({section.items.length})
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="flex flex-col gap-3">
                    {section.items.map((item, index) => (
                      <li key={index}>
                        <p className="font-medium">{item.question}</p>
                        {item.suggestedAnswer ? <p className="text-muted-foreground mt-1">{item.suggestedAnswer}</p> : null}
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : (
          <p className="text-muted-foreground text-sm">Roteiro de entrevista não foi salvo nesta candidatura.</p>
        )}
      </TabsContent>
      <TabsContent value="salary" className="text-sm">
        {salary ? (
          <div className="flex flex-col gap-2">
            {salary.available === false || salary.min === undefined || salary.max === undefined ? (
              <p>Faixa não disponível.</p>
            ) : (
              <p>
                {salary.min.toLocaleString("pt-BR")} – {salary.max.toLocaleString("pt-BR")} {salary.currency} ({salary.period === "month" ? "mês" : "ano"})
              </p>
            )}
            <p className="text-muted-foreground">{salary.disclaimer}</p>
          </div>
        ) : (
          <p className="text-muted-foreground">Faixa salarial não foi salva nesta candidatura.</p>
        )}
      </TabsContent>
    </Tabs>
  );
}
