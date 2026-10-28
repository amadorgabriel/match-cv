"use client";

import { EyeIcon, EyeOffIcon, KeyRoundIcon, LoaderCircleIcon, SparklesIcon } from "lucide-react";
import { useMemo, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  defaultSelectableProvider,
  isFreeModel,
  isProviderId,
  isSelectableProvider,
  modelTierLabel,
  PROVIDERS,
  selectableModels,
  selectableProviders,
  type ModelOption,
  type ProviderId,
  type ProviderOption,
} from "@/lib/ai/catalog";
import { validateKey } from "@/lib/client/api";
import { defaultDocuments, validateDocuments, type DocumentDraft } from "@/lib/documents/compose";
import { clearStoredKey, parseStoredKey, readStoredKey, saveStoredKey, subscribeNoop } from "@/lib/client/key-storage";
import { maskKey } from "@/lib/client/mask";
import {
  DEFAULT_OUTPUT_SELECTION,
  LIMITS,
  OutputSelectionSchema,
  type OutputId,
  type OutputSelection,
} from "@/lib/schemas/requests";

import { DocumentFieldGroup } from "./document-field-group";
import { SavedKeyControls } from "./saved-key-controls";
import type { FormValues } from "./types";

const OUTPUT_OPTIONS: { id: OutputId; label: string }[] = [
  { id: "cv", label: "CV PDF" },
  { id: "email", label: "Template de e-mail" },
  { id: "cover-letter", label: "Cover letter" },
  { id: "interview", label: "Roteiro de entrevista" },
  { id: "salary", label: "Faixa salarial" },
];

interface Props {
  initial?: FormValues | null;
  onSubmit: (values: FormValues) => void;
}

