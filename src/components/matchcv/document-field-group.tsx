"use client";

import { FileTextIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createDocumentDraft, type DocumentDraft, type DocumentKind, type DocumentSource } from "@/lib/documents/compose";

const KIND_LABEL: Record<DocumentKind, string> = {
  cv: "Currículo",
  achievements: "Conquistas",
  portfolio: "Portfólio / contexto extra",
};

interface Props {
  entries: DocumentDraft[];
  errors: Record<string, string>;
  onChange: (entries: DocumentDraft[]) => void;
}

export function DocumentFieldGroup({ entries, errors, onChange }: Props) {
  function update(id: string, patch: Partial<DocumentDraft>) {
    onChange(entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  }

  function add() {
    onChange([...entries, createDocumentDraft("achievements", "text")]);
  }

  function remove(id: string) {
    onChange(entries.filter((entry) => entry.id !== id));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <Label>Documentos</Label>
          <p className="text-muted-foreground mt-1 text-xs">
            Currículo, conquistas ou contexto extra. Cada item entra como PDF ou texto colado.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={add}>
          Adicionar documento
        </Button>
      </div>

      {entries.length === 0 ? <p className="text-muted-foreground text-sm">Nenhum documento ainda.</p> : null}

      <ul className="flex flex-col gap-3">
        {entries.map((entry, index) => (
          <li key={entry.id} className="flex flex-col gap-3 rounded-lg border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-sm">
                Tipo
                <select
                  aria-label={`Tipo do documento ${index + 1}`}
                  value={entry.kind}
                  onChange={(event) => update(entry.id, { kind: event.target.value as DocumentKind })}
                  className="border-input bg-background h-8 rounded-lg border px-2"
                >
                  {(Object.keys(KIND_LABEL) as DocumentKind[]).map((kind) => (
                    <option key={kind} value={kind}>
                      {KIND_LABEL[kind]}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex gap-1" role="group" aria-label={`Formato do documento ${index + 1}`}>
                {(["pdf", "text"] as DocumentSource[]).map((source) => (
                  <Button
                    key={source}
                    type="button"
                    size="sm"
                    variant={entry.source === source ? "secondary" : "outline"}
                    aria-pressed={entry.source === source}
                    onClick={() => update(entry.id, { source })}
                  >
                    {source === "pdf" ? "PDF" : "Texto"}
                  </Button>
                ))}
              </div>
              <Button type="button" variant="ghost" size="sm" className="ml-auto" aria-label={`Remover ${KIND_LABEL[entry.kind]}`} onClick={() => remove(entry.id)}>
                Remover
              </Button>
            </div>

            {entry.source === "pdf" ? (
              <div className="flex flex-col gap-2">
                <label
                  className="border-input hover:bg-muted/50 flex cursor-pointer items-center gap-3 rounded-lg border border-dashed p-4 text-sm transition-colors"
                >
                  <FileTextIcon className="text-muted-foreground size-5 shrink-0" />
                  <span className="truncate">
                    {entry.file ? `${entry.file.name} (${(entry.file.size / 1024).toFixed(0)} KB)` : `Anexar PDF de ${KIND_LABEL[entry.kind].toLowerCase()}`}
                  </span>
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    className="sr-only"
                    aria-label={`PDF de ${KIND_LABEL[entry.kind]}`}
                    onChange={(event) => update(entry.id, { file: event.target.files?.[0] ?? null })}
                  />
                </label>
              </div>
            ) : (
              <Textarea
                rows={entry.kind === "cv" ? 8 : 4}
                value={entry.text}
                aria-label={`Texto de ${KIND_LABEL[entry.kind]}`}
                spellCheck={false}
                placeholder={
                  entry.kind === "cv"
                    ? "Cole o texto do currículo."
                    : entry.kind === "achievements"
                      ? "Uma conquista por linha. Ex.: reduzi o tempo de deploy em 40%"
                      : "Links, cases ou outro contexto que a geração possa usar."
                }
                onChange={(event) => update(entry.id, { text: event.target.value })}
              />
            )}
            {errors[entry.id] ? <p className="text-destructive text-sm">{errors[entry.id]}</p> : null}
          </li>
        ))}
      </ul>
      {errors.documents ? <p className="text-destructive text-sm">{errors.documents}</p> : null}
    </div>
  );
}
