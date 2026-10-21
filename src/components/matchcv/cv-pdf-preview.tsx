"use client";

import { pdf } from "@react-pdf/renderer";
import { DownloadIcon, LoaderCircleIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { downloadCvPdf } from "@/lib/client/api";
import { CvDocument, cvPdfFilename } from "@/lib/pdf/cv-document";
import type { Cv } from "@/lib/schemas/outputs";

export function CvPdfPreview({ cv }: { cv: Cv }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    pdf(<CvDocument cv={cv} />)
      .toBlob()
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setError("Não foi possível montar a prévia do PDF.");
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [cv]);

  async function download() {
    setDownloading(true);
    setError(null);
    try {
      if (url) {
        const a = document.createElement("a");
        a.href = url;
        a.download = cvPdfFilename(cv.fullName);
        document.body.appendChild(a);
        a.click();
        a.remove();
        return;
      }
      await downloadCvPdf(cv);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao gerar o PDF.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {url ? (
        <iframe title={`Prévia do CV de ${cv.fullName}`} src={url} className="h-[32rem] w-full rounded-lg border bg-white" />
      ) : (
        <div className="text-muted-foreground flex h-40 items-center justify-center gap-2 rounded-lg border text-sm">
          {error ? (
            error
          ) : (
            <>
              <LoaderCircleIcon className="size-4 animate-spin" />
              Montando a prévia do PDF…
            </>
          )}
        </div>
      )}
      <div>
        <Button onClick={download} disabled={downloading}>
          {downloading ? <LoaderCircleIcon className="animate-spin" /> : <DownloadIcon />}
          Baixar CV em PDF
        </Button>
        {error && url ? <p className="text-destructive mt-2 text-sm">{error}</p> : null}
      </div>
    </div>
  );
}
