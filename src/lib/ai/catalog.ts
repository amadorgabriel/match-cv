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
 * Enquanto true, o seletor mostra só modelos com custo zero e provedores
 * que têm pelo menos um. Os pagos ficam em `paidOnly` e o buildModel segue
 * aceitando os cinco provedores.
 *
 * Conferido em 2026-10-21:
 * - Google: cota grátis em Flash/Flash-Lite
 *   (https://ai.google.dev/gemini-api/docs/pricing).
 * - OpenRouter: sufixo `:free` e `openrouter/free` a US$ 0
 *   (https://openrouter.ai/docs/guides/routing/model-variants/free).
 * - OpenAI: a linha Free da tabela de limites é teto de gasto, não crédito.
 *   O preço mais baixo da tabela é pago
 *   (https://developers.openai.com/api/docs/guides/rate-limits,
 *   https://developers.openai.com/api/docs/pricing).
 * - Anthropic: todo modelo da tabela tem preço. Há um crédito inicial
 *   pequeno e não publicado, não um modelo gratuito
 *   (https://platform.claude.com/docs/en/about-claude/pricing).
 * - Together: `Prism-ML/Ternary-Bonsai-27B` custa US$ 0 por token, mas a
 *   plataforma não tem trial e a primeira compra mínima é US$ 15
 *   (https://docs.together.ai/docs/serverless/models,
 *   https://docs.together.ai/docs/billing-credits). Sem chave gratuita.
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
      { id: "gpt-6.1-sol", label: "GPT-6.1 Sol (recomendado)", paidOnly: true },
      { id: "gpt-6-astra", label: "GPT-6 Astra (premium)", paidOnly: true },
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
      { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 (recomendado)", paidOnly: true },
      { id: "claude-opus-5-5", label: "Claude Opus 5.5 (premium)", paidOnly: true },
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
    models: [
      { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash (recomendado)" },
      { id: "gemini-3.6-flash", label: "Gemini 3.6 Flash (grátis)" },
      { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite (grátis)" },
      { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite (grátis)" },
    ],
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
      { id: "Qwen/Qwen3.8-2.4T-A95B", label: "Qwen3.8 2.4T A95B", paidOnly: true },
      { id: "zai-org/GLM-5", label: "GLM-5", unverified: true, paidOnly: true },
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
      { id: "cohere/north-mini-code:free", label: "Cohere North Mini Code (grátis)" },
      { id: "dots-studio/dots-3-note-preview:free", label: "Dots3-Note Preview (grátis)" },
      { id: "google/gemma-4-26b-a4b-it:free", label: "Gemma 4 26B (grátis)" },
      { id: "google/gemma-4-31b-it:free", label: "Gemma 4 31B (grátis)" },
      { id: "liquid/lfm-2.5-2.6b:free", label: "LFM2.5 2.6B (grátis)" },
      { id: "minimax/minimax-m3.1-flash:free", label: "MiniMax M3.1 Flash (grátis)" },
      { id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", label: "Nemotron 3 Nano Omni (grátis)" },
      { id: "nvidia/nemotron-3-super-120b-a12b:free", label: "Nemotron 3 Super (grátis)" },
      { id: "nvidia/nemotron-3-ultra-550b-a55b:free", label: "Nemotron 3 Ultra (grátis)" },
      { id: "nvidia/nemotron-3.5-content-safety:free", label: "Nemotron 3.5 Content Safety (grátis)" },
      { id: "nvidia/nemotron-3.5-lightning:free", label: "Nemotron 3.5 Lightning (grátis)" },
      { id: "nvidia/nemotron-3.5-super-vl:free", label: "Nemotron 3.5 Super VL (grátis)" },
      { id: "poolside/laguna-s-2.1:free", label: "Laguna S 2.1 (grátis)" },
      { id: "poolside/laguna-xs-2.1:free", label: "Laguna XS 2.1 (grátis)" },
      { id: "thinkingmachines/inkling-small:free", label: "Inkling Small (grátis)" },
      { id: "thinkingmachines/inkling:free", label: "Inkling (grátis)" },
      { id: "xingchen-agi/xing4.0-29b-a4b:free", label: "Xing4.0 29B (grátis)" },
    ],
  },
};

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === "string" && (PROVIDER_IDS as readonly string[]).includes(value);
}

/** Provedores que o seletor pode mostrar. Com FREE_TIER_ONLY, só quem tem modelo grátis. */
export function selectableProviders(): ProviderOption[] {
  return PROVIDER_IDS.map((id) => PROVIDERS[id]).filter((provider) => {
    if (FREE_TIER_ONLY && !provider.free) return false;
    return selectableModels(provider).length > 0;
  });
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
