import type { Cv } from "@/lib/schemas/outputs";

import { buildSimplePdf, type PdfLine } from "./simple-pdf";

const HEADINGS = {
  "pt-BR": { summary: "Resumo", experience: "Experiência", education: "Formação", skills: "Habilidades", certifications: "Certificações", languages: "Idiomas", current: "atual" },
  en: { summary: "Summary", experience: "Experience", education: "Education", skills: "Skills", certifications: "Certifications", languages: "Languages", current: "present" },
} as const;

/** Template ATS de coluna única. PLACEHOLDER do template Typst. */
export function cvToPdf(cv: Cv): Uint8Array {
  const h = HEADINGS[cv.language] ?? HEADINGS["pt-BR"];
  const section = (title: string): PdfLine => ({ text: title.toUpperCase(), size: 11.5, bold: true, spaceBefore: 10 });
  const contact = [cv.contact.email, cv.contact.phone, cv.contact.location, ...cv.contact.links].filter(Boolean).join(" | ");

  const lines: PdfLine[] = [
    { text: cv.fullName, size: 18, bold: true },
    { text: cv.headline, size: 12 },
    { text: contact, size: 9.5 },
    section(h.summary),
    { text: cv.summary },
    section(h.experience),
  ];

  for (const exp of cv.experience) {
    const period = [exp.start, exp.end ?? h.current].filter(Boolean).join(" - ");
    lines.push({ text: `${exp.role} | ${exp.company}`, bold: true, spaceBefore: 6 });
    lines.push({ text: [period, exp.location].filter(Boolean).join(" | "), size: 9.5 });
    for (const b of exp.bullets) lines.push({ text: `- ${b}`, indent: 8 });
  }

  lines.push(section(h.education));
  for (const ed of cv.education) {
    const period = [ed.start, ed.end].filter(Boolean).join(" - ");
    lines.push({ text: [ed.degree, ed.institution, period].filter(Boolean).join(" | ") });
  }

  lines.push(section(h.skills), { text: cv.skills.join(", ") });
  if (cv.certifications.length) lines.push(section(h.certifications), { text: cv.certifications.join(", ") });
  if (cv.languages.length) lines.push(section(h.languages), { text: cv.languages.join(", ") });

  return buildSimplePdf(lines, { title: `${cv.fullName} - CV` });
}
