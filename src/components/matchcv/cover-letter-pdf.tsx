"use client";

import { pdf } from "@react-pdf/renderer";
import { DownloadIcon, LoaderCircleIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { CoverLetterDocument } from "@/lib/pdf/cover-letter-document";
import { coverLetterPdfFilename } from "@/lib/pdf/filename";

export function CoverLetterPdf({
  body,
  fullName,
  company,
}: {
  body: string;
  fullName?: string;
  company?: string;
}) {
  const previewKey = `${fullName ?? ""}\0${company ?? ""}\0${body}`;
  const [requestedKey, setRequestedKey] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const current = requestedKey === previewKey;

  useEffect(() => {
    if (!current || !requestedKey) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    pdf(<CoverLetterDocument body={body} fullName={fullName} company={company} />)
      .toBlob()
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
        setBusy(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Não foi possível montar o PDF da cover letter.");
        setBusy(false);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [body, company, current, fullName, requestedKey]);

  function convert() {
    setError(null);
    setUrl(null);
    setBusy(true);
    setRequestedKey(previewKey);
  }

  function download() {
    if (!url || !current) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = coverLetterPdfFilename(fullName, company);
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const visibleUrl = current ? url : null;
  const visibleError = current ? error : null;

  return (
    <div className="flex flex-col items-start gap-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={convert} disabled={busy && current}>
          {busy && current ? <LoaderCircleIcon className="animate-spin" /> : <DownloadIcon />}
          Converter para PDF
        </Button>
        {visibleUrl ? (
          <Button type="button" onClick={download}>
            <DownloadIcon />
            Baixar PDF
          </Button>
        ) : null}
      </div>
      {visibleError ? <p className="text-destructive text-sm">{visibleError}</p> : null}
      {visibleUrl ? (
        <iframe title="Prévia da cover letter" src={visibleUrl} className="h-[32rem] w-full rounded-lg border bg-white" />
      ) : null}
    </div>
  );
}
