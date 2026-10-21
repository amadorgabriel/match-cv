import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { Cv } from "@/lib/schemas/outputs";

// ATS lê palavras inteiras. A hifenização padrão parte o texto no meio.
Font.registerHyphenationCallback((word) => [word]);

const HEADINGS = {
  "pt-BR": {
    summary: "Resumo",
    experience: "Experiência",
    education: "Formação",
    skills: "Habilidades",
    certifications: "Certificações",
    languages: "Idiomas",
    current: "atual",
  },
  en: {
    summary: "Summary",
    experience: "Experience",
    education: "Education",
    skills: "Skills",
    certifications: "Certifications",
    languages: "Languages",
    current: "present",
  },
} as const;

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 50,
    fontFamily: "Helvetica",
    fontSize: 11,
    lineHeight: 1.4,
    color: "#111111",
  },
  name: { fontFamily: "Helvetica-Bold", fontSize: 18, marginBottom: 2 },
  headline: { fontSize: 12, marginBottom: 4 },
  contact: { fontSize: 9, marginBottom: 8 },
  heading: { fontFamily: "Helvetica-Bold", fontSize: 12, marginTop: 12, marginBottom: 4 },
  role: { fontFamily: "Helvetica-Bold", fontSize: 11, marginTop: 6 },
  meta: { fontSize: 9, marginBottom: 2 },
  bullet: { marginLeft: 12, marginBottom: 1 },
  line: { marginBottom: 2 },
});

export function cvPdfFilename(fullName: string): string {
  const safe = fullName.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "");
  return `${safe || "cv"}-CV.pdf`;
}

/** CV de coluna única, fonte padrão e texto real. Sem tabela e sem imagem. */
export function CvDocument({ cv }: { cv: Cv }) {
  const h = HEADINGS[cv.language] ?? HEADINGS["pt-BR"];
  const contact = [cv.contact.email, cv.contact.phone, cv.contact.location, ...cv.contact.links].filter(Boolean).join(" | ");

  return (
    <Document
      title={`${cv.fullName} - CV`}
      author={cv.fullName}
      creator="MatchCV"
      producer="MatchCV"
      language={cv.language === "en" ? "en-US" : "pt-BR"}
    >
      <Page size="A4" style={styles.page}>
        <Text style={styles.name}>{cv.fullName}</Text>
        <Text style={styles.headline}>{cv.headline}</Text>
        {contact ? <Text style={styles.contact}>{contact}</Text> : null}

        <Text style={styles.heading}>{h.summary}</Text>
        <Text>{cv.summary}</Text>

        <Text style={styles.heading}>{h.experience}</Text>
        {cv.experience.map((exp) => {
          const period = [exp.start, exp.end ?? h.current].filter(Boolean).join(" - ");
          const meta = [period, exp.location].filter(Boolean).join(" | ");
          return (
            <View key={`${exp.company}-${exp.role}-${exp.start}`}>
              <Text style={styles.role}>
                {exp.role} | {exp.company}
              </Text>
              {meta ? <Text style={styles.meta}>{meta}</Text> : null}
              {exp.bullets.map((bullet) => (
                <Text key={bullet} style={styles.bullet}>
                  - {bullet}
                </Text>
              ))}
            </View>
          );
        })}

        <Text style={styles.heading}>{h.education}</Text>
        {cv.education.map((ed) => {
          const period = [ed.start, ed.end].filter(Boolean).join(" - ");
          return (
            <Text key={`${ed.institution}-${ed.degree}`} style={styles.line}>
              {[ed.degree, ed.institution, period].filter(Boolean).join(" | ")}
            </Text>
          );
        })}

        <Text style={styles.heading}>{h.skills}</Text>
        <Text>{cv.skills.join(", ")}</Text>

        {cv.certifications.length > 0 ? (
          <View>
            <Text style={styles.heading}>{h.certifications}</Text>
            <Text>{cv.certifications.join(", ")}</Text>
          </View>
        ) : null}

        {cv.languages.length > 0 ? (
          <View>
            <Text style={styles.heading}>{h.languages}</Text>
            <Text>{cv.languages.join(", ")}</Text>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}
