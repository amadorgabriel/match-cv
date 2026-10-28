import { POST as parsePdf } from "../parse/route";

/** Alias de /api/parse para a extração de PDF dos documentos da candidatura. */
export function POST(req: Request) {
  return parsePdf(req);
}