export function FormStep({ initial, onSubmit }: Props) {
  // Chave lembrada nesta aba (sessionStorage). Lida sem efeito para não causar re-render em cascata.
  const storedRaw = useSyncExternalStore(subscribeNoop, readStoredKey, () => null);
  const [forgotten, setForgotten] = useState(false);
  const parsedStored = useMemo(() => parseStoredKey(storedRaw), [storedRaw]);
  const stored = forgotten ? null : parsedStored;

  const [documents, setDocuments] = useState<DocumentDraft[]>(() => (initial?.documents?.length ? initial.documents : defaultDocuments()));
  const [jobDescription, setJobDescription] = useState(initial?.jobDescription ?? "");
  const [outputs, setOutputs] = useState<OutputSelection>(initial?.outputs ?? DEFAULT_OUTPUT_SELECTION);
  const [providerInput, setProvider] = useState<ProviderId | null>(initial?.provider ?? null);
  const [modelInput, setModel] = useState<string | null>(initial?.model ?? null);
  const [apiKeyInput, setApiKey] = useState<string | null>(initial?.apiKey ?? null);
  const [rememberInput, setRemember] = useState<boolean | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [useSaved, setUseSaved] = useState(Boolean(initial?.useSavedKey));
  const [freeOnly, setFreeOnly] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [keyStatus, setKeyStatus] = useState<{ state: "idle" | "testing" | "ok" | "error"; message?: string }>({
    state: "idle",
  });

  const storedProvider =
    stored && isProviderId(stored.provider) && isSelectableProvider(stored.provider) ? stored.provider : null;
  const visibleProviders = useMemo(() => selectableProviders({ freeOnly }), [freeOnly]);
  const requestedProvider = providerInput ?? storedProvider ?? initial?.provider ?? null;
  const provider: ProviderId =
    requestedProvider &&
    isProviderId(requestedProvider) &&
    isSelectableProvider(requestedProvider) &&
    visibleProviders.some((item) => item.id === requestedProvider)
      ? requestedProvider
      : defaultSelectableProvider();
  const providerInfo = PROVIDERS[provider];
  const models = useMemo(() => selectableModels(providerInfo, { freeOnly }), [providerInfo, freeOnly]);
  const storedModel = storedProvider === provider ? stored?.model : undefined;
  const requestedModel = modelInput ?? storedModel ?? providerInfo.defaultModel;
  const model = models.some((item) => item.id === requestedModel)
    ? requestedModel
    : (models.find((item) => item.id === providerInfo.defaultModel)?.id ?? models[0]?.id ?? providerInfo.defaultModel);
  const apiKey = (storedProvider ? apiKeyInput ?? stored?.apiKey : apiKeyInput) ?? "";
  const remember = rememberInput ?? storedProvider !== null;

  const providerItems = useMemo(
    () => Object.fromEntries(visibleProviders.map((item) => [item.id, providerMenuLabel(item, freeOnly)])),
    [visibleProviders, freeOnly],
  );
  const modelItems = useMemo(
    () => Object.fromEntries(models.map((item) => [item.id, modelMenuLabel(item)])),
    [models],
  );
  const freeModels = models.filter((model) => isFreeModel(model));
  const paidModels = models.filter((model) => !isFreeModel(model));
  const freeProviders = visibleProviders.filter((item) => item.free);
  const paidProviders = visibleProviders.filter((item) => !item.free);

  function changeProvider(next: ProviderId) {
    setProvider(next);
    setModel(PROVIDERS[next].defaultModel);
    setKeyStatus({ state: "idle" });
  }

  function toggleOutput(id: OutputId) {
    setOutputs((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function validate(): Record<string, string> {
    const e: Record<string, string> = { ...validateDocuments(documents) };
    if (jobDescription.trim().length < 50) e.jobDescription = "Cole a descrição completa da vaga (mínimo de 50 caracteres).";
    if (jobDescription.length > LIMITS.maxJobDescriptionChars) e.jobDescription = "Descrição da vaga longa demais.";
    if (!useSaved && apiKey.trim().length < 10) e.apiKey = "Informe sua API key do provedor escolhido.";
    const selection = OutputSelectionSchema.safeParse(outputs);
    if (!selection.success) e.outputs = selection.error.issues[0]?.message ?? "Selecione ao menos um material.";
    return e;
  }

  async function testKey() {
    if (useSaved) {
      setKeyStatus({ state: "ok", message: "A chave salva já foi validada ao guardar." });
      return;
    }
    if (apiKey.trim().length < 10) {
      setErrors((prev) => ({ ...prev, apiKey: "Informe sua API key antes de testar." }));
      return;
    }
    setKeyStatus({ state: "testing" });
    try {
      const r = await validateKey(provider, apiKey.trim());
      setKeyStatus({ state: "ok", message: r.message ?? "Chave aceita pelo provedor." });
    } catch (err) {
      setKeyStatus({ state: "error", message: err instanceof Error ? err.message : "Chave recusada." });
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const values: FormValues = {
      documents,
      jobDescription: jobDescription.trim(),
      provider,
      model,
      apiKey: useSaved ? "" : apiKey.trim(),
      useSavedKey: useSaved || undefined,
      outputs,
    };
    if (useSaved) clearStoredKey();
    else if (remember) saveStoredKey({ provider, model, apiKey: values.apiKey });
    else clearStoredKey();
    onSubmit(values);
  }

  function forgetKey() {
    clearStoredKey();
    setForgotten(true);
    setApiKey("");
    setRemember(false);
    setKeyStatus({ state: "idle" });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sua candidatura</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Adicione o currículo e, se quiser, outros documentos. Cole a vaga e escolha a IA.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Documentos e vaga</CardTitle>
          <CardDescription>Um grupo só para currículo, conquistas e contexto extra. Cada item pode ser PDF ou texto.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <DocumentFieldGroup entries={documents} errors={errors} onChange={setDocuments} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="jd">Descrição da vaga</Label>
            <Textarea
              id="jd"
              rows={10}
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Cole aqui a job description completa: cargo, responsabilidades, requisitos e local."
              aria-invalid={!!errors.jobDescription}
            />
            {errors.jobDescription ? <p className="text-destructive text-sm">{errors.jobDescription}</p> : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Provedor de IA e sua chave</CardTitle>
          <CardDescription>
            Você usa a sua própria API key. Sem conta, ela fica só nesta página. Se quiser, salve uma cópia cifrada para reutilizar.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={freeOnly}
              onChange={(event) => setFreeOnly(event.target.checked)}
              className="accent-primary size-4"
            />
            Mostrar apenas gratuitos
          </label>
          <p className="text-muted-foreground text-xs">
            O padrão é o Gemini gratuito. Modelos com badge Pago usam o plano do provedor.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Provedor</Label>
              <Select
                key={freeOnly ? "providers-free" : "providers-all"}
                value={provider}
                items={providerItems}
                onValueChange={(v) => {
                  if (isProviderId(v)) changeProvider(v);
                }}
              >
                <SelectTrigger className="w-full" aria-label="Provedor de IA">
                  <SelectValue>{providerItems[provider]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <ModelGroup label="Com modelo gratuito" items={freeProviders} freeOnly={freeOnly} />
                  <ModelGroup label="Somente plano pago" items={paidProviders} freeOnly={freeOnly} />
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Modelo</Label>
              <Select
                key={freeOnly ? "models-free" : "models-all"}
                value={model}
                items={modelItems}
                onValueChange={(v) => typeof v === "string" && setModel(v)}
              >
                <SelectTrigger className="w-full" aria-label="Modelo">
                  <SelectValue>{modelItems[model]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <OptionGroup label="Gratuitos" models={freeModels} />
                  <OptionGroup label="Pagos" models={paidModels} />
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="api-key">API key ({providerInfo.label})</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <KeyRoundIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
                <Input
                  id="api-key"
                  type={showKey ? "text" : "password"}
                  autoComplete="off"
                  spellCheck={false}
                  data-1p-ignore
                  data-lpignore="true"
                  className="pl-8"
                  placeholder={providerInfo.keyHint}
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setKeyStatus({ state: "idle" });
                  }}
                  aria-invalid={!!errors.apiKey}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8"
                onClick={() => setShowKey((s) => !s)}
                aria-label={showKey ? "Ocultar chave" : "Mostrar chave"}
              >
                {showKey ? <EyeOffIcon /> : <EyeIcon />}
              </Button>
              <Button type="button" variant="secondary" onClick={testKey} disabled={keyStatus.state === "testing"}>
                {keyStatus.state === "testing" && <LoaderCircleIcon className="animate-spin" />}
                Testar chave
              </Button>
            </div>
            {errors.apiKey && <p className="text-destructive text-sm">{errors.apiKey}</p>}
            {keyStatus.state === "ok" && <p className="text-sm text-emerald-600">{keyStatus.message}</p>}
            {keyStatus.state === "error" && <p className="text-destructive text-sm">{keyStatus.message}</p>}
            <p className="text-muted-foreground text-xs">
              {apiKey ? `Chave em uso: ${maskKey(apiKey)}. ` : ""}
              Não tem uma?{" "}
              <a href={providerInfo.keyDocsUrl} target="_blank" rel="noreferrer noopener" className="underline underline-offset-2">
                Crie aqui
              </a>
              .
            </p>
            <SavedKeyControls provider={provider} apiKey={apiKey} useSaved={useSaved} onUseSavedChange={setUseSaved} />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="accent-primary size-4"
                />
                Lembrar nesta aba (some ao fechar a aba)
              </label>
              {stored && (
                <Button type="button" variant="link" size="sm" onClick={forgetKey}>
                  Esquecer chave
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle id="outputs-heading">3. Materiais para gerar</CardTitle>
          <CardDescription>Marque o que você quer receber. Pelo menos um item é obrigatório.</CardDescription>
        </CardHeader>
        <CardContent>
          <fieldset aria-labelledby="outputs-heading" aria-invalid={!!errors.outputs} className="flex flex-col gap-3">
            {OUTPUT_OPTIONS.map((option) => (
              <label key={option.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="outputs"
                  value={option.id}
                  checked={outputs[option.id]}
                  onChange={() => toggleOutput(option.id)}
                  className="accent-primary size-4"
                />
                {option.label}
              </label>
            ))}
          </fieldset>
          {errors.outputs ? <p className="text-destructive mt-3 text-sm">{errors.outputs}</p> : null}
        </CardContent>
      </Card>

      <Button type="submit" size="lg" className="h-11 text-base">
        <SparklesIcon />
        Gerar tudo
      </Button>
    </form>
  );
}

function providerMenuLabel(provider: ProviderOption, freeOnly: boolean): string {
  const tiers = [...new Set(selectableModels(provider, { freeOnly }).map((model) => modelTierLabel(model)))];
  return `${provider.label} · ${tiers.join(" e ")}`;
}

function modelMenuLabel(model: ModelOption): string {
  const unverified = model.unverified ? " (ID a confirmar)" : "";
  return `${model.label}${unverified} · ${modelTierLabel(model)}`;
}

function TierBadge({ free }: { free: boolean }) {
  return (
    <span
      className={
        free
          ? "rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
          : "rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-100"
      }
    >
      {free ? "Gratuito" : "Pago"}
    </span>
  );
}

function ModelGroup({ label, items, freeOnly }: { label: string; items: ProviderOption[]; freeOnly: boolean }) {
  if (items.length === 0) return null;
  return (
    <SelectGroup>
      <SelectLabel>{label}</SelectLabel>
      {items.map((item) => {
        const models = selectableModels(item, { freeOnly });
        const hasFree = models.some((model) => isFreeModel(model));
        const hasPaid = models.some((model) => !isFreeModel(model));
        return (
          <SelectItem key={item.id} value={item.id}>
            {item.label}
            {hasFree ? <TierBadge free /> : null}
            {hasPaid ? <TierBadge free={false} /> : null}
          </SelectItem>
        );
      })}
    </SelectGroup>
  );
}

function OptionGroup({ label, models }: { label: string; models: ModelOption[] }) {
  if (models.length === 0) return null;
  return (
    <SelectGroup>
      <SelectLabel>{label}</SelectLabel>
      {models.map((item) => (
        <SelectItem key={item.id} value={item.id}>
          {item.unverified ? `${item.label} (ID a confirmar)` : item.label}
          <TierBadge free={isFreeModel(item)} />
        </SelectItem>
      ))}
    </SelectGroup>
  );
}
