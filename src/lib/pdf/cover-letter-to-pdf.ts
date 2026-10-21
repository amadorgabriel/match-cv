import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";

import { CoverLetterDocument } from "./cover-letter-document";

/** Gera o PDF da cover letter com o mesmo renderer do CV. */
export async function coverLetterToPdf(input: {
  body: string;
  fullName?: string;
  company?: string;
}): Promise<Uint8Array> {
  const element = createElement(CoverLetterDocument, input) as ReactElement<DocumentProps>;
  const buffer = await renderToBuffer(element);
  return new Uint8Array(buffer);
}
