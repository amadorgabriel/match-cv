import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { connection } from "next/server";

import { SiteFooter, SiteHeader } from "@/components/matchcv/site-header";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Nonce da CSP exige render no request. O layout inteiro fica dinâmico.
export const instant = false;

const title = "MatchCV | Candidaturas para vagas de TI";
const description =
  "Envie seu currículo e a vaga e receba CV ATS em PDF, e-mail, cover letter, roteiro de entrevista e faixa salarial.";

export const metadata: Metadata = {
  metadataBase: new URL("https://match-cv-app.vercel.app"),
  title,
  description,
  openGraph: {
    title,
    description,
    url: "/",
    siteName: "MatchCV",
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Nonce da CSP só existe no request. Sem isso a página sai estática e o Next não injeta o nonce.
  await connection();
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      {/* ColorZilla e extensões parecidas escrevem cz-shortcut-listen no body depois do SSR. */}
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <SiteHeader />
        <main className="flex flex-1 flex-col px-4 py-10">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
