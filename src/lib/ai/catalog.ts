/**
 * Catálogo de provedores e modelos exibidos no seletor.
 *
 * Este arquivo é seguro para o cliente: não tem segredos nem baseURLs.
 * Os IDs de modelo mudam rápido. Confirme cada um via endpoint `/models`
 * do provedor e teste structured output antes de manter na lista.
 *
 * O padrão inicial continua gratuito: Google / gemini-3.8-flash.
 * Modelos pagos ficam visíveis, com badge, e podem ser escondidos no seletor.
 */

export const PROVIDER_IDS = [
  "openai",
  "anthropic",
  "google",
  "together",
  "openrouter",
] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

export type ModelTier = "free" | "paid";

export interface ModelOption {
  id: string;
  label: string;
  tier: ModelTier;
  /** true quando a chamada cabe num plano gratuito do provedor. */
  free: boolean;
  /** true quando o ID ainda não foi confirmado no `/models` do provedor */
  unverified?: boolean;
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
   * true quando o provedor oferece pelo menos um modelo gratuito
   * sem faturamento obrigatório. Os modelos pagos do mesmo provedor
   * continuam na lista, cada um com `tier: "paid"`.
   */
  free: boolean;
}

/**
 * Quando true, o seletor esconde provedores e modelos pagos.
 * O padrão é false: pagos e gratuitos aparecem, e a UI filtra sob demanda.
 */
export const FREE_TIER_ONLY = false;

function freeModel(id: string, label: string, unverified?: boolean): ModelOption {
  return { id, label, tier: "free", free: true, unverified };
}

function paidModel(id: string, label: string, unverified?: boolean): ModelOption {
  return { id, label, tier: "paid", free: false, unverified };
}

