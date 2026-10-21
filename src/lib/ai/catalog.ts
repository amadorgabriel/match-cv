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
   * Modelo só do plano pago. Continua no catálogo para ficar explícito,
   * mas o seletor não o oferece: a chave gratuita falha nele.
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
}

export const PROVIDERS: Record<ProviderId, ProviderOption> = {
  openai: {
    id: "openai",
    label: "OpenAI",
    description: "Modelos GPT da OpenAI",
    keyHint: "sk-...",
    keyDocsUrl: "https://platform.openai.com/api-keys",
    defaultModel: "gpt-6.1-sol",
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
    models: [
      { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 (recomendado)" },
      { id: "claude-opus-5-5", label: "Claude Opus 5.5 (premium)" },
    ],
  },
  google: {
    id: "google",
    label: "Google Gemini",
    description: "Gemini via Google AI Studio",
    keyHint: "AIza...",
    keyDocsUrl: "https://aistudio.google.com/apikey",
    defaultModel: "gemini-3.8-flash",
    models: [
      { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash (recomendado)" },
      {
        id: "gemini-4-argon",
        label: "Gemini 4 Argon (pago — exige chave com faturamento)",
        paidOnly: true,
      },
    ],
  },
  together: {
    id: "together",
    label: "Open source via Together AI",
    description: "Qwen 3 e outros modelos abertos hospedados na Together",
    keyHint: "chave da Together",
    keyDocsUrl: "https://api.together.ai/settings/api-keys",
    defaultModel: "Qwen/Qwen3.8-2.4T-A95B",
    models: [
      { id: "Qwen/Qwen3.8-2.4T-A95B", label: "Qwen3.8 2.4T A95B" },
      { id: "zai-org/GLM-5", label: "GLM-5", unverified: true },
    ],
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter (uma chave para vários modelos)",
    description: "Gateway com modelos pagos e abertos",
    keyHint: "sk-or-...",
    keyDocsUrl: "https://openrouter.ai/settings/keys",
    defaultModel: "qwen/qwen3.8-max",
    models: [
      { id: "qwen/qwen3.8-max", label: "Qwen3.8 Max", unverified: true },
      { id: "z-ai/glm-5.3", label: "GLM-5.3", unverified: true },
      { id: "moonshotai/kimi-k3", label: "Kimi K3", unverified: true },
    ],
  },
};

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === "string" && (PROVIDER_IDS as readonly string[]).includes(value);
}

/** Modelos que o seletor pode escolher. Os pagos ficam só como aviso. */
export function selectableModels(provider: ProviderOption): ModelOption[] {
  return provider.models.filter((model) => !model.paidOnly);
}

/** Formato aceito para IDs de modelo (evita injeção em URL/headers). */
export const MODEL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$/;
