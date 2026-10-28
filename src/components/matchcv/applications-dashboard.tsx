"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { SavedMaterials } from "@/components/matchcv/saved-materials";
import { listApplications, removeApplication, updateApplication, DATA_CLEARED_EVENT } from "@/lib/applications/browser";
import { ACCOUNT_CHANGED_EVENT } from "@/lib/auth/account-state";
import { filterApplications } from "@/lib/applications/store";
import { APPLICATION_STATUSES, STATUS_LABEL, type ApplicationStatus, type JobApplication } from "@/lib/applications/types";

export function ApplicationsDashboard() {
  const [items, setItems] = useState<JobApplication[] | null>(null);
  const [status, setStatus] = useState<ApplicationStatus | "todos">("todos");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function reload() {
    try {
      setItems(await listApplications());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar as candidaturas.");
      setItems([]);
    }
  }

  useEffect(() => {
    let cancelled = false;
    listApplications()
      .then((next) => {
        if (!cancelled) setItems(next);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Não foi possível carregar as candidaturas.");
        setItems([]);
      });
    const onClear = () => {
      setSelectedId(null);
      void reload();
    };
    window.addEventListener(DATA_CLEARED_EVENT, onClear);
    window.addEventListener(ACCOUNT_CHANGED_EVENT, onClear);
    return () => {
      cancelled = true;
      window.removeEventListener(DATA_CLEARED_EVENT, onClear);
      window.removeEventListener(ACCOUNT_CHANGED_EVENT, onClear);
    };
  }, []);

  const visible = filterApplications(items ?? [], {
    status: status === "todos" ? undefined : status,
    query,
  });
  const selected = items?.find((item) => item.id === selectedId) ?? null;

  function open(item: JobApplication) {
    setSelectedId(item.id);
    setNotes(item.notes);
    setConfirmDelete(false);
    setError(null);
  }

  async function changeStatus(next: ApplicationStatus) {
    if (!selected) return;
    try {
      const updated = await updateApplication(selected.id, { status: next });
      setItems((current) => current?.map((item) => (item.id === updated.id ? updated : item)) ?? [updated]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível atualizar o status.");
    }
  }

  async function saveNotes() {
    if (!selected) return;
    try {
      const updated = await updateApplication(selected.id, { notes });
      setItems((current) => current?.map((item) => (item.id === updated.id ? updated : item)) ?? [updated]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar as anotações.");
    }
  }

  async function remove() {
    if (!selected) return;
    try {
      await removeApplication(selected.id);
      setItems((current) => current?.filter((item) => item.id !== selected.id) ?? []);
      setSelectedId(null);
      setConfirmDelete(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível excluir a candidatura.");
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Candidaturas</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Empresa, vaga, data e status. Sem login, a lista fica neste navegador. Com a sessão local, ela fica ligada à sua conta neste navegador. Com banco, ela fica no servidor.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Buscar
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Empresa, vaga ou anotação"
            className="border-input bg-background h-8 rounded-lg border px-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Filtrar por status
          <select
            aria-label="Filtrar por status"
            value={status}
            onChange={(event) => setStatus(event.target.value as ApplicationStatus | "todos")}
            className="border-input bg-background h-8 rounded-lg border px-2"
          >
            <option value="todos">Todos</option>
            {APPLICATION_STATUSES.map((item) => (
              <option key={item} value={item}>
                {STATUS_LABEL[item]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {items === null ? <p className="text-muted-foreground text-sm">Carregando candidaturas…</p> : null}
      {items && visible.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {items.length === 0
            ? "Nenhuma candidatura salva. Gere os materiais e use Salvar candidatura no Dashboard."
            : "Nenhuma candidatura com esse filtro."}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <ul className="flex flex-col gap-2">
          {visible.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => open(item)}
                className={`hover:bg-muted/60 w-full rounded-lg border p-3 text-left ${selectedId === item.id ? "border-primary" : ""}`}
              >
                <span className="flex items-start justify-between gap-3">
                  <span>
                    <span className="block font-medium">{item.company}</span>
                    <span className="text-muted-foreground block text-sm">{item.role}</span>
                  </span>
                  <span className="bg-muted rounded-full px-2 py-0.5 text-xs">{STATUS_LABEL[item.status]}</span>
                </span>
                <span className="text-muted-foreground mt-2 block text-xs">
                  {new Date(item.appliedAt).toLocaleDateString("pt-BR")}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {selected ? (
          <section className="flex flex-col gap-4 rounded-lg border p-4">
            <div>
              <h2 className="text-lg font-semibold">{selected.role}</h2>
              <p className="text-muted-foreground text-sm">{selected.company}</p>
            </div>
            <label className="flex flex-col gap-1 text-sm">
              Status da candidatura
              <select
                aria-label="Status da candidatura"
                value={selected.status}
                onChange={(event) => changeStatus(event.target.value as ApplicationStatus)}
                className="border-input bg-background h-8 rounded-lg border px-2"
              >
                {APPLICATION_STATUSES.map((item) => (
                  <option key={item} value={item}>
                    {STATUS_LABEL[item]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Anotações
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} className="border-input bg-background rounded-lg border p-2" />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={saveNotes}>
                Salvar anotações
              </Button>
              {confirmDelete ? (
                <>
                  <Button type="button" variant="destructive" onClick={remove}>
                    Excluir candidatura
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>
                    Cancelar
                  </Button>
                </>
              ) : (
                <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)}>
                  Excluir candidatura
                </Button>
              )}
            </div>
            <SavedMaterials materials={selected.materials} company={selected.company} />
          </section>
        ) : null}
      </div>
    </div>
  );
}
