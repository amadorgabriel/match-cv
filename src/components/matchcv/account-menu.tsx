"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { clearLocalApplications, DATA_CLEARED_EVENT } from "@/lib/applications/browser";
import { clearStoredKey } from "@/lib/client/key-storage";

interface AccountState {
  mode: "anonymous" | "authenticated";
  authEnabled: boolean;
  database: boolean;
  magicLink: boolean;
  github: boolean;
  google: boolean;
  emailDelivery: boolean;
  user: { id: string; email: string; name: string } | null;
}

const ANONYMOUS: AccountState = {
  mode: "anonymous",
  authEnabled: false,
  database: false,
  magicLink: false,
  github: false,
  google: false,
  emailDelivery: false,
  user: null,
};

export function AccountMenu() {
  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState<AccountState>(ANONYMOUS);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/account", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok || cancelled) return;
        const body = (await response.json()) as AccountState;
        if (!cancelled) setAccount({ ...ANONYMOUS, ...body });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function sendMagicLink() {
    setBusy(true);
    setError(null);
    setMessage(null);
    setDevLink(null);
    try {
      const response = await fetch("/api/auth/sign-in/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), callbackURL: "/dashboard" }),
      });
      const body = (await response.json().catch(() => ({}))) as { message?: string; error?: { message?: string } };
      if (!response.ok) {
        setError(body.error?.message ?? body.message ?? "Não foi possível enviar o link.");
        return;
      }
      setMessage(account.emailDelivery ? "Enviamos um link de acesso para o e-mail." : "Link gerado neste ambiente.");
      const dev = await fetch(`/api/auth/dev/magic-link?email=${encodeURIComponent(email.trim())}`);
      if (dev.ok) {
        const link = (await dev.json()) as { url?: string };
        if (link.url) setDevLink(link.url);
      }
    } catch {
      setError("Não foi possível enviar o link.");
    } finally {
      setBusy(false);
    }
  }

  async function oauth(provider: "github" | "google") {
    setError(null);
    const response = await fetch("/api/auth/sign-in/social", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, callbackURL: "/dashboard" }),
    });
    const body = (await response.json().catch(() => ({}))) as { url?: string; message?: string; error?: { message?: string } };
    if (body.url) {
      window.location.href = body.url;
      return;
    }
    setError(body.error?.message ?? body.message ?? "Não foi possível iniciar o login.");
  }

  async function signOut() {
    await fetch("/api/auth/sign-out", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    setAccount({ ...account, mode: "anonymous", user: null });
    setMessage("Sessão encerrada. O modo anônimo continua disponível.");
  }

  async function erase() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/account", { method: "DELETE" });
      const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!response.ok) {
        setError(body.error?.message ?? "Não foi possível excluir os dados.");
        return;
      }
      await clearLocalApplications();
      clearStoredKey();
      window.dispatchEvent(new Event(DATA_CLEARED_EVENT));
      setAccount({ ...ANONYMOUS, ...account, mode: "anonymous", user: null });
      setConfirmDelete(false);
      setMessage("Conta e dados excluídos neste ambiente.");
    } catch {
      setError("Não foi possível excluir os dados.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <Button type="button" variant="outline" size="sm" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((value) => !value)}>
        {account.user ? account.user.email : "Conta"}
      </Button>
      {open ? (
        <div role="dialog" aria-label="Conta" className="bg-popover absolute right-0 z-20 mt-2 w-80 rounded-lg border p-4 shadow-md">
          {account.user ? (
            <div className="flex flex-col gap-2 text-sm">
              <p className="font-medium">{account.user.name || account.user.email}</p>
              <p className="text-muted-foreground">{account.user.email}</p>
              <Link href="/dashboard" className="underline underline-offset-2" onClick={() => setOpen(false)}>
                Abrir candidaturas
              </Link>
              <Button type="button" variant="ghost" size="sm" className="self-start" onClick={signOut}>
                Sair
              </Button>
            </div>
          ) : account.authEnabled ? (
            <div className="flex flex-col gap-3 text-sm">
              <p className="font-medium">Entrar</p>
              <p className="text-muted-foreground">O modo anônimo continua disponível sem conta.</p>
              <label className="flex flex-col gap-1">
                E-mail
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="border-input bg-background h-8 rounded-lg border px-2"
                  autoComplete="email"
                />
              </label>
              <Button type="button" size="sm" onClick={sendMagicLink} disabled={busy || !email.includes("@")}>
                Enviar link mágico
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" disabled={!account.github} onClick={() => oauth("github")}>
                  GitHub
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={!account.google} onClick={() => oauth("google")}>
                  Google
                </Button>
              </div>
              {!account.github || !account.google ? (
                <p className="text-muted-foreground text-xs">OAuth aparece ativo quando o client id e o segredo do provedor estão configurados.</p>
              ) : null}
              {devLink ? (
                <a href={devLink} className="break-all underline underline-offset-2">
                  Abrir link de desenvolvimento
                </a>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col gap-2 text-sm">
              <p className="font-medium">Modo local/anônimo</p>
              <p className="text-muted-foreground">
                Login desligado neste ambiente. Dá para gerar materiais, salvar a chave num cofre cifrado deste navegador e usar o dashboard sem conta.
              </p>
            </div>
          )}

          <div className="mt-4 border-t pt-3">
            {confirmDelete ? (
              <div className="flex flex-col gap-2 text-sm">
                <p>Isso apaga a conta, as chaves cifradas e as candidaturas. Não dá para desfazer.</p>
                <div className="flex gap-2">
                  <Button type="button" variant="destructive" size="sm" onClick={erase} disabled={busy}>
                    Excluir agora
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <Button type="button" variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
                Excluir conta e todos os dados (LGPD)
              </Button>
            )}
          </div>
          {message ? <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">{message}</p> : null}
          {error ? <p className="text-destructive mt-3 text-sm">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
