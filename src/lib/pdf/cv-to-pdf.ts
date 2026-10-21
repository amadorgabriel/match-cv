import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";

import type { Cv } from "@/lib/schemas/outputs";

import { CvDocument } from "./cv-document";

/** Gera o PDF ATS no servidor com @react-pdf/renderer. */
export async function cvToPdf(cv: Cv): Promise<Uint8Array> {
  const buffer = await renderToBuffer(createElement(CvDocument, { cv }));
  return new Uint8Array(buffer);
}
