import { readFile } from "node:fs/promises";
import path from "node:path";

import { ImageResponse } from "next/og";

export const openGraphSize = { width: 1200, height: 630 };
export const openGraphContentType = "image/png";
export const openGraphAlt = "MatchCV: do currículo à candidatura completa, para vagas de TI";

const CHIPS = ["CV ATS", "E-mail", "Cover letter", "Entrevista", "Faixa salarial"];

/** Card 1200×630 com a marca do app. A fonte Inter fica no repositório (OFL). */
export async function matchCvOpenGraphImage() {
  const [regular, semibold] = await Promise.all([
    readFile(path.join(process.cwd(), "src/fonts/Inter-Regular.ttf")),
    readFile(path.join(process.cwd(), "src/fonts/Inter-SemiBold.ttf")),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#fafafa",
          color: "#1c1c1c",
          padding: "72px",
          fontFamily: "Inter",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              border: "1px solid #e5e5e5",
              background: "#f4f4f5",
              color: "#525252",
              borderRadius: "999px",
              padding: "8px 16px",
              fontSize: 22,
            }}
          >
            Para vagas de TI, sem cadastro
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 92, fontWeight: 600, letterSpacing: -2, lineHeight: 1 }}>
            <span>Match</span>
            <span style={{ color: "#525252" }}>CV</span>
          </div>
          <div style={{ display: "flex", marginTop: 24, fontSize: 36, color: "#525252", lineHeight: 1.3 }}>
            Do currículo à candidatura completa
          </div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          {CHIPS.map((chip) => (
            <div
              key={chip}
              style={{
                display: "flex",
                border: "1px solid #e5e5e5",
                background: "#ffffff",
                borderRadius: 16,
                padding: "12px 18px",
                fontSize: 22,
              }}
            >
              {chip}
            </div>
          ))}
        </div>
      </div>
    ),
    {
      ...openGraphSize,
      fonts: [
        { name: "Inter", data: regular, weight: 400, style: "normal" },
        { name: "Inter", data: semibold, weight: 600, style: "normal" },
      ],
    },
  );
}
