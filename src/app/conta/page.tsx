import type { Metadata } from "next";

import { AccountPanel } from "@/components/matchcv/account-panel";

export const metadata: Metadata = {
  title: "Conta | MatchCV",
  description: "Entre ou crie sua conta. Sem Postgres, a sessão fica num cookie HttpOnly cifrado.",
};

export default function ContaPage() {
  return (
    <div className="mx-auto w-full max-w-lg rounded-xl border p-5">
      <AccountPanel surface="page" />
    </div>
  );
}
