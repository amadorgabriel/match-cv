import "server-only";

import type { LanguageModel, ToolSet } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

import { MODEL_ID_PATTERN, type ProviderId, isProviderId } from "./catalog";

/**
 * baseURLs fixas no servidor. O cliente escolhe só o `provider` da allowlist;
 * nunca envia uma URL (proteção contra SSRF).
 */
const OPENAI_COMPATIBLE_ENDPOINTS = {
  together: "https://api.together.xyz/v1",
  openrouter: "https://openrouter.ai/api/v1",
} as const;

/** Endpoints baratos usados para validar a chave (listagem de modelos). */
export const KEY_VALIDATION_ENDPOINTS: Record<ProviderId, string> = {
  openai: "https://api.openai.com/v1/models",
  anthropic: "https://api.anthropic.com/v1/models",
  google: "https://generativelanguage.googleapis.com/v1beta/models",
  together: `${OPENAI_COMPATIBLE_ENDPOINTS.together}/models`,
  openrouter: `${OPENAI_COMPATIBLE_ENDPOINTS.openrouter}/key`,
};

export class ProviderConfigError extends Error {}

/** Busca nativa: OpenAI web search, Anthropic web search e Google Search grounding. */
export function supportsNativeWebSearch(provider: ProviderId): boolean {
  return provider === "openai" || provider === "anthropic" || provider === "google";
}

/**
 * Busca salarial na web. Além da ferramenta nativa, o OpenRouter entra
 * com o sufixo `:online` (atalho do plugin web) no modelo de salário.
 * Together continua sem busca.
 */
export function supportsSalaryWebSearch(provider: ProviderId): boolean {
  return supportsNativeWebSearch(provider) || provider === "openrouter";
}

/** `modelo:free` vira `modelo:free:online`. Quem já termina em `:online` fica. */
export function openRouterWebModelId(modelId: string): string {
  if (modelId.endsWith(":online")) return modelId;
  return `${modelId}:online`;
}

/**
 * Fallback quando o sufixo estoura o tamanho do ID. Injeta o plugin `web`
 * do OpenRouter no corpo, sem pacote novo. O `:online` é o caminho normal.
 */
export function withOpenRouterWebPlugin(fetchImpl: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    if (init?.body && typeof init.body === "string") {
      try {
        const json = JSON.parse(init.body) as Record<string, unknown>;
        const plugins = Array.isArray(json.plugins) ? json.plugins : [];
        json.plugins = [...plugins, { id: "web", max_results: 3 }];
        init = { ...init, body: JSON.stringify(json) };
      } catch {
        // Corpo que não é JSON segue sem o plugin.
      }
    }
    return fetchImpl(input, init);
  };
}

/**
 * Monta o modelo e, quando existe, a ferramenta de busca na web com a chave do usuário.
 * Together não tem busca e devolve null. OpenRouter usa `:online` ou o plugin web.
 * A chave não é logada. As baseURLs continuam só na allowlist.
 */
export function buildWebSearchRequest(
  provider: ProviderId,
  modelId: string,
  apiKey: string,
): { model: LanguageModel; tools?: ToolSet } | null {
  if (!isProviderId(provider) || !MODEL_ID_PATTERN.test(modelId) || !apiKey) return null;
  if (!supportsSalaryWebSearch(provider)) return null;

  if (provider === "openrouter") {
    const onlineId = openRouterWebModelId(modelId);
    const useSuffix = MODEL_ID_PATTERN.test(onlineId);
    const openrouter = createOpenAICompatible({
      name: "openrouter",
      baseURL: OPENAI_COMPATIBLE_ENDPOINTS.openrouter,
      apiKey,
      supportsStructuredOutputs: false,
      headers: { "X-Title": "MatchCV" },
      fetch: useSuffix ? undefined : withOpenRouterWebPlugin(),
    });
    return { model: openrouter(useSuffix ? onlineId : modelId) };
  }

  switch (provider) {
    case "openai": {
      const openai = createOpenAI({ apiKey });
      return {
        model: openai.responses(modelId),
        tools: {
          web_search: openai.tools.webSearch({
            searchContextSize: "low",
            userLocation: { type: "approximate", country: "BR" },
          }),
        },
      };
    }
    case "anthropic": {
      const anthropic = createAnthropic({ apiKey });
      return {
        model: anthropic(modelId),
        tools: {
          web_search: anthropic.tools.webSearch_20250305({
            maxUses: 3,
            userLocation: { type: "approximate", country: "BR", timezone: "America/Sao_Paulo" },
          }),
        },
      };
    }
    case "google": {
      const google = createGoogleGenerativeAI({ apiKey });
      return {
        model: google(modelId),
        tools: { google_search: google.tools.googleSearch({}) },
      };
    }
    default:
      return null;
  }
}

/**
 * Cria o modelo com a chave do usuário. Chame SEMPRE dentro do handler,
 * a cada request. Nunca guarde a instância em escopo de módulo: isso
 * misturaria chaves de usuários diferentes.
 *
 * Nunca passe só a string do modelo para o AI SDK: sem provider, a chamada
 * vai para o Vercel AI Gateway e não usa a chave do usuário.
 */
export function buildModel(provider: ProviderId, modelId: string, apiKey: string): LanguageModel {
  if (!isProviderId(provider)) throw new ProviderConfigError("provider_not_allowed");
  if (!MODEL_ID_PATTERN.test(modelId)) throw new ProviderConfigError("invalid_model_id");
  if (!apiKey) throw new ProviderConfigError("missing_api_key");

  switch (provider) {
    case "openai":
      return createOpenAI({ apiKey })(modelId);
    case "anthropic":
      return createAnthropic({ apiKey })(modelId);
    case "google":
      return createGoogleGenerativeAI({ apiKey })(modelId);
    case "together":
      return createOpenAICompatible({
        name: "together",
        baseURL: OPENAI_COMPATIBLE_ENDPOINTS.together,
        apiKey,
        supportsStructuredOutputs: true,
      })(modelId);
    case "openrouter":
      return createOpenAICompatible({
        name: "openrouter",
        baseURL: OPENAI_COMPATIBLE_ENDPOINTS.openrouter,
        apiKey,
        // Depende do modelo roteado. Desligado por padrão; o Zod valida a saída.
        supportsStructuredOutputs: false,
        headers: { "X-Title": "MatchCV" },
      })(modelId);
  }
}

/** Headers de autenticação por provedor para a validação da chave. */
export function keyValidationRequest(provider: ProviderId, apiKey: string): { url: string; init: RequestInit } {
  const url = KEY_VALIDATION_ENDPOINTS[provider];
  switch (provider) {
    case "anthropic":
      return {
        url,
        init: { headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" } },
      };
    case "google":
      return { url, init: { headers: { "x-goog-api-key": apiKey } } };
    default:
      return { url, init: { headers: { Authorization: `Bearer ${apiKey}` } } };
  }
}
