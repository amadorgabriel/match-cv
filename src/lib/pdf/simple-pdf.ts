/**
 * Gerador de PDF mínimo, sem dependências, para o MVP.
 *
 * PLACEHOLDER: o plano A é Typst (@myriaddreamin/typst-ts-node-compiler)
 * e o plano B é @react-pdf/renderer. Este gerador existe para o botão de
 * download funcionar desde já. Ele já segue as regras de ATS: coluna única,
 * fonte padrão (Helvetica), texto selecionável, sem imagens nem tabelas.
 */

export interface PdfLine {
  text: string;
  size?: number;
  bold?: boolean;
  /** Espaço extra antes da linha, em pontos */
  spaceBefore?: number;
  indent?: number;
}

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;

/** Caracteres fora do WinAnsi viram equivalentes simples. */
function toWinAnsi(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u2022/g, "-")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}

function escapePdfString(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/** Quebra aproximada por largura média de caractere da Helvetica. */
function wrap(text: string, size: number, maxWidth: number): string[] {
  const maxChars = Math.max(10, Math.floor(maxWidth / (size * 0.5)));
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > maxChars) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = (current + " " + word).trim();
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

export function buildSimplePdf(lines: PdfLine[], meta: { title?: string } = {}): Uint8Array {
  const pages: string[] = [];
  let ops: string[] = [];
  let y = PAGE_HEIGHT - MARGIN;

  const newPage = () => {
    pages.push(ops.join("\n"));
    ops = [];
    y = PAGE_HEIGHT - MARGIN;
  };

  for (const line of lines) {
    const size = line.size ?? 10.5;
    const leading = size * 1.35;
    const indent = line.indent ?? 0;
    y -= line.spaceBefore ?? 0;
    for (const chunk of wrap(toWinAnsi(line.text), size, PAGE_WIDTH - 2 * MARGIN - indent)) {
      if (y - leading < MARGIN) newPage();
      y -= leading;
      ops.push(
        `BT /${line.bold ? "F2" : "F1"} ${size} Tf ${(MARGIN + indent).toFixed(2)} ${y.toFixed(2)} Td (${escapePdfString(chunk)}) Tj ET`,
      );
    }
  }
  pages.push(ops.join("\n"));

  // Objetos: 1 catálogo, 2 páginas, 3 F1, 4 F2, 5 info, depois página+conteúdo
  const objects: string[] = [];
  const pageObjIds: number[] = [];
  const firstPageObj = 6;
  pages.forEach((_, i) => pageObjIds.push(firstPageObj + i * 2));

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  objects[5] = `<< /Title (${escapePdfString(toWinAnsi(meta.title ?? "Curriculo"))}) /Producer (MatchCV) >>`;

  pages.forEach((content, i) => {
    const pageId = pageObjIds[i];
    const contentId = pageId + 1;
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`;
  });

  let out = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = Buffer.byteLength(out, "latin1");
    out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) {
    out += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return new Uint8Array(Buffer.from(out, "latin1"));
}
