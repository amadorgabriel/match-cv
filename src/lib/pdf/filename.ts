const ILLEGAL = /[\\/:*?"<>|\u0000-\u001f]/g;

/** Tira caracteres ilegais no nome do arquivo e mantém acentos e espaços. */
export function sanitizeFilenamePart(value: string): string {
  return value.replace(ILLEGAL, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

export function pdfDownloadName(parts: Array<string | undefined>): string {
  const clean = parts.map((part) => (part ? sanitizeFilenamePart(part) : "")).filter(Boolean);
  return `${clean.length ? clean.join(" - ") : "Currículo"}.pdf`;
}

/** "<Nome> - <Empresa>.pdf". Sem empresa, fica só o nome. Sem nome, "Currículo". */
export function cvPdfFilename(fullName: string, company?: string): string {
  return pdfDownloadName([fullName || "Currículo", company]);
}

export function coverLetterPdfFilename(fullName: string | undefined, company?: string): string {
  return pdfDownloadName([fullName || "Currículo", company, "Cover letter"]);
}

/** filename ASCII para clientes antigos e filename* com acentos. */
export function contentDisposition(filename: string): string {
  const ascii =
    filename
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\x20-\x7e]/g, "")
      .replace(/["\\]/g, "")
      .trim() || "curriculo.pdf";
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
