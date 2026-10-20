import { extractText, getDocumentProxy } from "unpdf";

import { LIMITS } from "@/lib/schemas/requests";
import { checkRateLimit, jsonError, jsonOk } from "@/lib/security/http";

// Runtime Node.js (padrão do Next 16; o export `runtime` não é compatível com cacheComponents).

/**
 * POST /api/parse  (multipart/form-data, campo "file")
 * Extrai o texto do currículo em PDF com unpdf. Nada é armazenado.
 *
 * TODO: suporte a DOCX (mammoth) e fallback de mandar o PDF direto ao
 * modelo quando a extração vier vazia (PDF escaneado).
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
  const isPdf = bytes.length > 4 && String.fromCharCode(...bytes.slice(0, 4)) === "%PDF";
  if (!isPdf) return jsonError(415, "unsupported_type", "Envie o currículo em PDF.");

  try {
    const pdf = await getDocumentProxy(bytes);
    const { totalPages, text } = await extractText(pdf, { mergePages: true });
    const clean = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    return jsonOk({
      text: clean.slice(0, LIMITS.maxResumeChars),
      pages: totalPages,
      chars: clean.length,
      truncated: clean.length > LIMITS.maxResumeChars,
      empty: clean.length < 50,
    });
  } catch {
    return jsonError(422, "parse_failed", "Não foi possível ler o PDF.");
  }
}
