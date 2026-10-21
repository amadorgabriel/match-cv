import { Document, Font, Page, StyleSheet, Text } from "@react-pdf/renderer";

// ATS lê palavras inteiras. A hifenização padrão parte o texto no meio.
Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 50,
    fontFamily: "Helvetica",
    fontSize: 11,
    lineHeight: 1.45,
    color: "#111111",
  },
  name: { fontFamily: "Helvetica-Bold", fontSize: 16, marginBottom: 2 },
  meta: { fontSize: 11, marginBottom: 12 },
  heading: { fontFamily: "Helvetica-Bold", fontSize: 12, marginBottom: 10 },
  paragraph: { marginBottom: 10 },
});

/** Cover letter em coluna única, mesma fonte padrão do CV. */
export function CoverLetterDocument({
  body,
  fullName,
  company,
}: {
  body: string;
  fullName?: string;
  company?: string;
}) {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
  const title = [fullName, company, "Cover letter"].filter(Boolean).join(" - ");

  return (
    <Document title={title} author={fullName || "MatchCV"} creator="MatchCV" producer="MatchCV" language="pt-BR">
      <Page size="A4" style={styles.page}>
        {fullName ? <Text style={styles.name}>{fullName}</Text> : null}
        {company ? <Text style={styles.meta}>{company}</Text> : null}
        <Text style={styles.heading}>Cover letter</Text>
        {paragraphs.map((paragraph, index) => (
          <Text key={`${index}-${paragraph.slice(0, 24)}`} style={styles.paragraph}>
            {paragraph}
          </Text>
        ))}
      </Page>
    </Document>
  );
}
