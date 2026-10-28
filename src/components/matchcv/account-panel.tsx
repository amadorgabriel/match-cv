"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clearLocalApplications, DATA_CLEARED_EVENT, resetPersistenceMode } from "@/lib/applications/browser";
import { ACCOUNT_CHANGED_EVENT, ANONYMOUS_ACCOUNT, canDeleteAccount, normalizeAccountState, type AccountState } from "@/lib/auth/account-state";
import { clearStoredKey } from "@/lib/client/key-storage";

interface Props {
  titleId?: string;
  surface?: "page" | "dialog";
  onClose?: () => void;
}

export function AccountPanel({ titleId, surface = "page", onClose }: Props) {
  const nameId = useId();
  const emailId = useId();
  const [account, setAccount] = useState<AccountState>(ANONYMOUS_ACCOUNT);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/account", { cache: "no-store" });
        if (!response.ok || cancelled) return;
        const next = normalizeAccountState(await response.json());
        if (!cancelled) setAccount(next);
      } catch {
        // Mantém o estado anônimo: sem sessão, a exclusão continua oculta.
      } finally {
        if (!cancelled) setReady(true);
      }
    }
    void load();
    const onChange = () => void load();
    window.addEventListener(ACCOUNT_CHANGED_EVENT, onChange);
    return () => {
      cancelled = true;
      window.removeEventListener(ACCOUNT_CHANGED_EVENT, onChange);
    };
  }, []);

  useEffect(() => {
    if (!canDeleteAccount(account)) setConfirmDelete(false);
  }, [account]);

  function publish(next: AccountState) {
    setAccount(next);
    resetPersistenceMode();
    window.dispatchEvent(new Event(ACCOUNT_CHANGED_EVENT));
  }

  async function signInLocal() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/account/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), name: name.trim() }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        user?: AccountState["user"];
        error?: { message?: string };
      };
      if (!response.ok || !body.user) {
        setError(body.error?.message ?? "Não foi possível entrar.");
        return;
      }
      const confirmed = await fetch("/api/account", { cache: "no-store" });
      const next = normalizeAccountState(await confirmed.json().catch(() => null));
      if (!next.authenticated || !next.user) {
        setError("A sessão não foi gravada.");
        return;
      }
      publish(next);
      setMessage("Sessão iniciada neste navegador.");
    } catch {
      setError("Não foi possível entrar.");
    } finally {
      setBusy(false);
    }
  }

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
    setBusy(true);
    setError(null);
    try {
      if (account.sessionKind === "better-auth") {
        await fetch("/api/auth/sign-out", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      } else {
        await fetch("/api/account/session", { method: "DELETE" });
      }
      publish({ ...ANONYMOUS_ACCOUNT, ...account, mode: "anonymous", authenticated: false, sessionKind: "none", user: null });
      setMessage("Sessão encerrada. Dá para continuar sem conta ou entrar de novo.");
    } catch {
      setError("Não foi possível encerrar a sessão.");
    } finally {
      setBusy(false);
    }
  }

  async function erase() {
    if (!canDeleteAccount(account)) return;
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
      publish({ ...ANONYMOUS_ACCOUNT, authEnabled: account.authEnabled, database: account.database, localAuth: account.localAuth });
      setConfirmDelete(false);
      setMessage("Conta, sessão, chaves e candidaturas foram excluídas.");
    } catch {
      setError("Não foi possível excluir os dados.");
    } finally {
      setBusy(false);
    }
  }

  const showDelete = canDeleteAccount(account);
  const heading = account.user ? "Sua conta" : account.authEnabled ? "Entrar" : "Entrar ou criar conta";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 id={titleId} className="text-lg font-semibold tracking-tight">
          {ready ? heading : "Conta"}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {account.user
            ? account.sessionKind === "local"
              ? "Sessão local neste navegador, em cookie HttpOnly cifrado."
              : "Sessão da conta ligada ao banco."
            : account.authEnabled
              ? "Entre com o link mágico ou com um provedor. Sem conta, a geração anônima continua disponível."
              : "Informe e-mail e nome para entrar. Se ainda não houver conta, ela é criada nesta sessão. Sem banco, o acesso fica num cookie cifrado."}
        </p>
      </div>

      {!ready ? <p className="text-muted-foreground text-sm">Carregando conta…</p> : null}

      {ready && account.user ? (
        <div className="flex flex-col gap-2 text-sm">
          <p className="font-medium">{account.user.name || account.user.email}</p>
          <p className="text-muted-foreground">{account.user.email}</p>
          <Link href="/dashboard" className="underline underline-offset-2" onClick={onClose}>
            Abrir candidaturas
          </Link>
          <Button type="button" variant="ghost" size="sm" className="self-start" onClick={signOut} disabled={busy}>
            Sair
          </Button>
        </div>
      ) : null}

      {ready && !account.user && !account.authEnabled ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void signInLocal();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={nameId}>Nome</Label>
            <Input id={nameId} name="name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={emailId}>E-mail</Label>
            <Input
              id={emailId}
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy || name.trim().length < 2 || !email.includes("@")}>
              Entrar
            </Button>
            <Button type="button" variant="outline" disabled={busy || name.trim().length < 2 || !email.includes("@")} onClick={() => void signInLocal()}>
              Criar conta
            </Button>
          </div>
        </form>
      ) : null}

      {ready && !account.user && account.authEnabled ? (
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={emailId}>E-mail</Label>
            <Input
              id={emailId}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <Button type="button" size="sm" className="self-start" onClick={sendMagicLink} disabled={busy || !email.includes("@")}>
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
            <p className="text-muted-foreground text-xs">OAuth fica ativo quando o client id e o segredo do provedor estão configurados.</p>
          ) : null}
          {devLink ? (
            <a href={devLink} className="break-all underline underline-offset-2">
              Abrir link de desenvolvimento
            </a>
          ) : null}
        </div>
      ) : null}

      {showDelete ? (
        <div className="border-t pt-3">
          {confirmDelete ? (
            <div className="flex flex-col gap-2 text-sm">
              <p>Isso apaga a conta, a sessão, as chaves cifradas e as candidaturas. Não dá para desfazer.</p>
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
      ) : null}

      {surface === "dialog" ? (
        <Link href="/conta" className="text-sm underline underline-offset-2" onClick={onClose}>
          Abrir a página de conta
        </Link>
      ) : null}

      {message ? <p className="text-sm text-emerald-700 dark:text-emerald-300">{message}</p> : null}
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  );
}
