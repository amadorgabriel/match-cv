/**
 * Catálogo de provedores e modelos exibidos no seletor.
 *
 * Este arquivo é seguro para o cliente: não tem segredos nem baseURLs.
 * Os IDs de modelo mudam rápido. Confirme cada um via endpoint `/models`
 * do provedor e teste structured output antes de manter na lista.
 */

export const PROVIDER_IDS = [
  "openai",
  "anthropic",
  "google",
  "together",
  "openrouter",
] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

export interface ModelOption {
  id: string;
  label: string;
  /** true quando o ID ainda não foi confirmado no `/models` do provedor */
  unverified?: boolean;
  /**
   * Modelo só do plano pago. O seletor não o oferece.
   * O caminho no servidor continua aceitando o ID.
   */
  paidOnly?: boolean;
}

export interface ProviderOption {
  id: ProviderId;
  label: string;
  description: string;
  keyHint: string;
  keyDocsUrl: string;
  defaultModel: string;
  models: ModelOption[];
  /**
   * true quando uma chave gratuita (sem faturamento obrigatório) consegue
   * chamar os modelos listados. Conferido na documentação oficial em 2026-10-21.
   */
  free: boolean;
}

/**
 * Enquanto true, o seletor mostra só provedores com `free: true`.
 * Os demais continuam em PROVIDERS e em buildModel para voltar depois.
 *
 * Google AI Studio mantém cota gratuita em modelos limitados (Gemini 3.8 Flash).
 * OpenRouter: variantes `:free` e o roteador `openrouter/free` custam US$ 0
 * (https://openrouter.ai/docs/guides/routing/model-variants/free).
 * OpenAI e Anthropic não têm API gratuita permanente. A Together encerrou o
 * crédito de cadastro e exige saldo pré-pago.
 */
export const FREE_TIER_ONLY = true;

export const PROVIDERS: Record<ProviderId, ProviderOption> = {
  openai: {
    id: "openai",
    label: "OpenAI",
    description: "Modelos GPT da OpenAI",
    keyHint: "sk-...",
    keyDocsUrl: "https://platform.openai.com/api-keys",
    defaultModel: "gpt-6.1-sol",
    free: false,
    models: [
      { id: "gpt-6.1-sol", label: "GPT-6.1 Sol (recomendado)" },
      { id: "gpt-6-astra", label: "GPT-6 Astra (premium)" },
    ],
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    description: "Modelos Claude da Anthropic",
    keyHint: "sk-ant-...",
    keyDocsUrl: "https://console.anthropic.com/settings/keys",
    defaultModel: "claude-sonnet-5-5",
    free: false,
    models: [
      { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 (recomendado)" },
      { id: "claude-opus-5-5", label: "Claude Opus 5.5 (premium)" },
    ],
  },
  google: {
    id: "google",
    label: "Google Gemini",
    description: "Gemini no plano gratuito do Google AI Studio",
    keyHint: "AIza...",
    keyDocsUrl: "https://aistudio.google.com/apikey",
    defaultModel: "gemini-3.8-flash",
    free: true,
    models: [{ id: "gemini-3.8-flash", label: "Gemini 3.8 Flash (recomendado)" }],
  },
  together: {
    id: "together",
    label: "Open source via Together AI",
    description: "Qwen 3 e outros modelos abertos hospedados na Together",
    keyHint: "chave da Together",
    keyDocsUrl: "https://api.together.ai/settings/api-keys",
    defaultModel: "Qwen/Qwen3.8-2.4T-A95B",
    free: false,
    models: [
      { id: "Qwen/Qwen3.8-2.4T-A95B", label: "Qwen3.8 2.4T A95B" },
      { id: "zai-org/GLM-5", label: "GLM-5", unverified: true },
    ],
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter (modelos gratuitos)",
    description: "Variantes :free e o roteador openrouter/free, a US$ 0",
    keyHint: "sk-or-...",
    keyDocsUrl: "https://openrouter.ai/settings/keys",
    defaultModel: "openrouter/free",
    free: true,
    models: [
      { id: "openrouter/free", label: "Roteador de modelos gratuitos (recomendado)" },
      { id: "nvidia/nemotron-3-super-120b-a12b:free", label: "Nemotron 3 Super (grátis)" },
      { id: "google/gemma-4-31b-it:free", label: "Gemma 4 31B (grátis)" },
    ],
  },
};

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === "string" && (PROVIDER_IDS as readonly string[]).includes(value);
}

/** Provedores que o seletor pode mostrar. Com FREE_TIER_ONLY, só os gratuitos. */
export function selectableProviders(): ProviderOption[] {
  return PROVIDER_IDS.map((id) => PROVIDERS[id]).filter((provider) => !FREE_TIER_ONLY || provider.free);
}

export function isSelectableProvider(id: ProviderId): boolean {
  return !FREE_TIER_ONLY || PROVIDERS[id].free;
}

/** Primeiro provedor visível. Com o seletor gratuito, é o Google Gemini. */
export function defaultSelectableProvider(): ProviderId {
  return selectableProviders()[0]?.id ?? "google";
}

/** Modelos que o seletor pode escolher. Os pagos ficam de fora. */
export function selectableModels(provider: ProviderOption): ModelOption[] {
  return provider.models.filter((model) => !model.paidOnly);
}

/** Formato aceito para IDs de modelo (evita injeção em URL/headers). */
export const MODEL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$/;
