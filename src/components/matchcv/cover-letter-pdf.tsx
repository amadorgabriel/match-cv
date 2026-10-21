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
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  useEffect(() => {
    setUrl(null);
    setError(null);
  }, [body, fullName, company]);

  async function convert() {
    setBusy(true);
    setError(null);
    try {
      const blob = await pdf(<CoverLetterDocument body={body} fullName={fullName} company={company} />).toBlob();
      setUrl(URL.createObjectURL(blob));
    } catch {
      setError("Não foi possível montar o PDF da cover letter.");
    } finally {
      setBusy(false);
    }
  }

  function download() {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = coverLetterPdfFilename(fullName, company);
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={convert} disabled={busy}>
          {busy ? <LoaderCircleIcon className="animate-spin" /> : <DownloadIcon />}
          Converter para PDF
        </Button>
        {url ? (
          <Button type="button" onClick={download}>
            <DownloadIcon />
            Baixar PDF
          </Button>
        ) : null}
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {url ? (
        <iframe title="Prévia da cover letter" src={url} className="h-[32rem] w-full rounded-lg border bg-white" />
      ) : null}
    </div>
  );
}
