import { extractText, getDocumentProxy } from "unpdf";

import { LIMITS } from "@/lib/schemas/requests";
import { checkRateLimit, jsonError, jsonOk } from "@/lib/security/http";
import { logApiError } from "@/lib/security/redact";

// Runtime Node.js (padrão do Next 16; o export `runtime` não é compatível com cacheComponents).

export const PDF_ONLY_MESSAGE = "Por enquanto só aceitamos CV em PDF.";
export const SCANNED_PDF_MESSAGE =
  "Esse PDF parece ser uma imagem escaneada. Envie um PDF com texto selecionável.";
const MIN_EXTRACTED_CHARS = 50;

/**
 * POST /api/parse  (multipart/form-data, campo "file")
 * Extrai o texto de um PDF com texto selecionável. Nada é armazenado.
 * DOCX e PDF sem texto (imagem escaneada) são recusados.
 */
export async function POST(req: Request) {
  const limited = checkRateLimit(req, "parse", 20);
  if (limited) return limited;

  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > LIMITS.maxFileBytes + 64_000) return jsonError(413, "file_too_large", "Arquivo maior que 4 MB.");

  let file: File | null = null;
  try {
    const form = await req.formData();
    const value = form.get("file");
    file = value instanceof File ? value : null;
  } catch {
    return jsonError(400, "invalid_form", "Envie o arquivo no campo 'file'.");
  }
  if (!file) return jsonError(400, "missing_file", "Nenhum arquivo enviado.");
  if (file.size > LIMITS.maxFileBytes) return jsonError(413, "file_too_large", "Arquivo maior que 4 MB.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isTextPdfUpload(file, bytes)) return jsonError(415, "unsupported_type", PDF_ONLY_MESSAGE);

  try {
    const pdf = await getDocumentProxy(bytes);
    const { totalPages, text } = await extractText(pdf, { mergePages: true });
    const clean = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    if (clean.length < MIN_EXTRACTED_CHARS) return jsonError(422, "scanned_pdf", SCANNED_PDF_MESSAGE);
    return jsonOk({
      text: clean.slice(0, LIMITS.maxResumeChars),
      pages: totalPages,
      chars: clean.length,
      truncated: clean.length > LIMITS.maxResumeChars,
    });
  } catch (err) {
    logApiError({ route: "/api/parse", error: err, statusCode: 422 });
    return jsonError(422, "parse_failed", "Não foi possível ler o PDF.");
  }
}

/** Extensão, MIME e cabeçalho %PDF. Qualquer outro formato (DOCX incluso) é recusado. */
function isTextPdfUpload(file: File, bytes: Uint8Array): boolean {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  if (/\.(docx?|rtf|txt|odt)$/.test(name)) return false;
  if (type.includes("word") || type.includes("officedocument")) return false;
  const header = bytes.length >= 4 && String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) === "%PDF";
  if (!header) return false;
  const mimeOk = type === "" || type === "application/pdf" || type === "application/x-pdf" || type === "application/octet-stream";
  const nameOk = name === "" || name.endsWith(".pdf");
  return mimeOk && nameOk;
}
