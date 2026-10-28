import Link from "next/link";

import { AccountMenu } from "./account-menu";

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Match<span className="text-primary/70">CV</span>
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/gerar" className="text-muted-foreground hover:text-foreground px-2 py-1">
            Gerar
          </Link>
          <Link href="/dashboard" className="text-muted-foreground hover:text-foreground px-2 py-1">
            Candidaturas
          </Link>
          <AccountMenu />
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="text-muted-foreground border-t py-6 text-center text-xs">
      Sem conta, a chave fica só nesta aba. Com conta, ela é cifrada e as candidaturas ficam no dashboard.
    </footer>
  );
}
