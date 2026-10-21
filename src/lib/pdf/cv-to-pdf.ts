import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";

import type { Cv } from "@/lib/schemas/outputs";

import { CvDocument } from "./cv-document";

/** Gera o PDF ATS no servidor com @react-pdf/renderer. */
export async function cvToPdf(cv: Cv): Promise<Uint8Array> {
  // CvDocument devolve <Document>, que é o que o renderer aceita em runtime.
  const element = createElement(CvDocument, { cv }) as ReactElement<DocumentProps>;
  const buffer = await renderToBuffer(element);
  return new Uint8Array(buffer);
}