export const PROVIDERS: Record<ProviderId, ProviderOption> = {
  openai: {
    id: "openai",
    label: "OpenAI",
    description: "Modelos GPT pagos da OpenAI",
    keyHint: "sk-...",
    keyDocsUrl: "https://platform.openai.com/api-keys",
    defaultModel: "gpt-6.1-sol",
    free: false,
    models: [
      paidModel("gpt-6.1-sol", "GPT-6.1 Sol (recomendado)"),
      paidModel("gpt-6-astra", "GPT-6 Astra (premium)"),
    ],
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    description: "Modelos Claude pagos da Anthropic",
    keyHint: "sk-ant-...",
    keyDocsUrl: "https://console.anthropic.com/settings/keys",
    defaultModel: "claude-sonnet-5-5",
    free: false,
    models: [
      paidModel("claude-sonnet-5-5", "Claude Sonnet 5.5 (recomendado)"),
      paidModel("claude-opus-5-5", "Claude Opus 5.5 (premium)"),
    ],
  },
  google: {
    id: "google",
    label: "Google Gemini",
    description: "Gemini gratuito no AI Studio e modelos premium",
    keyHint: "AIza...",
    keyDocsUrl: "https://aistudio.google.com/apikey",
    defaultModel: "gemini-3.8-flash",
    free: true,
    models: [
      freeModel("gemini-3.8-flash", "Gemini 3.8 Flash (recomendado)"),
      freeModel("gemini-3.6-flash", "Gemini 3.6 Flash"),
      freeModel("gemini-3.5-flash-lite", "Gemini 3.5 Flash-Lite"),
      freeModel("gemini-3.1-flash-lite", "Gemini 3.1 Flash-Lite"),
      paidModel("gemini-4-argon", "Gemini 4 Argon (premium)"),
    ],
  },
  together: {
    id: "together",
    label: "Open source via Together AI",
    description: "Qwen e outros modelos abertos hospedados na Together",
    keyHint: "chave da Together",
    keyDocsUrl: "https://api.together.ai/settings/api-keys",
    defaultModel: "Qwen/Qwen3.8-2.4T-A95B",
    free: false,
    models: [
      paidModel("Qwen/Qwen3.8-2.4T-A95B", "Qwen3.8 2.4T A95B"),
      paidModel("zai-org/GLM-5", "GLM-5", true),
    ],
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    description: "Modelos gratuitos (:free) e modelos pagos no mesmo roteador",
    keyHint: "sk-or-...",
    keyDocsUrl: "https://openrouter.ai/settings/keys",
    defaultModel: "openrouter/free",
    free: true,
    models: [
      freeModel("openrouter/free", "Roteador de modelos gratuitos (recomendado)"),
      freeModel("cohere/north-mini-code:free", "Cohere North Mini Code"),
      freeModel("dots-studio/dots-3-note-preview:free", "Dots3-Note Preview"),
      freeModel("google/gemma-4-26b-a4b-it:free", "Gemma 4 26B"),
      freeModel("google/gemma-4-31b-it:free", "Gemma 4 31B"),
      freeModel("liquid/lfm-2.5-2.6b:free", "LFM2.5 2.6B"),
      freeModel("minimax/minimax-m3.1-flash:free", "MiniMax M3.1 Flash"),
      freeModel("nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", "Nemotron 3 Nano Omni"),
      freeModel("nvidia/nemotron-3-super-120b-a12b:free", "Nemotron 3 Super"),
      freeModel("nvidia/nemotron-3-ultra-550b-a55b:free", "Nemotron 3 Ultra"),
      freeModel("nvidia/nemotron-3.5-content-safety:free", "Nemotron 3.5 Content Safety"),
      freeModel("nvidia/nemotron-3.5-lightning:free", "Nemotron 3.5 Lightning"),
      freeModel("nvidia/nemotron-3.5-super-vl:free", "Nemotron 3.5 Super VL"),
      freeModel("poolside/laguna-s-2.1:free", "Laguna S 2.1"),
      freeModel("poolside/laguna-xs-2.1:free", "Laguna XS 2.1"),
      freeModel("thinkingmachines/inkling-small:free", "Inkling Small"),
      freeModel("thinkingmachines/inkling:free", "Inkling"),
      freeModel("xingchen-agi/xing4.0-29b-a4b:free", "Xing4.0 29B"),
      paidModel("google/gemini-4-argon", "Gemini 4 Argon (premium)", true),
      paidModel("openai/gpt-6.1-sol", "GPT-6.1 Sol (premium)", true),
      paidModel("anthropic/claude-sonnet-5-5", "Claude Sonnet 5.5 (premium)", true),
    ],
  },
};

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === "string" && (PROVIDER_IDS as readonly string[]).includes(value);
}

export function isFreeModel(model: ModelOption): boolean {
  return model.free && model.tier === "free";
}

export function modelTierLabel(model: ModelOption): "Gratuito" | "Pago" {
  return isFreeModel(model) ? "Gratuito" : "Pago";
}

/** Provedores que o seletor pode mostrar. Com FREE_TIER_ONLY, só quem tem modelo grátis. */
export function selectableProviders(options?: { freeOnly?: boolean }): ProviderOption[] {
  return PROVIDER_IDS.map((id) => PROVIDERS[id]).filter((provider) => {
    if (FREE_TIER_ONLY && !provider.free) return false;
    return selectableModels(provider, options).length > 0;
  });
}

export function isSelectableProvider(id: ProviderId): boolean {
  return !FREE_TIER_ONLY || PROVIDERS[id].free;
}

/** Primeiro provedor sugerido. Continua sendo o Google, com modelo gratuito. */
export function defaultSelectableProvider(): ProviderId {
  const providers = selectableProviders();
  if (providers.some((provider) => provider.id === "google")) return "google";
  return providers[0]?.id ?? "google";
}

/** Modelos que o seletor pode escolher. `freeOnly` esconde os pagos. */
export function selectableModels(provider: ProviderOption, options?: { freeOnly?: boolean }): ModelOption[] {
  const visible = FREE_TIER_ONLY ? provider.models.filter((model) => isFreeModel(model)) : provider.models;
  if (!options?.freeOnly) return visible;
  return visible.filter((model) => isFreeModel(model));
}

/** Formato aceito para IDs de modelo (evita injeção em URL/headers). */
export const MODEL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$/;
