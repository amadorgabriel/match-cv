"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { ProviderId } from "@/lib/ai/catalog";

interface KeyMetadata {
  id: string;
  provider: ProviderId;
  last4: string;
  status: "active" | "invalid";
  createdAt: string;
  updatedAt: string;
}

interface Props {
  provider: ProviderId;
  apiKey: string;
  useSaved: boolean;
  onUseSavedChange: (value: boolean) => void;
}

export function SavedKeyControls({ provider, apiKey, useSaved, onUseSavedChange }: Props) {
  const [keys, setKeys] = useState<KeyMetadata[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const saved = keys.find((key) => key.provider === provider) ?? null;

  async function reload() {
    const response = await fetch("/api/keys", { cache: "no-store" });
    if (!response.ok) return;
    const body = (await response.json()) as { keys?: KeyMetadata[] };
    setKeys(body.keys ?? []);
    setLoaded(true);
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/keys", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok || cancelled) return;
        const body = (await response.json()) as { keys?: KeyMetadata[] };
        if (!cancelled) setKeys(body.keys ?? []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loaded || !useSaved) return;
    if (!saved || saved.status !== "active") onUseSavedChange(false);
  }, [loaded, useSaved, saved, onUseSavedChange]);

  async function save() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey: apiKey.trim() }),
      });
      const body = (await response.json()) as { error?: { message?: string }; key?: KeyMetadata };
      if (!response.ok || !body.key) {
        setError(body.error?.message ?? "Não foi possível salvar a chave.");
        return;
      }
      setMessage(`Chave salva ••••${body.key.last4}. O valor não volta para esta tela.`);
      onUseSavedChange(true);
      await reload();
    } catch {
      setError("Não foi possível salvar a chave.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!saved) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: saved.id }),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: { message?: string } };
        setError(body.error?.message ?? "Não foi possível excluir a chave.");
        return;
      }
      onUseSavedChange(false);
      setConfirmDelete(false);
      setMessage("Chave excluída de forma definitiva.");
      await reload();
    } catch {
      setError("Não foi possível excluir a chave.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-muted/40 flex flex-col gap-2 rounded-lg border p-3">
      {saved ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={useSaved && saved.status === "active"}
            disabled={saved.status !== "active"}
            onChange={(event) => onUseSavedChange(event.target.checked)}
            className="accent-primary size-4"
          />
          Usar chave salva ••••{saved.last4}
          {saved.status === "invalid" ? <span className="text-destructive">inválida</span> : null}
        </label>
      ) : (
        <p className="text-muted-foreground text-xs">Nenhuma chave cifrada para este provedor.</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={save} disabled={busy || apiKey.trim().length < 10}>
          {saved ? "Trocar chave salva" : "Salvar chave criptografada"}
        </Button>
        {saved && !confirmDelete ? (
          <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)} disabled={busy}>
            Excluir chave
          </Button>
        ) : null}
      </div>
      {confirmDelete ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>Excluir a chave de forma definitiva?</span>
          <Button type="button" variant="destructive" size="sm" onClick={remove} disabled={busy}>
            Excluir agora
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
            Cancelar
          </Button>
        </div>
      ) : null}
      {message ? <p className="text-sm text-emerald-700 dark:text-emerald-300">{message}</p> : null}
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  );
}
