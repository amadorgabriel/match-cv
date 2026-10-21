import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { PDF_ONLY_MESSAGE, POST, SCANNED_PDF_MESSAGE } from "./route";

function buildPdf(content: string): Uint8Array {
  const len = Buffer.byteLength(content, "latin1");
  const objects = [
    null,
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${len} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets = [0];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = Buffer.byteLength(out, "latin1");
    out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) out += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Uint8Array(Buffer.from(out, "latin1"));
}

function upload(name: string, bytes: Uint8Array, type: string) {
  const file = new File([Buffer.from(bytes)], name, { type });
  const form = new FormData();
  form.append("file", file);
  return new Request("http://localhost/api/parse", { method: "POST", body: form });
}

const ONE_COLUMN = buildPdf(
  "BT /F1 12 Tf 50 700 Td (Ana Silva desenvolvedora full stack com experiencia em TypeScript React e Node no Brasil.) Tj ET",
);
const TWO_COLUMNS = buildPdf(
  "BT /F1 11 Tf 40 700 Td (Coluna esquerda: Ana Silva, TypeScript, React, cinco anos de experiencia.) Tj ET BT /F1 11 Tf 320 700 Td (Coluna direita: Node.js, PostgreSQL, lideranca de squad e deploys.) Tj ET",
);
const SCANNED = buildPdf("1 0 0 rg 40 40 200 80 re f");

describe("POST /api/parse", () => {
  it("extrai texto de PDF de uma coluna e de duas colunas", async () => {
    const one = await POST(upload("cv.pdf", ONE_COLUMN, "application/pdf"));
    const two = await POST(upload("cv.pdf", TWO_COLUMNS, "application/pdf"));
    expect(one.status).toBe(200);
    expect(two.status).toBe(200);
    const oneBody = (await one.json()) as { text: string };
    const twoBody = (await two.json()) as { text: string };
    expect(oneBody.text).toMatch(/Ana Silva/);
    expect(twoBody.text).toMatch(/Coluna esquerda/);
    expect(twoBody.text).toMatch(/Coluna direita/);
  });

  it("recusa PDF escaneado, DOCX e arquivo sem cabeçalho %PDF", async () => {
    const scanned = await POST(upload("scan.pdf", SCANNED, "application/pdf"));
    const docx = await POST(
      upload("cv.docx", new TextEncoder().encode("PK fake docx"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    );
    const fake = await POST(upload("cv.pdf", new TextEncoder().encode("nao e pdf, so texto longo demais para passar"), "application/pdf"));

    expect(scanned.status).toBe(422);
    expect(((await scanned.json()) as { error: { message: string } }).error.message).toBe(SCANNED_PDF_MESSAGE);
    expect(docx.status).toBe(415);
    expect(((await docx.json()) as { error: { message: string } }).error.message).toBe(PDF_ONLY_MESSAGE);
    expect(fake.status).toBe(415);
    expect(((await fake.json()) as { error: { message: string } }).error.message).toBe(PDF_ONLY_MESSAGE);
  });
});
