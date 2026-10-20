"use client";

import { EyeIcon, EyeOffIcon, FileTextIcon, KeyRoundIcon, LoaderCircleIcon, SparklesIcon } from "lucide-react";
import { useMemo, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { isProviderId, PROVIDER_IDS, PROVIDERS, type ProviderId } from "@/lib/ai/catalog";
import { validateKey } from "@/lib/client/api";
import { clearStoredKey, parseStoredKey, readStoredKey, saveStoredKey, subscribeNoop } from "@/lib/client/key-storage";
import { maskKey } from "@/lib/client/mask";
import { LIMITS } from "@/lib/schemas/requests";

import type { FormValues } from "./types";

const providerItems = Object.fromEntries(PROVIDER_IDS.map((id) => [id, PROVIDERS[id].label]));

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

  const [file, setFile] = useState<File | null>(initial?.file ?? null);
  const [jobDescription, setJobDescription] = useState(initial?.jobDescription ?? "");
  const [achievements, setAchievements] = useState(initial?.achievements ?? "");
  const [providerInput, setProvider] = useState<ProviderId | null>(initial?.provider ?? null);
  const [modelInput, setModel] = useState<string | null>(initial?.model ?? null);
  const [apiKeyInput, setApiKey] = useState<string | null>(initial?.apiKey ?? null);
  const [rememberInput, setRemember] = useState<boolean | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [keyStatus, setKeyStatus] = useState<{ state: "idle" | "testing" | "ok" | "error"; message?: string }>({
    state: "idle",
  });

  const storedProvider = stored && isProviderId(stored.provider) ? stored.provider : null;
  const provider: ProviderId = providerInput ?? storedProvider ?? "openai";
  const providerInfo = PROVIDERS[provider];
  const model = modelInput ?? (storedProvider === provider ? stored?.model : undefined) ?? providerInfo.defaultModel;
  const apiKey = apiKeyInput ?? stored?.apiKey ?? "";
  const remember = rememberInput ?? stored !== null;

  const modelItems = useMemo(
    () => Object.fromEntries(providerInfo.models.map((m) => [m.id, m.unverified ? `${m.label} (ID a confirmar)` : m.label])),
    [providerInfo],
  );

  function changeProvider(next: ProviderId) {
    setProvider(next);
    setModel(PROVIDERS[next].defaultModel);
    setKeyStatus({ state: "idle" });
  }

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!file) e.file = "Envie o currículo em PDF.";
    else if (!(file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"))) e.file = "O arquivo precisa ser PDF.";
    else if (file.size > LIMITS.maxFileBytes) e.file = "O PDF precisa ter até 4 MB.";
    if (jobDescription.trim().length < 50) e.jobDescription = "Cole a descrição completa da vaga (mínimo de 50 caracteres).";
    if (jobDescription.length > LIMITS.maxJobDescriptionChars) e.jobDescription = "Descrição da vaga longa demais.";
    if (achievements.length > LIMITS.maxAchievementsChars) e.achievements = "Texto longo demais.";
    if (apiKey.trim().length < 10) e.apiKey = "Informe sua API key do provedor escolhido.";
    return e;
  }

  async function testKey() {
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
    if (Object.keys(found).length > 0 || !file) return;

    const values: FormValues = {
      file,
      jobDescription: jobDescription.trim(),
      achievements: achievements.trim(),
      provider,
      model,
      apiKey: apiKey.trim(),
    };
    if (remember) saveStoredKey({ provider, model, apiKey: values.apiKey });
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
          Envie o currículo, cole a vaga e escolha a IA. Nada fica salvo no servidor.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Currículo e vaga</CardTitle>
          <CardDescription>PDF de até 4 MB e a descrição completa da vaga.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="cv-file">Currículo (PDF)</Label>
            <label
              htmlFor="cv-file"
              className="border-input hover:bg-muted/50 flex cursor-pointer items-center gap-3 rounded-lg border border-dashed p-4 text-sm transition-colors"
            >
              <FileTextIcon className="text-muted-foreground size-5" />
              <span className="truncate">{file ? `${file.name} (${(file.size / 1024).toFixed(0)} KB)` : "Clique para escolher o arquivo PDF"}</span>
            </label>
            <input
              id="cv-file"
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              aria-invalid={!!errors.file}
            />
            {errors.file && <p className="text-destructive text-sm">{errors.file}</p>}
          </div>

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
            {errors.jobDescription && <p className="text-destructive text-sm">{errors.jobDescription}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="achievements">
              Conquistas e números <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Textarea
              id="achievements"
              rows={4}
              value={achievements}
              onChange={(e) => setAchievements(e.target.value)}
              placeholder={"Uma por linha. Elas vão aparecer obrigatoriamente no CV.\nEx.: reduzi o tempo de deploy em 40%"}
              aria-invalid={!!errors.achievements}
            />
            {errors.achievements && <p className="text-destructive text-sm">{errors.achievements}</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Provedor de IA e sua chave</CardTitle>
          <CardDescription>
            Você usa a sua própria API key. Ela fica só na memória desta página e vai direto para a geração, sem ser salva.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Provedor</Label>
              <Select
                value={provider}
                items={providerItems}
                onValueChange={(v) => {
                  if (isProviderId(v)) changeProvider(v);
                }}
              >
                <SelectTrigger className="w-full" aria-label="Provedor de IA">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_IDS.map((id) => (
                    <SelectItem key={id} value={id}>
                      {PROVIDERS[id].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Modelo</Label>
              <Select value={model} items={modelItems} onValueChange={(v) => typeof v === "string" && setModel(v)}>
                <SelectTrigger className="w-full" aria-label="Modelo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {providerInfo.models.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {modelItems[m.id]}
                    </SelectItem>
                  ))}
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

      <Button type="submit" size="lg" className="h-11 text-base">
        <SparklesIcon />
        Gerar tudo
      </Button>
    </form>
  );
}
