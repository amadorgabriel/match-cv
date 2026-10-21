import { contentDisposition, cvPdfFilename } from "@/lib/pdf/filename";
import { cvToPdf } from "@/lib/pdf/cv-to-pdf";
import { CvSchema } from "@/lib/schemas/outputs";
import { checkRateLimit, jsonError, readJson } from "@/lib/security/http";
import { logApiError } from "@/lib/security/redact";

// Runtime Node.js (padrão do Next 16; o export `runtime` não é compatível com cacheComponents).

/**
 * POST /api/cv/pdf  (body: JSON do CV no CvSchema)
 * Devolve o PDF ATS gerado com @react-pdf/renderer.
 * A prévia na tela usa o mesmo documento no navegador.
 */
export async function POST(req: Request) {
  const limited = await checkRateLimit(req, "cv-pdf", 30);
  if (limited) return limited;

  const parsed = await readJson(req, CvSchema, 100_000);
  if (!parsed.ok) return parsed.response;

  try {
    const pdf = await cvToPdf(parsed.data);
    return new Response(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": contentDisposition(cvPdfFilename(parsed.data.fullName)),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    logApiError({ route: "/api/cv/pdf", error: err, statusCode: 500 });
    return jsonError(500, "pdf_failed", "Não foi possível gerar o PDF.");
  }
}
