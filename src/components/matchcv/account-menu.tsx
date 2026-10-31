"use client";

import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ACCOUNT_CHANGED_EVENT, ANONYMOUS_ACCOUNT, normalizeAccountState, type AccountState } from "@/lib/auth/account-state";

import { AccountPanel } from "./account-panel";

export function AccountMenu() {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState<AccountState>(ANONYMOUS_ACCOUNT);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/account", { cache: "no-store" });
        if (!response.ok || cancelled) return;
        const next = normalizeAccountState(await response.json());
        if (!cancelled) setAccount(next);
      } catch {
        if (!cancelled) setAccount(ANONYMOUS_ACCOUNT);
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
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
  }, [open]);

  function close() {
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
    setOpen(false);
  }

  const label = account.user?.email || "Conta";

  return (
    <>
      <Button type="button" variant="outline" size="sm" aria-haspopup="dialog" aria-expanded={open} aria-controls={titleId} onClick={() => setOpen(true)}>
        <span className="max-w-40 truncate">{label}</span>
      </Button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="fixed top-1/2 left-1/2 z-50 m-0 max-h-[min(40rem,calc(100vh-2rem))] w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-background p-5 text-foreground shadow-xl backdrop:bg-black/50"
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <div className="mb-3 flex justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={close}>
            Fechar
          </Button>
        </div>
        {open ? <AccountPanel titleId={titleId} surface="dialog" onClose={close} /> : null}
      </dialog>
    </>
  );
}
