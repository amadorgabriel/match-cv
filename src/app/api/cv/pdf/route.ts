import { cvToPdf } from "@/lib/pdf/cv-to-pdf";
import { CvSchema } from "@/lib/schemas/outputs";
import { checkRateLimit, jsonError, readJson } from "@/lib/security/http";

// Runtime Node.js (padrão do Next 16; o export `runtime` não é compatível com cacheComponents).

/**
 * POST /api/cv/pdf  (body: JSON do CV no CvSchema)
 * Devolve o PDF ATS. PLACEHOLDER: gerador simples em lib/pdf/simple-pdf.ts.
 * TODO: trocar por template Typst (plano A) ou @react-pdf/renderer (plano B).
 */
export async function POST(req: Request) {
  const limited = checkRateLimit(req, "cv-pdf", 30);
  if (limited) return limited;

  const parsed = await readJson(req, CvSchema, 100_000);
  if (!parsed.ok) return parsed.response;

  try {
    const pdf = cvToPdf(parsed.data);
    const safeName = parsed.data.fullName.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "") || "cv";
    return new Response(pdf.buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}-CV.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return jsonError(500, "pdf_failed", "Não foi possível gerar o PDF.");
  }
}
